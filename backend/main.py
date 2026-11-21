"""
GateWay:Oblivion — FastAPI Backend v0.2.0
Phase 2: Recon Dashboard — NetVision Integration
"""

import asyncio
import uuid
import json
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.netvision_client import NetVisionClient
from services.ws_bridge import NetVisionWSBridge
from services.vuln_service import vuln_store, VulnCreate, VulnPatch
from services.operations_service import ops_store, ops_executor, OperationCreate, RUNBOOKS
from services.intel_service import intel_store, ReportCreate
from services.event_bus import event_bus
from services.resilience import TTLCache, CircuitBreaker, HealthMonitor, CircuitOpen
from models.canonical import CanonicalEvent, canonical_event
from adapters import (
    AdapterRegistry,
    get_adapter,
    get_tool_names,
    register_default_adapters,
    registry,
)
from adapters.netvision import NetVisionAdapter  # noqa: F401
from adapters.metasploit import MetasploitAdapter  # noqa: F401
from adapters.reconng import ReconNgAdapter  # noqa: F401
from adapters.godseye import GodsEyeAdapter  # noqa: F401
from adapters.obsidian import ObsidianAdapter  # noqa: F401
from services.obsidian_service import obsidian_service

logger = logging.getLogger("oblivion")
logging.basicConfig(level=logging.INFO)

# ═══════════════════════════════════════════════════════════════════
# NetVision Client (global, initialized on startup)
# ═══════════════════════════════════════════════════════════════════

nv_client: Optional[NetVisionClient] = None
nv_ws_bridge: Optional[NetVisionWSBridge] = None
health_monitor: Optional[HealthMonitor] = None
exec_cache = TTLCache(ttl=30.0, max_entries=256)

# Read-only tool actions are safe to cache; mutating ones never are.
CACHEABLE_ACTIONS = {
    "version", "sessions_list", "search", "module_info", "module_search", "show",
    "devices", "vulnerabilities", "topology", "correlation", "recon_summary",
    "situation_brief", "weather", "weather_map", "flights", "aircraft", "satellites",
    "cctv", "cyclones", "launches", "military", "fires", "earthquakes", "imagery",
    "status", "notes_list", "note_read", "note_search", "canvases_list", "canvas_read",
}


# ═══════════════════════════════════════════════════════════════════
# Pydantic Models (Targets, Campaigns — Phase 1)
# ═══════════════════════════════════════════════════════════════════

class TargetBase(BaseModel):
    name: str
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    domain: Optional[str] = None
    cidr_range: Optional[str] = None
    status: str = "active"
    tags: list[str] = []
    notes: Optional[str] = None

class TargetCreate(TargetBase):
    pass

class Target(TargetBase):
    id: str
    campaign_id: Optional[str] = None
    created_by: str = "operator"
    created_at: str
    updated_at: str

class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None

class CampaignCreate(CampaignBase):
    pass

class Campaign(CampaignBase):
    id: str
    status: str = "draft"
    targets: list[str] = []
    created_by: str = "operator"
    created_at: str
    updated_at: str

class BulkImportRequest(BaseModel):
    targets: list[TargetCreate]
    campaign_id: Optional[str] = None

class BulkImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


# ═══════════════════════════════════════════════════════════════════
# In-Memory Store
# ═══════════════════════════════════════════════════════════════════

class Store:
    def __init__(self):
        self.targets: dict[str, Target] = {}
        self.campaigns: dict[str, Campaign] = {}

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def list_targets(self, status: Optional[str] = None, tag: Optional[str] = None,
                     search: Optional[str] = None) -> list[Target]:
        results = list(self.targets.values())
        if status:
            results = [t for t in results if t.status == status]
        if tag:
            results = [t for t in results if tag in t.tags]
        if search:
            q = search.lower()
            results = [t for t in results if
                       q in t.name.lower() or
                       (t.ip_address and q in t.ip_address) or
                       (t.hostname and q in t.hostname) or
                       (t.domain and q in t.domain)]
        return sorted(results, key=lambda t: t.created_at, reverse=True)

    def get_target(self, target_id: str) -> Optional[Target]:
        return self.targets.get(target_id)

    def create_target(self, data: TargetCreate, campaign_id: Optional[str] = None) -> Target:
        now = self._now()
        target = Target(
            id=str(uuid.uuid4()),
            **data.model_dump(),
            campaign_id=campaign_id,
            created_at=now,
            updated_at=now,
        )
        self.targets[target.id] = target
        if campaign_id and campaign_id in self.campaigns:
            if target.id not in self.campaigns[campaign_id].targets:
                self.campaigns[campaign_id].targets.append(target.id)
        return target

    def update_target(self, target_id: str, data: TargetCreate) -> Optional[Target]:
        existing = self.targets.get(target_id)
        if not existing:
            return None
        now = self._now()
        updated = Target(
            id=target_id,
            **data.model_dump(),
            campaign_id=existing.campaign_id,
            created_by=existing.created_by,
            created_at=existing.created_at,
            updated_at=now,
        )
        self.targets[target_id] = updated
        return updated

    def patch_target(self, target_id: str, updates: dict) -> Optional[Target]:
        existing = self.targets.get(target_id)
        if not existing:
            return None
        now = self._now()
        patched = existing.model_copy(update={**updates, "updated_at": now})
        self.targets[target_id] = patched
        return patched

    def delete_target(self, target_id: str) -> bool:
        if target_id not in self.targets:
            return False
        del self.targets[target_id]
        for camp in self.campaigns.values():
            if target_id in camp.targets:
                camp.targets.remove(target_id)
        return True

    def bulk_import(self, req: BulkImportRequest) -> BulkImportResponse:
        imported = 0
        skipped = 0
        errors = []
        for t in req.targets:
            try:
                self.create_target(t, campaign_id=req.campaign_id)
                imported += 1
            except Exception as e:
                errors.append(f"{t.name}: {str(e)}")
                skipped += 1
        return BulkImportResponse(imported=imported, skipped=skipped, errors=errors)

    def list_campaigns(self) -> list[Campaign]:
        return sorted(self.campaigns.values(), key=lambda c: c.created_at, reverse=True)

    def get_campaign(self, campaign_id: str) -> Optional[Campaign]:
        return self.campaigns.get(campaign_id)

    def create_campaign(self, data: CampaignCreate) -> Campaign:
        now = self._now()
        camp = Campaign(
            id=str(uuid.uuid4()),
            **data.model_dump(),
            created_at=now,
            updated_at=now,
        )
        self.campaigns[camp.id] = camp
        return camp

    def update_campaign(self, campaign_id: str, data: CampaignCreate) -> Optional[Campaign]:
        existing = self.campaigns.get(campaign_id)
        if not existing:
            return None
        now = self._now()
        updated = Campaign(
            id=campaign_id,
            **data.model_dump(),
            status=existing.status,
            targets=existing.targets,
            created_by=existing.created_by,
            created_at=existing.created_at,
            updated_at=now,
        )
        self.campaigns[campaign_id] = updated
        return updated

    def delete_campaign(self, campaign_id: str) -> bool:
        if campaign_id not in self.campaigns:
            return False
        for tid in self.campaigns[campaign_id].targets:
            if tid in self.targets:
                self.targets[tid].campaign_id = None
        del self.campaigns[campaign_id]
        return True

    def add_targets_to_campaign(self, campaign_id: str, target_ids: list[str]) -> bool:
        camp = self.campaigns.get(campaign_id)
        if not camp:
            return False
        for tid in target_ids:
            if tid in self.targets and tid not in camp.targets:
                camp.targets.append(tid)
                self.targets[tid].campaign_id = campaign_id
        return True

    def remove_target_from_campaign(self, campaign_id: str, target_id: str) -> bool:
        camp = self.campaigns.get(campaign_id)
        if not camp or target_id not in camp.targets:
            return False
        camp.targets.remove(target_id)
        if target_id in self.targets:
            self.targets[target_id].campaign_id = None
        return True


store = Store()


# ═══════════════════════════════════════════════════════════════════
# WebSocket Connection Manager
# ═══════════════════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)


manager = ConnectionManager()


# ═══════════════════════════════════════════════════════════════════
# App Lifespan
# ═══════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    global nv_client, nv_ws_bridge, health_monitor

    register_default_adapters()
    health_monitor = HealthMonitor(registry, interval=30.0)
    await health_monitor.start()
    await health_monitor.check_all(force=True)

    nv_client = NetVisionClient()
    nv_ws_bridge = NetVisionWSBridge()

    # Log NetVision connection status
    try:
        health = await nv_client.health()
        logger.info("NetVision health: %s", health.get("status", "unknown"))
        # Start WS bridge
        await nv_ws_bridge.connect()
    except Exception as e:
        logger.warning("NetVision not reachable: %s (recon will show offline)", e)

    # Seed demo targets
    _seed_data()

    # Heartbeat for WS
    async def heartbeat():
        while True:
            await asyncio.sleep(30)
            await manager.broadcast({
                "type": "heartbeat",
                "netvision_connected": nv_ws_bridge.is_connected if nv_ws_bridge else False,
            })

    task = asyncio.create_task(heartbeat())
    yield
    task.cancel()
    if health_monitor:
        await health_monitor.stop()
    for name in registry.list():
        adapter = registry.get(name)
        if adapter:
            try:
                await adapter.disconnect()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error disconnecting %s: %s", name, exc)
    if nv_client:
        await nv_client.close()
    if nv_ws_bridge:
        await nv_ws_bridge.disconnect()


def _seed_data():
    demos = [
        TargetCreate(name="Web Server Alpha", ip_address="10.0.1.10", hostname="web-alpha.internal",
                     tags=["web", "production"], status="active"),
        TargetCreate(name="DB Cluster Primary", ip_address="10.0.1.20", hostname="db-primary.internal",
                     tags=["database", "production"], status="active"),
        TargetCreate(name="Staging Environment", cidr_range="10.0.2.0/24",
                     tags=["staging"], status="active"),
        TargetCreate(name="Legacy VPN Gateway", ip_address="203.0.113.5", hostname="vpn.legacy",
                     tags=["vpn", "legacy"], status="archived"),
        TargetCreate(name="DMZ Host", ip_address="10.0.0.50", hostname="dmz-gw.internal",
                     tags=["dmz", "gateway"], status="compromised"),
    ]
    for d in demos:
        store.create_target(d)
    store.create_campaign(CampaignCreate(name="Q3 Infrastructure Audit",
                                         description="Full sweep of internal infrastructure"))


# ═══════════════════════════════════════════════════════════════════
# App Setup
# ═══════════════════════════════════════════════════════════════════

app = FastAPI(
    title="GateWay:Oblivion API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# Health & WebSocket
# ═══════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status": "operational",
        "version": "0.2.0",
        "ws_connections": manager.active_connections.__len__(),
        "targets": len(store.targets),
        "campaigns": len(store.campaigns),
        "netvision_connected": nv_ws_bridge.is_connected if nv_ws_bridge else False,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Register with NetVision bridge to receive forwarded events
    if nv_ws_bridge:
        nv_ws_bridge.add_listener(websocket)

    # Subscribe to the unified event bus -> fan normalized events to this client
    bus_cb = None
    async def bus_forward(event: CanonicalEvent):
        try:
            await websocket.send_json({"type": "event", "data": event.model_dump()})
        except Exception:
            pass
    bus_cb = event_bus.subscribe(bus_forward)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "unknown")
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg_type == "subscribe":
                    # Optional: subscribe to specific NetVision topics
                    await websocket.send_json({"type": "subscribed", "topics": msg.get("topics", [])})
                else:
                    await websocket.send_json({"type": "echo", "payload": msg})
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "payload": "invalid JSON"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
        if nv_ws_bridge:
            nv_ws_bridge.remove_listener(websocket)
        if bus_cb is not None:
            await event_bus.unsubscribe(bus_cb)


# ═══════════════════════════════════════════════════════════════════
# Targets API (Phase 1)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/targets")
async def list_targets(
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    return store.list_targets(status=status, tag=tag, search=search)


@app.get("/api/targets/stats")
async def target_stats():
    targets = list(store.targets.values())
    return {
        "total": len(targets),
        "active": sum(1 for t in targets if t.status == "active"),
        "archived": sum(1 for t in targets if t.status == "archived"),
        "compromised": sum(1 for t in targets if t.status == "compromised"),
        "pending": sum(1 for t in targets if t.status == "pending"),
    }


@app.get("/api/targets/{target_id}")
async def get_target(target_id: str):
    target = store.get_target(target_id)
    if not target:
        raise HTTPException(404, "Target not found")
    return target


@app.post("/api/targets")
async def create_target(data: TargetCreate, campaign_id: Optional[str] = Query(None)):
    target = store.create_target(data, campaign_id=campaign_id)
    await manager.broadcast({"type": "target.created", "data": target.model_dump()})
    return target


@app.put("/api/targets/{target_id}")
async def update_target(target_id: str, data: TargetCreate):
    target = store.update_target(target_id, data)
    if not target:
        raise HTTPException(404, "Target not found")
    await manager.broadcast({"type": "target.updated", "data": target.model_dump()})
    return target


@app.patch("/api/targets/{target_id}")
async def patch_target(target_id: str, updates: dict):
    target = store.patch_target(target_id, updates)
    if not target:
        raise HTTPException(404, "Target not found")
    await manager.broadcast({"type": "target.updated", "data": target.model_dump()})
    return target


@app.delete("/api/targets/{target_id}")
async def delete_target(target_id: str):
    ok = store.delete_target(target_id)
    if not ok:
        raise HTTPException(404, "Target not found")
    await manager.broadcast({"type": "target.deleted", "data": {"id": target_id}})
    return {"ok": True}


@app.post("/api/targets/bulk-import")
async def bulk_import(req: BulkImportRequest):
    result = store.bulk_import(req)
    await manager.broadcast({"type": "targets.bulk-import", "data": result.model_dump()})
    return result


# ═══════════════════════════════════════════════════════════════════
# Campaigns API (Phase 1)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/campaigns")
async def list_campaigns():
    return store.list_campaigns()


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    camp = store.get_campaign(campaign_id)
    if not camp:
        raise HTTPException(404, "Campaign not found")
    return camp


@app.post("/api/campaigns")
async def create_campaign(data: CampaignCreate):
    return store.create_campaign(data)


@app.put("/api/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignCreate):
    camp = store.update_campaign(campaign_id, data)
    if not camp:
        raise HTTPException(404, "Campaign not found")
    return camp


@app.delete("/api/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    ok = store.delete_campaign(campaign_id)
    if not ok:
        raise HTTPException(404, "Campaign not found")
    return {"ok": True}


@app.post("/api/campaigns/{campaign_id}/targets")
async def add_targets_to_campaign(campaign_id: str, target_ids: list[str]):
    ok = store.add_targets_to_campaign(campaign_id, target_ids)
    if not ok:
        raise HTTPException(404, "Campaign not found")
    return {"ok": True}


@app.delete("/api/campaigns/{campaign_id}/targets/{target_id}")
async def remove_target_from_campaign(campaign_id: str, target_id: str):
    ok = store.remove_target_from_campaign(campaign_id, target_id)
    if not ok:
        raise HTTPException(404, "Campaign or target not found in campaign")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════
# Recon API (Phase 2 — NetVision Integration)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/recon/summary")
async def recon_summary():
    """Aggregated recon status from NetVision."""
    if not nv_client:
        return {"error": "NetVision client not initialized", "netvision_reachable": False}
    try:
        summary = await nv_client.recon_summary()
        summary["netvision_reachable"] = True
        return summary
    except Exception as e:
        return {"error": str(e), "netvision_reachable": False}


@app.get("/api/recon/devices")
async def recon_devices():
    """All discovered devices from NetVision."""
    if not nv_client:
        return {"devices": [], "netvision_reachable": False}
    try:
        devices = await nv_client.devices()
        return {"devices": devices, "netvision_reachable": True}
    except Exception as e:
        return {"devices": [], "error": str(e), "netvision_reachable": False}


@app.get("/api/recon/scans")
async def recon_scans():
    """Scan history from NetVision."""
    if not nv_client:
        return {"scans": [], "netvision_reachable": False}
    try:
        scans = await nv_client.scan_history()
        return {"scans": scans, "netvision_reachable": True}
    except Exception as e:
        return {"scans": [], "error": str(e), "netvision_reachable": False}


@app.get("/api/recon/vulnerabilities")
async def recon_vulnerabilities():
    """Vulnerabilities found by NetVision."""
    if not nv_client:
        return {"vulnerabilities": [], "netvision_reachable": False}
    try:
        vulns = await nv_client.vulnerabilities()
        return {"vulnerabilities": vulns, "netvision_reachable": True}
    except Exception as e:
        return {"vulnerabilities": [], "error": str(e), "netvision_reachable": False}


@app.get("/api/recon/topology")
async def recon_topology():
    """Network topology graph data from NetVision."""
    if not nv_client:
        return {"netvision_reachable": False}
    try:
        topo = await nv_client.topology()
        topo["netvision_reachable"] = True
        return topo
    except Exception as e:
        return {"error": str(e), "netvision_reachable": False}


@app.get("/api/recon/correlation")
async def recon_correlation():
    """Network correlation summary (vendors, OS, ports)."""
    if not nv_client:
        return {"netvision_reachable": False}
    try:
        corr = await nv_client.correlation()
        corr["netvision_reachable"] = True
        return corr
    except Exception as e:
        return {"error": str(e), "netvision_reachable": False}


@app.post("/api/recon/scan")
async def trigger_recon_scan(target: Optional[str] = Query(None), profile: str = Query("quick")):
    """Trigger a scan via NetVision."""
    if not nv_client:
        return {"error": "NetVision not reachable", "netvision_reachable": False}
    try:
        result = await nv_client.trigger_scan(target=target, profile=profile)
        await manager.broadcast({"type": "scan.triggered", "data": result})
        return {"netvision_reachable": True, **result}
    except Exception as e:
        return {"error": str(e), "netvision_reachable": False}


@app.post("/api/recon/scan/stop")
async def stop_recon_scan():
    """Stop the active scan via NetVision."""
    if not nv_client:
        return {"error": "NetVision not reachable", "netvision_reachable": False}
    try:
        result = await nv_client.stop_scan()
        await manager.broadcast({"type": "scan.stopped", "data": result})
        return {"netvision_reachable": True, **result}
    except Exception as e:
        return {"error": str(e), "netvision_reachable": False}


# ═══════════════════════════════════════════════════════════════════
# Vulnerabilities API (Phase 3)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/vulnerabilities")
async def list_vulns(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    device: Optional[str] = Query(None),
    exploitability: Optional[str] = Query(None),
    has_exploit: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200),
):
    return vuln_store.list_vulns(
        severity=severity, status=status, service=service,
        device=device, exploitability=exploitability,
        has_exploit=has_exploit, search=search, limit=limit,
    )


@app.get("/api/vulnerabilities/stats")
async def vuln_stats():
    return vuln_store.stats()


@app.get("/api/vulnerabilities/{vuln_id}")
async def get_vuln(vuln_id: str):
    vuln = vuln_store.get_vuln(vuln_id)
    if not vuln:
        raise HTTPException(404, "Vulnerability not found")
    return vuln


@app.post("/api/vulnerabilities")
async def create_vuln(data: VulnCreate):
    vuln = vuln_store.create_vuln(data)
    await manager.broadcast({"type": "vuln.created", "data": vuln.model_dump()})
    return vuln


@app.patch("/api/vulnerabilities/{vuln_id}")
async def patch_vuln(vuln_id: str, patch: VulnPatch):
    vuln = vuln_store.patch_vuln(vuln_id, patch)
    if not vuln:
        raise HTTPException(404, "Vulnerability not found")
    await manager.broadcast({"type": "vuln.updated", "data": vuln.model_dump()})
    return vuln


@app.delete("/api/vulnerabilities/{vuln_id}")
async def delete_vuln(vuln_id: str):
    ok = vuln_store.delete_vuln(vuln_id)
    if not ok:
        raise HTTPException(404, "Vulnerability not found")
    await manager.broadcast({"type": "vuln.deleted", "data": {"id": vuln_id}})
    return {"ok": True}


@app.post("/api/vulnerabilities/sync")
async def sync_vulns():
    """Sync vulnerabilities from NetVision."""
    if not nv_client:
        return {"error": "NetVision not reachable", "synced": False}
    try:
        nv_vulns = await nv_client.vulnerabilities()
        result = await vuln_store.sync_from_netvision(nv_vulns)
        await manager.broadcast({"type": "vulns.sync", "data": result})
        return {**result, "synced": True}
    except Exception as e:
        return {"error": str(e), "synced": False}


# ═══════════════════════════════════════════════════════════════════
# Operations API (Phase 4)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/operations")
async def list_operations(
    operation_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50),
):
    return ops_store.list_operations(
        operation_type=operation_type, status=status,
        search=search, limit=limit,
    )


@app.get("/api/operations/stats")
async def operations_stats():
    return ops_store.stats()


@app.get("/api/operations/runbooks")
async def list_runbooks():
    """List all predefined runbook templates."""
    return [
        {
            "name": rb.name,
            "description": rb.description,
            "steps": [
                {"name": s.name, "operation_type": s.operation_type,
                 "description": s.description, "parameters": s.parameters}
                for s in rb.steps
            ],
        }
        for rb in RUNBOOKS
    ]


@app.get("/api/operations/{op_id}")
async def get_operation(op_id: str):
    op = ops_store.get_operation(op_id)
    if not op:
        raise HTTPException(404, "Operation not found")
    return op


@app.post("/api/operations")
async def create_operation(data: OperationCreate):
    """Create and optionally execute an operation."""
    op = ops_store.create_operation(data)

    # Auto-start execution for runnable types
    if data.operation_type == "scan":
        asyncio.create_task(
            ops_executor.execute_scan(op.id, data.parameters, data.target_ref or "")
        )
        ops_store.add_log(op.id, "info", "Scan operation created and dispatched")
    elif data.operation_type == "command":
        asyncio.create_task(
            ops_executor.execute_command(op.id, data.parameters, data.target_ref)
        )
        ops_store.add_log(op.id, "info", "Command operation created and dispatched")

    await manager.broadcast({"type": "operation.created", "data": op.id})
    return op


@app.get("/api/operations/{op_id}/logs")
async def get_operation_logs(op_id: str):
    logs = ops_store.get_logs(op_id)
    if not ops_store.get_operation(op_id):
        raise HTTPException(404, "Operation not found")
    return logs


@app.post("/api/operations/{op_id}/cancel")
async def cancel_operation(op_id: str):
    op = ops_store.cancel_operation(op_id)
    if not op:
        raise HTTPException(404, "Operation not found")
    await manager.broadcast({"type": "operation.cancelled", "data": op.id})
    return op


@app.delete("/api/operations/{op_id}")
async def delete_operation(op_id: str):
    ok = ops_store.delete_operation(op_id)
    if not ok:
        raise HTTPException(404, "Operation not found")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════
# Overview Dashboard (Hub Status)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/overview")
async def overview_dashboard():
    """Aggregates data from all stores and connected builds into a
    single hub dashboard payload."""
    # ── Connected builds / services ──────────────────────────────
    from services.intel_service import intel_store

    netvision = {"name": "NetVision", "status": "offline", "type": "recon"}
    if nv_client is not None:
        try:
            nv_health = await nv_client.health()
            netvision["status"] = nv_health.get("status", "offline") if nv_health else "offline"
            netvision["version"] = nv_health.get("version") if nv_health else None
        except Exception:
            netvision["status"] = "offline"

    services = [netvision]

    # ── Aggregate stats ──────────────────────────────────────────
    vulns = vuln_store.stats()
    ops_stats = ops_store.stats()
    intel_summary = intel_store.build_summary(
        vuln_store=vuln_store,
        ops_store=ops_store,
        netvision_status={"reachable": netvision["status"] != "offline"},
    )

    # ── Recent items ─────────────────────────────────────────────
    recent_ops = ops_store.list_operations(limit=6)
    recent_targets = store.list_targets()[:5] if store.list_targets() else []
    critical_vulns = vuln_store.list_vulns(severity="critical")[:5]
    high_vulns = vuln_store.list_vulns(severity="high")[:5]

    return {
        "services": services,
        "stats": {
            "total_targets": len(store.list_targets()),
            "total_vulnerabilities": vulns.get("total", 0),
            "critical_vulnerabilities": vulns.get("by_severity", {}).get("critical", 0),
            "high_vulnerabilities": vulns.get("by_severity", {}).get("high", 0),
            "operations_total": ops_stats.get("total", 0),
            "operations_running": ops_stats.get("by_status", {}).get("running", 0),
            "reports_count": intel_summary.get("report_count", 0),
            "risk_score": intel_summary.get("risk_score", 0),
        },
        "recent_operations": [
            {
                "id": o.id if hasattr(o, 'id') else (o.get('id') if isinstance(o, dict) else None),
                "title": getattr(o, 'title', None) or o.name if hasattr(o, 'name') else (o.get('title') if isinstance(o, dict) else None),
                "type": getattr(o, 'operation_type', None) or getattr(o, 'type', None),
                "status": getattr(o, 'status', None),
                "progress": getattr(o, 'progress', 0),
                "created_at": getattr(o, 'created_at', None),
            }
            for o in recent_ops
        ],
        "recent_targets": [
            {
                "id": t.id if hasattr(t, 'id') else (t.get('id') if isinstance(t, dict) else None),
                "target": getattr(t, 'target', None) or getattr(t, 'name', None) or getattr(t, 'ip_address', None),
                "type": getattr(t, 'type', None),
            }
            for t in recent_targets
        ],
        "critical_vulnerabilities": [
            {
                "id": getattr(v, 'id', None),
                "cve_id": getattr(v, 'cve_id', None),
                "title": getattr(v, 'title', None),
                "severity": getattr(v, 'severity', None),
                "cvss_score": getattr(v, 'cvss_score', None),
                "has_exploit": getattr(v, 'has_exploit', False),
                "affected_device": getattr(v, 'affected_device', None),
                "exploitability": getattr(v, 'exploitability', None),
            }
            for v in critical_vulns
        ],
        "high_vulnerabilities": [
            {
                "id": getattr(v, 'id', None),
                "cve_id": getattr(v, 'cve_id', None),
                "title": getattr(v, 'title', None),
                "severity": getattr(v, 'severity', None),
                "cvss_score": getattr(v, 'cvss_score', None),
                "has_exploit": getattr(v, 'has_exploit', False),
                "affected_device": getattr(v, 'affected_device', None),
            }
            for v in high_vulns
        ],
    }


# ═══════════════════════════════════════════════════════════════════
# Intelligence & Reporting API (Phase 5)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/intelligence/summary")
async def intel_summary():
    """Executive summary aggregating all data sources."""
    netvision_status = {"reachable": nv_client is not None and nv_client._token is not None}
    return intel_store.build_summary(
        vuln_store=vuln_store,
        ops_store=ops_store,
        netvision_status=netvision_status,
    )


@app.get("/api/intelligence/timeline")
async def intel_timeline(hours: int = Query(48)):
    """Security event timeline from all sources."""
    return intel_store.build_timeline(hours=hours)


@app.get("/api/intelligence/threats")
async def intel_threats():
    """Aggregated threat intelligence feed."""
    return intel_store.build_threat_feed()


@app.get("/api/osint")
async def osint_overview():
    """Aggregated OSINT intel across live sources: godseye adapters + threat feed."""
    tools_health = await registry.health_all()
    godseye_health = tools_health.get("godseye") or {}
    sources = []
    if godseye_health.get("available"):
        sources = [
            {
                "source": f"godseye:{name}",
                "status": "live",
                "action": name,
            }
            for name in (godseye_health.get("actions") or [])
        ]
    else:
        sources = [
            {
                "source": f"godseye:{name}",
                "status": godseye_health.get("status", "unavailable"),
                "action": name,
            }
            for name in (godseye_health.get("actions") or [])
        ]
    threats = intel_store.build_threat_feed()
    summary = intel_store.build_summary(
        vuln_store=vuln_store,
        ops_store=ops_store,
        netvision_status={"reachable": nv_client is not None and nv_client._token is not None},
    )
    return {
        "sources": sources,
        "threats": threats,
        "summary": summary,
    }


@app.get("/api/intelligence/export")
async def intel_export(format: str = Query("json")):
    """Export all Oblivion data."""
    return intel_store.export_data(
        format=format, vuln_store=vuln_store, op_store=ops_store,
    )


# ── Reports ────────────────────────────────────────────────────────

@app.get("/api/intelligence/reports")
async def list_reports(report_type: Optional[str] = Query(None)):
    return intel_store.list_reports(report_type=report_type)


@app.get("/api/intelligence/reports/definitions")
async def report_definitions():
    """List available report formats and their sections."""
    from services.intel_service import REPORT_FORMATS
    return REPORT_FORMATS


@app.get("/api/intelligence/reports/{report_id}")
async def get_report(report_id: str):
    report = intel_store.get_report(report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    return report


@app.get("/api/intelligence/reports/{report_id}/content")
async def get_report_content(report_id: str):
    content = intel_store.get_report_content(report_id)
    if not content:
        raise HTTPException(404, "Report not found")
    return content


@app.post("/api/intelligence/reports/generate")
async def generate_report(data: ReportCreate):
    """Generate a new report using current data from all stores."""
    report = intel_store.generate_report(
        data, vuln_store=vuln_store, ops_store=ops_store,
    )
    return report


@app.delete("/api/intelligence/reports/{report_id}")
async def delete_report(report_id: str):
    ok = intel_store.delete_report(report_id)
    if not ok:
        raise HTTPException(404, "Report not found")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════
# Entrypoint
# ═══════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════
# Tool Registry & Tool Actions API (Phase 1 — Multi-Tool Integration)
# ═══════════════════════════════════════════════════════════════════

@app.get("/tools/health")
async def tools_health():
    """Aggregate health across all registered tool adapters."""
    return await registry.health_all()


@app.get("/api/tools")
async def list_tools():
    """List all registered tools with live health + capabilities."""
    adapters_health = await registry.health_all()
    tools = []
    for name, health in sorted(adapters_health.items()):
        adapter = registry.get(name)
        tools.append({
            "name": name,
            "status": health.get("status", "unknown"),
            "available": health.get("available", health.get("status") == "available"),
            "connected": health.get("connected", False),
            "actions": adapter.get_actions() if adapter else [],
        })
    return tools


@app.get("/api/tools/{tool}/health")
async def get_tool_health(tool: str):
    adapter = get_adapter(tool)
    if adapter is None:
        raise HTTPException(404, f"Unknown tool: {tool}")
    return await adapter.health()


@app.post("/api/tools/{tool}/connect")
async def connect_tool(tool: str):
    adapter = get_adapter(tool)
    if adapter is None:
        raise HTTPException(404, f"Unknown tool: {tool}")
    connected = await adapter.connect()
    return {"name": tool, "connected": connected}


@app.delete("/api/tools/{tool}/disconnect")
async def disconnect_tool(tool: str):
    adapter = get_adapter(tool)
    if adapter is None:
        raise HTTPException(404, f"Unknown tool: {tool}")
    await adapter.disconnect()
    return {"name": tool, "disconnected": True}


@app.get("/api/tools/{tool}/actions")
async def get_tool_actions(tool: str):
    adapter = get_adapter(tool)
    if adapter is None:
        raise HTTPException(404, f"Unknown tool: {tool}")
    return {"name": tool, "actions": adapter.get_actions()}


class ToolExecuteRequest(BaseModel):
    action: str
    params: Optional[dict] = None
    target_ref: Optional[str] = None
    correlation_id: Optional[str] = None


@app.post("/api/tools/{tool}/execute")
async def execute_tool(tool: str, req: ToolExecuteRequest, response: Response):
    adapter = get_adapter(tool)
    if adapter is None:
        raise HTTPException(404, f"Unknown tool: {tool}")

    breaker = health_monitor.breaker(tool) if health_monitor else CircuitBreaker(tool)
    cacheable = req.action in CACHEABLE_ACTIONS
    cache_key = exec_cache.make_key(tool, req.action, req.params or {})
    cached = False

    try:
        if cacheable:
            async def compute():
                return await breaker.call(adapter.execute, req.action, req.params)

            result, cached = await exec_cache.get_or_create(
                cache_key, compute, ttl=60.0 if tool == "godseye" else 30.0
            )
        else:
            result = await breaker.call(adapter.execute, req.action, req.params)
    except CircuitOpen as exc:
        raise HTTPException(503, str(exc))

    response.headers["X-Cache"] = "HIT" if cached else "MISS"

    # Invalidate cached reads after a mutating action; skip duplicate fan-out on hits.
    if not cacheable:
        exec_cache.invalidate(tool)
    if not cached:
        # Normalize tool output into a canonical event and push through the bus
        # -> subscribers (WS fan-out, timeline, pipelines).
        await event_bus.emit(
            source_tool=tool,
            event_type=f"{tool}.{req.action}",
            payload={"action": req.action, "params": req.params or {}, "result": result},
            severity="info",
            title=f"{tool} {req.action}",
            target_ref=req.target_ref,
            correlation_id=req.correlation_id,
        )

        await manager.broadcast({
            "type": f"{tool}.executed",
            "data": {
                "tool": tool,
                "action": req.action,
                "params": req.params or {},
                "result": result,
                "target_ref": req.target_ref,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    return {"tool": tool, "action": req.action, "result": result, "cached": cached}


@app.get("/api/events")
async def api_events(
    limit: int = Query(100),
    source_tool: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
):
    """Unified cross-tool event timeline from the event bus."""
    events = event_bus.list_events(limit=limit, source_tool=source_tool, event_type=event_type)
    return {"events": [e.model_dump() for e in events]}


# ═══════════════════════════════════════════════════════════════════
# Autonomic Control Plane (self-monitoring / self-healing / efficiency)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/system/autonomy")
async def autonomy_status():
    snapshot = health_monitor.snapshot() if health_monitor else {"running": False}
    snapshot["exec_cache"] = exec_cache.stats()
    return snapshot


@app.post("/api/system/autonomy/recheck")
async def autonomy_recheck():
    if not health_monitor:
        raise HTTPException(503, "Autonomic monitor not running")
    return await health_monitor.check_all(force=True)


@app.post("/api/system/autonomy/recover/{tool}")
async def autonomy_recover(tool: str):
    if not health_monitor:
        raise HTTPException(503, "Autonomic monitor not running")
    result = await health_monitor.recover(tool)
    if result.get("error") == "Unknown tool":
        raise HTTPException(404, "Unknown tool")
    if result.get("recovered"):
        exec_cache.invalidate(tool)
    return result


@app.delete("/api/system/autonomy/cache")
async def autonomy_clear_cache():
    return {"invalidated": exec_cache.invalidate()}


# ═══════════════════════════════════════════════════════════════════
# Pipeline Orchestrator API (Phase 3 — Multi-Pipeline Infrastructure)
# ═══════════════════════════════════════════════════════════════════

from services.pipeline_service import (
    Pipeline,
    PipelineRun,
    PipelineStep,
    PipelineService,
    pipeline_service,
    register_builtin_pipelines,
)


class PipelineStepCreate(BaseModel):
    id: Optional[str] = None
    name: str
    tool: str
    action: str
    params: dict = {}
    depends_on: list = []
    condition: Optional[str] = None
    gate: bool = False


class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    steps: list[PipelineStepCreate] = []


@app.get("/api/pipelines")
async def list_pipelines():
    return {"pipelines": [p.model_dump() for p in pipeline_service.list_pipelines()]}


@app.get("/api/pipelines/runs")
async def list_pipeline_runs(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
):
    runs = pipeline_service.list_runs(status=status, limit=limit)
    return {"runs": [r.model_dump() for r in runs]}


@app.post("/api/pipelines")
async def create_pipeline(data: PipelineCreate):
    pipeline = Pipeline(
        name=data.name,
        description=data.description,
        steps=[PipelineStep(**{**s.model_dump(), "id": s.id or f"{data.name.replace(' ', '-').lower()}-{i}"}) for i, s in enumerate(data.steps)],
    )
    pipeline_service.register(pipeline)
    return pipeline.model_dump()


@app.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    pipeline = pipeline_service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")
    return pipeline.model_dump()


@app.delete("/api/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    ok = pipeline_service.pipelines.pop(pipeline_id, None) is not None
    return {"ok": ok}


@app.post("/api/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str):
    run = pipeline_service.create_run(pipeline_id=pipeline_id)
    if not run:
        raise HTTPException(404, "Pipeline not found")
    await pipeline_service.run(run.id)
    return {"run_id": run.id, "status": run.status}


@app.get("/api/pipelines/runs/{run_id}")
async def get_pipeline_run(run_id: str):
    run = pipeline_service.get_run(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")
    return run.model_dump()


@app.post("/api/pipelines/runs/{run_id}/approve")
async def approve_pipeline_run(run_id: str):
    run = pipeline_service.approve(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")
    if run.status == "running":
        await pipeline_service.run(run.id)
    return {"run_id": run.id, "status": run.status, "approved": True}


@app.delete("/api/pipelines/runs/{run_id}")
async def cancel_pipeline_run(run_id: str):
    run = pipeline_service.cancel(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")
    return {"run_id": run.id, "status": run.status}


# ═══════════════════════════════════════════════════════════════════
# Obsidian Integration API (server-side notes + JSON Canvas management)
# ═══════════════════════════════════════════════════════════════════

class ObsidianNoteWrite(BaseModel):
    path: str
    content: str
    mode: str = "overwrite"  # overwrite | append


class ObsidianNoteAppend(BaseModel):
    content: str
    mode: str = "append"


class ObsidianCanvasWrite(BaseModel):
    name: str
    canvas: dict = Field(default_factory=lambda: {"nodes": [], "edges": []})


class ObsidianNodeWrite(BaseModel):
    node: dict


class ObsidianEdgeWrite(BaseModel):
    edge: dict


class ObsidianCanvasGenerate(BaseModel):
    name: str = "Oblivion Pipeline Map.canvas"
    pipelines: list = []


class ObsidianReportExport(BaseModel):
    report_id: Optional[str] = None
    report: Optional[dict] = None


async def _emit_obsidian_event(action: str, result: dict) -> None:
    await event_bus.emit(
        source_tool="obsidian",
        event_type=f"obsidian.{action}",
        payload={"action": action, "result": result},
        severity="info",
        title=f"Obsidian {action.replace('_', ' ')}",
    )


@app.get("/api/obsidian/status")
async def obsidian_status():
    return obsidian_service.status()


@app.get("/api/obsidian/notes/search")
async def obsidian_search_notes(q: str = Query(""), limit: int = Query(20)):
    return {"results": obsidian_service.search_notes(q, limit)}


@app.get("/api/obsidian/notes")
async def obsidian_list_notes(folder: Optional[str] = Query(None)):
    return {"notes": obsidian_service.list_notes(folder)}


@app.get("/api/obsidian/notes/{path:path}")
async def obsidian_read_note(path: str):
    try:
        return obsidian_service.read_note(path)
    except FileNotFoundError:
        raise HTTPException(404, "Note not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/obsidian/notes")
async def obsidian_write_note(data: ObsidianNoteWrite):
    try:
        result = obsidian_service.write_note(data.path, data.content, data.mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await _emit_obsidian_event("note_write", result)
    return result


@app.patch("/api/obsidian/notes/{path:path}")
async def obsidian_append_note(path: str, data: ObsidianNoteAppend):
    try:
        result = obsidian_service.write_note(path, data.content, data.mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await _emit_obsidian_event("note_append", result)
    return result


@app.delete("/api/obsidian/notes/{path:path}")
async def obsidian_delete_note(path: str):
    try:
        result = obsidian_service.delete_note(path)
    except FileNotFoundError:
        raise HTTPException(404, "Note not found")
    except ValueError as e:
        raise HTTPException(400, str(e))
    await _emit_obsidian_event("note_delete", result)
    return result


@app.get("/api/obsidian/canvases")
async def obsidian_list_canvases():
    return {"canvases": obsidian_service.list_canvases()}


@app.post("/api/obsidian/canvases/generate")
async def obsidian_generate_canvas(data: ObsidianCanvasGenerate):
    pipelines = data.pipelines or [p.model_dump() for p in pipeline_service.list_pipelines()]
    try:
        result = obsidian_service.generate_pipeline_canvas(pipelines, data.name)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await _emit_obsidian_event("canvas_generate", result)
    return result


@app.get("/api/obsidian/canvases/{name}")
async def obsidian_read_canvas(name: str):
    try:
        return obsidian_service.read_canvas(name)
    except FileNotFoundError:
        raise HTTPException(404, "Canvas not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/obsidian/canvases")
async def obsidian_write_canvas(data: ObsidianCanvasWrite):
    try:
        result = obsidian_service.write_canvas(data.name, data.canvas)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await _emit_obsidian_event("canvas_write", result)
    return result


@app.post("/api/obsidian/canvases/{name}/nodes")
async def obsidian_add_canvas_node(name: str, data: ObsidianNodeWrite):
    try:
        result = obsidian_service.add_node(name, data.node)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(404 if isinstance(e, FileNotFoundError) else 400, str(e))
    await _emit_obsidian_event("canvas_add_node", result)
    return result


@app.post("/api/obsidian/canvases/{name}/edges")
async def obsidian_add_canvas_edge(name: str, data: ObsidianEdgeWrite):
    try:
        result = obsidian_service.add_edge(name, data.edge)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(404 if isinstance(e, FileNotFoundError) else 400, str(e))
    await _emit_obsidian_event("canvas_add_edge", result)
    return result


@app.post("/api/obsidian/reports/export")
async def obsidian_export_report(data: ObsidianReportExport):
    report = data.report
    if data.report_id:
        stored = intel_store.get_report(data.report_id)
        if not stored:
            raise HTTPException(404, "Report not found")
        report = stored.model_dump()
    if not report:
        raise HTTPException(400, "Provide report_id or report")
    try:
        result = obsidian_service.export_report_note(report)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await _emit_obsidian_event("report_export", result)
    return result


if __name__ == "__main__":
    import uvicorn
    # Port 8001 avoids conflict with NetVision (which runs on 8000)
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
