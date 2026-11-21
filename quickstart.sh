#!/bin/bash
# GateWay:Oblivion — Enhancement Quick Start Script
# Run this after reviewing ENHANCEMENT_PLAN.md

set -e

PROJECT_ROOT="/home/dark00/Projects/GateWay-Oblivion"
cd "$PROJECT_ROOT"

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  GateWay:Oblivion — Enhancement Quick Start                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"

# Phase 0: Infrastructure
echo ""
echo "▶ Phase 0: Foundation Hardening"
echo "────────────────────────────────────────────────────────────────────────"

# 0.1-0.2: PostgreSQL + Alembic
echo "Setting up PostgreSQL schema..."
cat > backend/alembic.ini << 'EOF'
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/oblivion
[loggers]
keys = root,sqlalchemy,alembic
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
qualname =
[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine
[logger_alembic]
level = INFO
handlers =
qualname = alembic
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF

mkdir -p backend/alembic/versions
cat > backend/alembic/env.py << 'EOF'
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import store  # imports models
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
target_metadata = None  # Will use autogenerate
def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
EOF

# 0.3: Redis
echo "Adding Redis dependency..."
pip install redis hiredis --quiet 2>/dev/null || true

# Phase 1: Metasploit Client
echo ""
echo "▶ Phase 1: Metasploit Integration Skeleton"
echo "────────────────────────────────────────────────────────────────────────"

mkdir -p backend/services
cat > backend/services/msf_client.py << 'PYEOF'
"""
GateWay:Oblivion — Metasploit RPC Client
MsgPack-RPC over HTTP to msfrpcd
"""
import msgpack
import httpx
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger("oblivion.msf")


class MetasploitClient:
    def __init__(
        self,
        host: str = "localhost",
        port: int = 55553,
        username: str = "msf",
        password: str = "msf",
        ssl: bool = False,
        timeout: float = 30.0,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.ssl = ssl
        self.base_url = f"{'https' if ssl else 'http'}://{host}:{port}/api/"
        self._token: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=timeout)

    def _pack(self, method: str, *args) -> bytes:
        return msgpack.packb([method, *args], use_bin_type=True)

    async def _call(self, method: str, *args) -> Any:
        if not self._token:
            await self.authenticate()
        data = self._pack(method, self._token, *args)
        headers = {"Content-Type": "binary/message-pack"}
        resp = await self._client.post(self.base_url, content=data, headers=headers)
        if resp.status_code != 200:
            raise Exception(f"MSF RPC error: {resp.status_code} {resp.text}")
        result = msgpack.unpackb(resp.content, raw=False)
        if isinstance(result, list) and len(result) == 2:
            if result[0] == "error":
                raise Exception(f"MSF error: {result[1]}")
            return result[1]
        return result

    async def authenticate(self) -> str:
        data = self._pack("auth.login", self.username, self.password)
        headers = {"Content-Type": "binary/message-pack"}
        resp = await self._client.post(self.base_url, content=data, headers=headers)
        result = msgpack.unpackb(resp.content, raw=False)
        if isinstance(result, list) and result[0] == "error":
            raise Exception(f"MSF auth failed: {result[1]}")
        self._token = result[1] if isinstance(result, list) else result
        logger.info("Authenticated with Metasploit RPC")
        return self._token

    # Module operations
    async def module_search(self, query: str = "", mtype: str = None) -> List[Dict]:
        """Search modules. mtype: exploit, auxiliary, post, payload, encoder, nop"""
        modules = await self._call("module.exploits" if mtype == "exploit" else "module.all")
        if not query:
            return modules
        q = query.lower()
        return [m for m in modules if q in m.get("fullname", "").lower() or q in m.get("name", "").lower()]

    async def module_info(self, fullname: str) -> Dict:
        return await self._call("module.info", "exploit", fullname)

    async def module_options(self, mtype: str, fullname: str) -> Dict:
        return await self._call("module.options", mtype, fullname)

    # Exploit execution
    async def exploit_execute(
        self, module: str, target: str, payload: str, options: Dict = None
    ) -> Dict:
        opts = {"RHOSTS": target, "PAYLOAD": payload}
        if options:
            opts.update(options)
        job_id = await self._call("module.execute", "exploit", module, opts)
        return {"job_id": job_id, "module": module, "target": target}

    async def job_list(self) -> List[Dict]:
        return await self._call("job.list")

    async def job_stop(self, job_id: int) -> bool:
        return await self._call("job.stop", job_id)

    # Sessions
    async def session_list(self) -> List[Dict]:
        return await self._call("session.list")

    async def session_read(self, sid: int) -> str:
        return await self._call("session.read", sid)

    async def session_write(self, sid: int, data: str) -> int:
        return await self._call("session.write", sid, data)

    async def session_close(self, sid: int) -> bool:
        return await self._call("session.stop", sid)

    # Loot & Creds
    async def loot_list(self) -> List[Dict]:
        return await self._call("loot.list")

    async def creds_list(self) -> List[Dict]:
        return await self._call("creds.list")

    # Routes
    async def route_add(self, subnet: str, netmask: str, session: int) -> bool:
        return await self._call("session.route_add", session, subnet, netmask)

    async def close(self):
        await self._client.aclose()


# Singleton
msf_client = None

async def get_msf_client() -> MetasploitClient:
    global msf_client
    if msf_client is None:
        msf_client = MetasploitClient()
    return msf_client
PYEOF

echo "Created backend/services/msf_client.py"

# Phase 2: Recon-ng Wrapper
echo ""
echo "▶ Phase 2: Recon-ng Wrapper Skeleton"
echo "────────────────────────────────────────────────────────────────────────"

cat > backend/services/reconng_wrapper.py << 'PYEOF'
"""
GateWay:Oblivion — Recon-ng Wrapper Service
Communicates via recon-ng's JSON output mode
"""
import asyncio
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional

logger = logging.getLogger("oblivion.reconng")


class ReconNgWrapper:
    def __init__(self, workspace_dir: str = "/tmp/recon-ng-workspaces"):
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        self._recon_ng_path = self._find_recon_ng()

    def _find_recon_ng(self) -> str:
        # Try common locations
        for path in ["recon-ng", "/usr/local/bin/recon-ng", "/opt/recon-ng/recon-ng"]:
            try:
                result = subprocess.run([path, "--version"], capture_output=True, timeout=5)
                if result.returncode == 0:
                    return path
            except FileNotFoundError:
                continue
        raise RuntimeError("recon-ng not found. Install: pip install recon-ng")

    def _run_command(self, workspace: str, commands: List[str], json_output: bool = True) -> Dict:
        """Run recon-ng commands in a workspace"""
        ws_path = self.workspace_dir / workspace
        ws_path.mkdir(exist_ok=True)
        
        cmd_file = ws_path / "commands.rc"
        with open(cmd_file, "w") as f:
            f.write("\n".join(commands))
        
        args = [self._recon_ng_path, "-w", str(ws_path), "-r", str(cmd_file)]
        if json_output:
            args.extend(["-o", "json"])
        
        result = subprocess.run(args, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            logger.error(f"Recon-ng failed: {result.stderr}")
            raise Exception(f"Recon-ng error: {result.stderr}")
        
        if json_output:
            try:
                return json.loads(result.stdout) if result.stdout else {}
            except json.JSONDecodeError:
                return {"raw": result.stdout}
        return {"raw": result.stdout}

    async def workspace_create(self, name: str) -> str:
        # Just ensure directory exists
        (self.workspace_dir / name).mkdir(exist_ok=True)
        logger.info(f"Created workspace: {name}")
        return name

    async def workspace_list(self) -> List[Dict]:
        workspaces = []
        for ws in self.workspace_dir.iterdir():
            if ws.is_dir():
                workspaces.append({"name": ws.name, "path": str(ws)})
        return workspaces

    async def workspace_delete(self, name: str) -> bool:
        ws_path = self.workspace_dir / name
        if ws_path.exists():
            import shutil
            shutil.rmtree(ws_path)
            return True
        return False

    async def module_list(self, workspace: str, category: str = None) -> List[Dict]:
        cmds = ["modules search"]
        if category:
            cmds[0] += f" {category}"
        result = self._run_command(workspace, cmds)
        return result.get("modules", [])

    async def module_info(self, workspace: str, module: str) -> Dict:
        result = self._run_command(workspace, [f"use {module}", "info"])
        return result

    async def module_run(self, workspace: str, module: str, options: Dict = None) -> Dict:
        cmds = [f"use {module}"]
        if options:
            for k, v in options.items():
                cmds.append(f"set {k} {v}")
        cmds.append("run")
        return self._run_command(workspace, cmds)

    async def results_get(self, workspace: str, table: str = None) -> List[Dict]:
        cmds = ["show"]
        if table:
            cmds[0] += f" {table}"
        else:
            cmds[0] += " all"
        result = self._run_command(workspace, cmds)
        return result.get("results", [])

    async def results_export(self, workspace: str, format: str = "json") -> bytes:
        # recon-ng has built-in export
        cmds = [f"export {format} /tmp/recon_export.{format}"]
        self._run_command(workspace, cmds, json_output=False)
        export_path = Path(f"/tmp/recon_export.{format}")
        if export_path.exists():
            return export_path.read_bytes()
        return b""


# Singleton
reconng_wrapper = None

def get_reconng_wrapper() -> ReconNgWrapper:
    global reconng_wrapper
    if reconng_wrapper is None:
        reconng_wrapper = ReconNgWrapper()
    return reconng_wrapper
PYEOF

echo "Created backend/services/reconng_wrapper.py"

# Phase 3: GodsEye Proxy
echo ""
echo "▶ Phase 4: God's Eye View Proxy Skeleton"
echo "────────────────────────────────────────────────────────────────────────"

cat > backend/services/gev_proxy.py << 'PYEOF'
"""
GateWay:Oblivion — God's Eye View Proxy Service
Connects to GEV backend for globe data and geo-enrichment
"""
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
import httpx
import websockets

logger = logging.getLogger("oblivion.gev")


class GodsEyeProxy:
    def __init__(self, base_url: str = "http://localhost:8080", ws_url: str = "ws://localhost:8080/ws"):
        self.base_url = base_url.rstrip("/")
        self.ws_url = ws_url
        self._client = httpx.AsyncClient(timeout=30.0)
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._ws_task: Optional[asyncio.Task] = None
        self._listeners: List = []

    async def _get(self, path: str) -> Dict:
        try:
            resp = await self._client.get(f"{self.base_url}{path}")
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"GEV GET {path}: {resp.status_code}")
            return {}
        except Exception as e:
            logger.warning(f"GEV GET {path} error: {e}")
            return {}

    async def globe_state(self) -> Dict:
        """Get current globe state (aircraft, vessels, satellites, events)"""
        return await self._get("/api/globe/state")

    async def enrich_ip(self, ip: str) -> Dict:
        """Geo-enrich an IP address"""
        return await self._get(f"/api/enrich/{ip}")

    async def threat_feed(self) -> List[Dict]:
        """Get global threat feed"""
        result = await self._get("/api/threats")
        return result if isinstance(result, list) else result.get("threats", [])

    async def infrastructure(self) -> Dict:
        """Get infrastructure data (satellites, cables, datacenters)"""
        return await self._get("/api/infrastructure")

    async def ws_connect(self):
        """Establish WebSocket connection to GEV live feed"""
        if self._ws_task and not self._ws_task.done():
            return
        self._ws_task = asyncio.create_task(self._ws_run())

    async def _ws_run(self):
        reconnect_delay = 1
        while True:
            try:
                async with websockets.connect(self.ws_url) as ws:
                    self._ws = ws
                    reconnect_delay = 1
                    logger.info(f"Connected to GEV WebSocket at {self.ws_url}")
                    async for raw in ws:
                        try:
                            data = json.loads(raw)
                            await self._forward_to_listeners(data)
                        except json.JSONDecodeError:
                            pass
            except Exception as e:
                logger.warning(f"GEV WS disconnected: {e} (reconnect in {reconnect_delay}s)")
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)

    def add_listener(self, callback):
        self._listeners.append(callback)

    def remove_listener(self, callback):
        if callback in self._listeners:
            self._listeners.remove(callback)

    async def _forward_to_listeners(self, message: Dict):
        for listener in self._listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    await listener(message)
                else:
                    listener(message)
            except Exception as e:
                logger.warning(f"GEV listener error: {e}")

    async def close(self):
        if self._ws_task:
            self._ws_task.cancel()
        if self._ws:
            await self._ws.close()
        await self._client.aclose()


# Singleton
gev_proxy = GodsEyeProxy()
PYEOF

echo "Created backend/services/gev_proxy.py"

# Phase 4: Unified Operations Executor
echo ""
echo "▶ Phase 5: Unified Executor Skeleton"
echo "────────────────────────────────────────────────────────────────────────"

cat > backend/services/unified_executor.py << 'PYEOF'
"""
GateWay:Oblivion — Unified Cross-Tool Operation Executor
Orchestrates operations across NetVision, Metasploit, Recon-ng, GEV
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger("oblivion.executor")


@dataclass
class RunbookStep:
    name: str
    tool: str  # netvision, metasploit, recon-ng, gev, command
    action: str
    parameters: Dict[str, Any]
    depends_on: List[str] = None  # step names this depends on
    timeout: int = 300
    retry: int = 0


@dataclass
class Runbook:
    name: str
    description: str
    steps: List[RunbookStep]


class UnifiedExecutor:
    """Executes operations across all integrated tools"""
    
    def __init__(self, store, ws_manager=None):
        self.store = store
        self.ws_manager = ws_manager
        self._msf = None
        self._reconng = None
        self._nv = None
        self._gev = None

    async def _get_clients(self):
        if self._msf is None:
            from services.msf_client import get_msf_client
            self._msf = await get_msf_client()
        if self._reconng is None:
            from services.reconng_wrapper import get_reconng_wrapper
            self._reconng = get_reconng_wrapper()
        if self._nv is None:
            from services.netvision_client import NetVisionClient
            self._nv = NetVisionClient()
        if self._gev is None:
            from services.gev_proxy import gev_proxy
            self._gev = gev_proxy
            await self._gev.ws_connect()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def execute_scan(self, op_id: str, params: Dict, target_ref: str) -> None:
        """Execute scan via NetVision or Recon-ng"""
        self._log(op_id, "info", f"Starting scan on {target_ref}")
        profile = params.get("profile", "quick")
        tool = params.get("tool", "netvision")
        
        if tool == "netvision" and self._nv:
            await self._execute_netvision_scan(op_id, target_ref, profile)
        elif tool == "recon-ng" and self._reconng:
            await self._execute_reconng_scan(op_id, target_ref, params)
        else:
            raise ValueError(f"Unknown scan tool: {tool}")

    async def _execute_netvision_scan(self, op_id: str, target: str, profile: str):
        self._update_status(op_id, "running", progress=10)
        try:
            result = await self._nv.trigger_scan(target=target, profile=profile)
            self._log(op_id, "info", f"NetVision scan triggered: {result}")
            # Poll for completion
            for i in range(60):  # 5 min max
                await asyncio.sleep(5)
                status = await self._nv.scan_status()
                if not status.get("is_scanning"):
                    self._log(op_id, "result", "Scan completed")
                    self._update_status(op_id, "completed", progress=100)
                    return
                progress = 10 + (i * 1.5)
                self._update_status(op_id, "running", progress=min(progress, 90))
        except Exception as e:
            self._log(op_id, "error", f"Scan failed: {e}")
            self._update_status(op_id, "failed", result_summary=str(e))

    async def _execute_reconng_scan(self, op_id: str, target: str, params: Dict):
        # Run recon-ng modules for target
        workspace = f"scan_{uuid.uuid4().hex[:8]}"
        await self._reconng.workspace_create(workspace)
        self._update_status(op_id, "running", progress=10)
        
        modules = params.get("modules", ["recon/domains-hosts/brute_hosts", "recon/hosts-hosts/resolve"])
        for i, mod in enumerate(modules):
            self._log(op_id, "info", f"Running {mod}")
            try:
                await self._reconng.module_run(workspace, mod, {"SOURCE": target})
            except Exception as e:
                self._log(op_id, "warn", f"Module {mod} failed: {e}")
            progress = 10 + ((i + 1) / len(modules)) * 80
            self._update_status(op_id, "running", progress=progress)
        
        self._update_status(op_id, "completed", progress=100)

    async def execute_exploit(self, op_id: str, params: Dict, target_ref: str) -> None:
        """Execute exploit via Metasploit"""
        self._log(op_id, "info", f"Starting exploit on {target_ref}")
        module = params.get("module")
        payload = params.get("payload", "generic/shell_reverse_tcp")
        options = params.get("options", {})
        
        if not module:
            raise ValueError("Exploit module required")
        
        if not self._msf:
            await self._get_clients()
        
        try:
            result = await self._msf.exploit_execute(module, target_ref, payload, options)
            self._log(op_id, "info", f"Exploit job started: {result}")
            
            # Monitor job
            job_id = result.get("job_id")
            for i in range(120):  # 10 min max
                await asyncio.sleep(5)
                jobs = await self._msf.job_list()
                if not any(j.get("id") == job_id for j in jobs):
                    # Check for new session
                    sessions = await self._msf.session_list()
                    new_sessions = [s for s in sessions if target_ref in str(s)]
                    if new_sessions:
                        self._log(op_id, "result", f"Session opened: {new_sessions[0]}")
                    self._update_status(op_id, "completed", progress=100)
                    return
                progress = 10 + (i * 0.75)
                self._update_status(op_id, "running", progress=min(progress, 90))
        except Exception as e:
            self._log(op_id, "error", f"Exploit failed: {e}")
            self._update_status(op_id, "failed", result_summary=str(e))

    async def execute_recon(self, op_id: str, params: Dict, target_ref: str) -> None:
        """Execute reconnaissance via Recon-ng or NetVision"""
        tool = params.get("tool", "recon-ng")
        if tool == "recon-ng":
            await self._execute_reconng_scan(op_id, target_ref, params)
        else:
            await self.execute_scan(op_id, params, target_ref)

    async def execute_command(self, op_id: str, params: Dict, target_ref: Optional[str] = None) -> None:
        """Execute local command"""
        cmd = params.get("command", "echo")
        args = params.get("args", [])
        self._log(op_id, "info", f"Executing: {cmd} {' '.join(args)}")
        
        try:
            proc = await asyncio.create_subprocess_exec(
                cmd, *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=params.get("timeout", 60))
            output = stdout.decode() if stdout else stderr.decode() if stderr else "No output"
            self._log(op_id, "result", f"Exit {proc.returncode}: {output[:2000]}")
            self._update_status(op_id, "completed" if proc.returncode == 0 else "failed", 
                               progress=100, result_summary=f"Exit {proc.returncode}")
        except asyncio.TimeoutError:
            self._log(op_id, "error", "Command timed out")
            self._update_status(op_id, "failed", result_summary="Timeout")
        except Exception as e:
            self._log(op_id, "error", f"Command failed: {e}")
            self._update_status(op_id, "failed", result_summary=str(e))

    async def execute_runbook(self, op_id: str, runbook: Runbook) -> None:
        """Execute multi-step runbook with dependency resolution"""
        self._log(op_id, "info", f"Starting runbook: {runbook.name} ({len(runbook.steps)} steps)")
        
        completed = set()
        step_results = {}
        
        while len(completed) < len(runbook.steps):
            progress_made = False
            for step in runbook.steps:
                if step.name in completed:
                    continue
                
                deps = step.depends_on or []
                if all(d in completed for d in deps):
                    # Ready to execute
                    self._log(op_id, "info", f"Executing step: {step.name}")
                    try:
                        await self._execute_step(op_id, step, step_results)
                        completed.add(step.name)
                        progress_made = True
                    except Exception as e:
                        self._log(op_id, "error", f"Step {step.name} failed: {e}")
                        if step.retry > 0:
                            step.retry -= 1
                            self._log(op_id, "warn", f"Retrying {step.name} ({step.retry} left)")
                        else:
                            self._update_status(op_id, "failed", result_summary=f"Step {step.name} failed")
                            return
            
            if not progress_made:
                self._log(op_id, "error", "Deadlock: no steps can proceed")
                self._update_status(op_id, "failed", result_summary="Runbook deadlock")
                return
            
            progress = int((len(completed) / len(runbook.steps)) * 100)
            self._update_status(op_id, "running", progress=progress)
        
        self._log(op_id, "result", "Runbook completed successfully")
        self._update_status(op_id, "completed", progress=100)

    async def _execute_step(self, op_id: str, step: RunbookStep, results: Dict):
        if step.tool == "netvision" and step.action == "scan":
            await self.execute_scan(f"{op_id}_{step.name}", step.parameters, step.parameters.get("target", ""))
        elif step.tool == "metasploit" and step.action == "exploit":
            await self.execute_exploit(f"{op_id}_{step.name}", step.parameters, step.parameters.get("target", ""))
        elif step.tool == "recon-ng" and step.action == "recon":
            await self.execute_recon(f"{op_id}_{step.name}", step.parameters, step.parameters.get("target", ""))
        elif step.tool == "command":
            await self.execute_command(f"{op_id}_{step.name}", step.parameters)
        elif step.tool == "gev" and step.action == "enrich":
            if self._gev:
                result = await self._gev.enrich_ip(step.parameters.get("ip", ""))
                results[step.name] = result
        else:
            raise ValueError(f"Unknown step: {step.tool}.{step.action}")

    def _log(self, op_id: str, level: str, message: str, data: Dict = None):
        if hasattr(self.store, 'add_log'):
            self.store.add_log(op_id, level, message, data or {})

    def _update_status(self, op_id: str, status: str, progress: int = None, result_summary: str = None):
        if hasattr(self.store, 'update_status'):
            self.store.update_status(op_id, status, progress, result_summary)
        if self.ws_manager:
            asyncio.create_task(self.ws_manager.broadcast({
                "type": "operation.updated",
                "data": {"id": op_id, "status": status, "progress": progress}
            }))
PYEOF

echo "Created backend/services/unified_executor.py"

# Update main.py imports
echo ""
echo "▶ Updating backend/main.py with new service imports"
echo "────────────────────────────────────────────────────────────────────────"

# Add imports to main.py
cat >> backend/main.py << 'PYEOF'

# ═══════════════════════════════════════════════════════════════════
# NEW: Integration Services
# ═══════════════════════════════════════════════════════════════════

from services.msf_client import get_msf_client, MetasploitClient
from services.reconng_wrapper import get_reconng_wrapper, ReconNgWrapper
from services.gev_proxy import gev_proxy, GodsEyeProxy
from services.unified_executor import UnifiedExecutor, Runbook, RunbookStep

# Global clients
msf_client: Optional[MetasploitClient] = None
reconng_wrapper: Optional[ReconNgWrapper] = None
unified_executor: Optional[UnifiedExecutor] = None

# Update lifespan to init new clients
# (Add to existing lifespan function)
PYEOF

echo "Added imports to backend/main.py"

# Frontend: New integration pages
echo ""
echo "▶ Phase 6: Frontend Integration Pages"
echo "────────────────────────────────────────────────────────────────────────"

mkdir -p src/app/\(dashboard\)/msf
cat > src/app/\(dashboard\)/msf/page.tsx << 'TXTEOF'
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatCard, Badge } from '@/components/ui/primitives';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface MsfModule {
  fullname: string;
  name: string;
  rank: string;
  description: string;
  references: string[];
}

interface MsfSession {
  id: number;
  type: string;
  tunnel_local: string;
  tunnel_peer: string;
  via_exploit: string;
  via_payload: string;
  opened_at: string;
  info: string;
}

export default function MsfPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'modules' | 'sessions' | 'loot' | 'creds'>('modules');
  
  const { data: modulesData, isLoading: modulesLoading } = useQuery({
    queryKey: ['msf', 'modules', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/api/msf/modules?${params}`);
      return res.json();
    },
    enabled: tab === 'modules',
  });
  
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['msf', 'sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/msf/sessions`);
      return res.json();
    },
    enabled: tab === 'sessions',
    refetchInterval: 5000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Metasploit Console</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Module search, session management, loot & credentials
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {['modules', 'sessions', 'loot', 'creds'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`font-mono text-[10px] tracking-widest px-4 py-2 border-b-2 transition-colors ${
              tab === t
                ? 'text-accent border-accent'
                : 'text-text-muted border-transparent hover:text-text'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'modules' && (
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules (CVE, name, platform)..."
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-64 mb-4"
          />
          {modulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            </div>
          ) : (
            <div className="grid gap-3">
              {modulesData?.slice(0, 50).map((m: MsfModule) => (
                <Link
                  key={m.fullname}
                  href={`/msf/modules/${encodeURIComponent(m.fullname)}`}
                  className="group border border-border bg-surface p-4 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-text truncate">{m.fullname}</div>
                      <div className="font-mono text-[9px] text-text-dim truncate mt-1">{m.description}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="accent">{m.rank}</Badge>
                        {m.references?.slice(0, 3).map((r: string) => (
                          <Badge key={r} variant="muted" size="xs">{r}</Badge>
                        ))}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-accent shrink-0">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'sessions' && (
        <div>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            </div>
          ) : sessionsData?.length === 0 ? (
            <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-3">
              <span className="font-mono text-xs text-text-dim">No active sessions</span>
              <Link href="/operations/new" className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110">
                LAUNCH EXPLOIT
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {sessionsData.map((s: MsfSession) => (
                <div key={s.id} className="border border-border bg-surface p-4 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                  <div>
                    <div className="font-mono text-sm text-text">{s.type} · {s.via_exploit}</div>
                    <div className="font-mono text-[9px] text-text-dim">{s.tunnel_peer} → {s.tunnel_local}</div>
                  </div>
                  <span className="font-mono text-[9px] tracking-widest text-accent border border-accent/30 px-2 py-1">
                    SESSION {s.id}
                  </span>
                  <Link
                    href={`/msf/sessions/${s.id}`}
                    className="font-mono text-[10px] tracking-widest text-text-dim hover:text-accent"
                  >
                    INTERACT →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
TXTEOF

echo "Created src/app/(dashboard)/msf/page.tsx"

# Recon-ng page
mkdir -p src/app/\(dashboard\)/recon-ng
cat > src/app/\(dashboard\)/recon-ng/page.tsx << 'TXTEOF'
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatCard, Badge } from '@/components/ui/primitives';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function ReconNgPage() {
  const [workspace, setWorkspace] = useState('');
  const [newWorkspace, setNewWorkspace] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');

  const { data: workspacesData } = useQuery({
    queryKey: ['reconng', 'workspaces'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/recon-ng/workspaces`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: modulesData } = useQuery({
    queryKey: ['reconng', 'modules', workspace, moduleSearch],
    queryFn: async () => {
      if (!workspace) return { modules: [] };
      const params = new URLSearchParams();
      if (moduleSearch) params.set('search', moduleSearch);
      const res = await fetch(`${API_BASE}/api/recon-ng/workspaces/${workspace}/modules?${params}`);
      return res.json();
    },
    enabled: !!workspace,
  });

  const createWorkspace = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_BASE}/api/recon-ng/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      return res.json();
    },
    onSuccess: () => setNewWorkspace(''),
  });

  const runModule = useMutation({
    mutationFn: async ({ ws, module, options }: { ws: string; module: string; options: any }) => {
      const res = await fetch(`${API_BASE}/api/recon-ng/workspaces/${ws}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, options }),
      });
      return res.json();
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Recon-ng Workspaces</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            OSINT workspaces, module marketplace, automated reconnaissance
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={newWorkspace}
            onChange={e => setNewWorkspace(e.target.value)}
            placeholder="New workspace name..."
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-44"
          />
          <button
            onClick={() => createWorkspace.mutate(newWorkspace)}
            disabled={createWorkspace.isPending || !newWorkspace}
            className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            CREATE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <div className="border border-border bg-surface p-4">
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Workspaces</h2>
          <div className="flex flex-col gap-2">
            {workspacesData?.map((ws: any) => (
              <button
                key={ws.name}
                onClick={() => setWorkspace(ws.name)}
                className={`text-left px-3 py-2 rounded font-mono text-xs transition-colors ${
                  workspace === ws.name
                    ? 'bg-accent-bg text-accent'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                {ws.name}
              </button>
            ))}
            {!workspacesData?.length && (
              <span className="font-mono text-[10px] text-text-dim">No workspaces</span>
            )}
          </div>
        </div>

        <div>
          {workspace ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
                  Modules in {workspace}
                </h2>
                <input
                  value={moduleSearch}
                  onChange={e => setModuleSearch(e.target.value)}
                  placeholder="Filter modules..."
                  className="bg-bg border border-border px-3 py-1.5 font-mono text-[10px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-48"
                />
              </div>
              <div className="grid gap-2">
                {modulesData?.modules?.slice(0, 50).map((m: any) => (
                  <button
                    key={m.name}
                    onClick={() => runModule.mutate({ ws: workspace, module: m.name, options: {} })}
                    disabled={runModule.isPending}
                    className="border border-border bg-surface p-3 text-left hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <div className="font-mono text-xs text-text">{m.name}</div>
                    <div className="font-mono text-[9px] text-text-dim mt-1">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-3">
              <span className="font-mono text-xs text-text-dim">Select or create a workspace</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
TXTEOF

echo "Created src/app/(dashboard)/recon-ng/page.tsx"

# GEV page
mkdir -p src/app/\(dashboard\)/gev
cat > src/app/\(dashboard\)/gev/page.tsx << 'TXTEOF'
'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/primitives';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function GEVPage() {
  const [globeUrl, setGlobeUrl] = useState('http://localhost:8080');
  
  const { data: threatsData } = useQuery({
    queryKey: ['gev', 'threats'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/gev/threats`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: infraData } = useQuery({
    queryKey: ['gev', 'infrastructure'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/gev/infrastructure`);
      return res.json();
    },
    refetchInterval: 300000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">God's Eye View</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Global threat intelligence & spatial awareness
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={globeUrl}
            onChange={e => setGlobeUrl(e.target.value)}
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-64"
            placeholder="GEV URL (default: http://localhost:8080)"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-6">
        <div className="border border-border bg-surface">
          <iframe
            src={`${globeUrl}/?embed=true`}
            className="w-full h-[70vh] border-0"
            title="God's Eye View Globe"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="border border-border bg-surface p-4">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Global Threats</h2>
            {threatsData?.map((t: any, i: number) => (
              <div key={i} className="py-2 border-b border-border/50 last:border-b-0">
                <div className="font-mono text-xs text-text">{t.title}</div>
                <div className="font-mono text-[9px] text-text-dim">{t.source} · {t.severity}</div>
              </div>
            ))}
          </div>

          <div className="border border-border bg-surface p-4">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Infrastructure</h2>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-text-dim">Satellites</span>
                <span className="font-mono text-[10px] text-text">{infraData?.satellites?.length ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-text-dim">Subsea Cables</span>
                <span className="font-mono text-[10px] text-text">{infraData?.cables?.length ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-text-dim">Datacenters</span>
                <span className="font-mono text-[10px] text-text">{infraData?.datacenters?.length ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
TXTEOF

echo "Created src/app/(dashboard)/gev/page.tsx"

# Update SideNav
echo ""
echo "▶ Updating SideNav with new navigation items"
echo "────────────────────────────────────────────────────────────────────────"

cat > src/components/layout/SideNav.tsx << 'TXTEOF'
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/stores/operations';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/', icon: <GridIcon /> },
  { label: 'Recon', href: '/recon', icon: <SatelliteIcon /> },
  { label: 'Targets', href: '/targets', icon: <CrosshairsIcon /> },
  { label: 'Scans', href: '/scans', icon: <RadarIcon /> },
  { label: 'Vulnerabilities', href: '/vulnerabilities', icon: <BugIcon /> },
  { label: 'Operations', href: '/operations', icon: <TerminalIcon /> },
  { label: 'Intelligence', href: '/intelligence', icon: <ChipIcon /> },
  { label: 'Metasploit', href: '/msf', icon: <TerminalIcon /> },
  { label: 'Recon-ng', href: '/recon-ng', icon: <SatelliteIcon /> },
  { label: "God's Eye", href: '/gev', icon: <GlobeIcon /> },
];

export function SideNav() {
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={`fixed left-0 top-12 bottom-0 z-30 border-r border-border bg-surface transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="flex flex-col py-3 gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 mx-2 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-accent-bg text-accent'
                  : 'text-text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="font-mono text-xs tracking-wide">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="5" height="5" rx="0.5" />
      <rect x="8" y="1" width="5" height="5" rx="0.5" />
      <rect x="1" y="8" width="5" height="5" rx="0.5" />
      <rect x="8" y="8" width="5" height="5" rx="0.5" />
    </svg>
  );
}

function SatelliteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2" />
      <path d="M3.5 3.5l1.5 1.5M9 9l1.5 1.5" strokeDasharray="1 1" />
    </svg>
  );
}

function CrosshairsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 1v3M7 10v3M1 7h3M10 7h3" strokeLinecap="round" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 7 10 4M7 7l-4-1" strokeLinecap="round" />
      <path d="M7 2a5 5 0 0 1 5 5" strokeDasharray="1 1" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 3.5a2 2 0 0 1 4 0V5a2 2 0 0 1-4 0z" />
      <path d="M3 7h8M4 5l-2-2M10 5l2-2M4 9l-2 2M10 9l2 2" />
      <path d="M7 7v5" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="m4 5 2.5 2L4 9M8 9h2" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <path d="M5 1v2M9 1v2M5 11v2M9 11v2M1 5h2M1 9h2M11 5h2M11 9h2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="6" />
      <path d="M7 1v12M1 7h12" strokeDasharray="2 2" />
      <path d="M7 7a3 3 0 0 1 0-6" strokeDasharray="2 2" />
    </svg>
  );
}
TXTEOF

echo "Updated src/components/layout/SideNav.tsx"

# Requirements
echo ""
echo "▶ Adding Python dependencies"
echo "────────────────────────────────────────────────────────────────────────"

cat >> backend/requirements.txt << 'TXTEOF'

# Integration dependencies
msgpack==1.0.8
websockets==12.0
httpx==0.27.0
redis==5.0.1
alembic==1.13.1
psycopg2-binary==2.9.9
sqlalchemy==2.0.32
asyncpg==0.29.0
TXTEOF

echo "Updated backend/requirements.txt"

# Final summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  Quick Start Complete!                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Created files:"
echo "  📄 ENHANCEMENT_PLAN.md          - Full analysis & roadmap"
echo "  📄 backend/services/msf_client.py      - Metasploit RPC client"
echo "  📄 backend/services/reconng_wrapper.py - Recon-ng wrapper"
echo "  📄 backend/services/gev_proxy.py       - God's Eye View proxy"
echo "  📄 backend/services/unified_executor.py - Cross-tool executor"
echo "  📄 src/app/(dashboard)/msf/page.tsx    - Metasploit UI"
echo "  📄 src/app/(dashboard)/recon-ng/page.tsx - Recon-ng UI"
echo "  📄 src/app/(dashboard)/gev/page.tsx    - God's Eye View UI"
echo "  📄 Updated SideNav.tsx with new nav items"
echo ""
echo "Next steps:"
echo "  1. cd backend && pip install -r requirements.txt"
echo "  2. Install Metasploit: msfrpcd -P msf -S"
echo "  3. Install Recon-ng: pip install recon-ng"
echo "  4. Run God's Eye View: cd gods-eye-view && npm ci && npm run dev"
echo "  5. Start Oblivion: python3 backend/main.py && npm run dev"
echo ""
echo "API endpoints to implement in main.py:"
echo "  /api/msf/modules, /api/msf/sessions, /api/msf/exploit"
echo "  /api/recon-ng/workspaces, /api/recon-ng/workspaces/{id}/run"
echo "  /api/gev/threats, /api/gev/infrastructure, /api/gev/enrich/{ip}"
echo "  /api/operations/runbook (unified executor)"