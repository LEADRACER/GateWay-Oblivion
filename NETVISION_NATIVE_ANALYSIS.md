# NetVision — Native Component Analysis

**Date:** 2026-11-21
**Scope:** `/home/dark00/Projects/NetVision` (own build, v5.0) and its integration into
GateWay:Oblivion (`/home/dark00/Projects/GateWay-Oblivion`).
**Verdict:** NetVision is the most mature and deeply featured node in the Oblivion stack — but it is
currently integrated as a *shallow external adapter* rather than a true native component. Four
concrete defects degrade the integration, and ~80% of its native capabilities are unused.

---

## 1. What NetVision actually is

| Aspect | Detail |
|---|---|
| Role | Local network discovery, health monitoring, vulnerability and packet-capture engine |
| Backend | FastAPI v5.0 (`backend/main.py`, 1,427 lines), SQLite + aiosqlite, JWT auth, role-based access |
| Frontend | Separate React/Vite app (`frontend/`) — its own dashboard |
| Scanning | `python-nmap`, profiles `quick / deep / security / custom`, traceroute, concurrency 16 |
| Autonomy | Priority scan queue with scheduler, auto-rescan on health transitions, NVD CVE correlation, alert webhooks |
| Capture | `scapy` + tshark, streaming analyzer, protocol decoder, traffic baseline, rogue AP detection |
| Observability | Prometheus metrics, request IDs, audit log, structured JSON logging, readiness probes |
| API surface | 30+ endpoints across auth, health, scan, devices, vulns, topology, correlation, capture, reports, audit, config |
| Transport | REST :8000 + WebSocket `/ws` (typed events, subscriptions, versioned state, heartbeats) |
| Security | JWT (admin/netvision default), roles OPERATOR/VIEWER/ADMIN, rate limiting, security headers, target validation |

### Native event vocabulary (WebSocket)
`scan.progress`, `scan.complete`, `scan.status`, `health.alert`, `vuln.found`,
`device.update`, `capture.data`, `capture.alert`, `subnet.start`
(`backend/websocket_manager.py:351-386`)

### Native data produced
Devices + ports + services, health metrics, vulnerabilities (CVE/CVSS), topology graph,
correlation (vendors/OS/ports), scan history + diff + schedules, capture talkers/DNS/TLS/HTTP logs,
anomalies, alerts, audit entries.

---

## 2. Current integration surface in Oblivion

| Touchpoint | File | What it does |
|---|---|---|
| Tool adapter | `backend/adapters/netvision.py` | 7 actions: `trigger_scan`, `stop_scan`, `devices`, `vulnerabilities`, `topology`, `correlation`, `recon_summary` |
| HTTP client | `backend/services/netvision_client.py` | JWT login/refresh, 15 methods, aggregates `recon_summary()` |
| WS bridge | `backend/services/ws_bridge.py` | Persistent WS to NetVision, forwards **raw** messages to Oblivion WS clients |
| Recon proxy endpoints | `backend/main.py:556-680` | 7 `/api/recon/*` endpoints calling `nv_client` directly |
| Vuln sync | `backend/main.py:717-750` | `vuln_store.sync_from_netvision(nv_vulns)` |
| Overview | `backend/main.py:855-870` | Reports NetVision status in `/api/overview` |
| Intel summary | `backend/main.py:924-932` | Uses `nv_client._token is not None` as "reachable" |
| Pipelines | `backend/services/pipeline_service.py` | Full Recon uses `netvision.trigger_scan` + `vulnerabilities` |
| Health monitor | `backend/services/resilience.py` | Probes via adapter health (see defect #3) |

---

## 3. Findings

### 🔴 Critical

**F1 — Scan parameters are silently ignored.**
`NetVisionClient.trigger_scan()` builds `{"profile": ..., "target": ...}` and passes it as a
**JSON body** (`netvision_client.py:86-90, 121-126`). NetVision's `POST /scan` reads `target`,
`profile`, `duration`, `priority` from **query parameters** (`NetVision/backend/main.py:493-497`).
NetVision therefore scans the **local subnet with its default `deep` profile**, ignoring the
operator's target/profile. This directly breaks the `Full Recon` and `Exploit Chain` runbooks.

**F2 — `/api/overview` always reports NetVision offline.**
`main.py:864` calls `nv_client.get("health")`, but `NetVisionClient` only exposes `_get()` and
`health()` — no `get()`. The `AttributeError` is swallowed and status becomes `"offline"` even
when NetVision is healthy.

### 🟠 High

**F3 — Health status is not normalized.**
NetVision `/health` returns `{"status": "ok"}` (`NetVision/backend/main.py:966-968`). The adapter
passes that value through unchanged (`netvision.py:25-28`), so `/api/tools` reports
`status: "ok"`. The Tools UI only treats `"available"` as online — **NetVision displays OFFLINE
even when healthy**. Additionally `out["base_url"] = ... or self.base_url` references an
attribute the adapter never defines (`netvision.py:16, 28`) — latent `AttributeError`.

**F4 — Live NetVision events bypass the canonical event bus.**
`NetVisionWSBridge` forwards raw NetVision messages directly to WS clients
(`ws_bridge.py:_forward_to_listeners`) and never calls `event_bus.emit()`. Consequently
`scan.progress`, `vuln.found`, `health.alert`, `capture.alert` never reach `/api/events`, the
unified timeline, or pipeline hooks — unlike every other tool's events.

**F5 — Hardcoded credentials and no configuration surface.**
`NetVisionClient(base_url="http://localhost:8000", username="admin", password="netvision")`
and `NetVisionWSBridge(url="ws://localhost:8000/ws")` are instantiated with defaults in
`main.py` / adapter; no env override. NetVision itself warns about its default JWT secret.

### 🟡 Medium

**F6 — Three competing data paths.** `/api/recon/*` proxies via `nv_client`, the tool adapter
exposes overlapping actions via `/api/tools/netvision/execute`, and `vuln_store` keeps a third copy
via `sync_from_netvision`. No single source of truth; no normalization into Oblivion's existing
`CanonicalHost / CanonicalService / CanonicalVulnerability` models.

**F7 — Errors are swallowed into empty payloads.** `_get()/_post()` return `{}` on any failure;
pipeline steps therefore "succeed" with empty results instead of failing/retrying, and the
autonomic circuit breaker cannot see tool failures.

**F8 — Fire-and-forget scans.** `trigger_scan` returns `enqueued` immediately with a `scan_id`,
but no pipeline step polls `/health/scan` or `/scan/history`, so downstream steps can read stale
device/vuln data.

**F9 — Liveness used as readiness.** The adapter health calls `/health` (always `ok`) instead of
`/health/ready` (checks DB, nmap, tshark), so a degraded NetVision (missing nmap/tshark) still
appears fully healthy.

**F10 — ~80% of native capability is unused.** Capture/streaming, rogue AP, service probes,
scan diff/schedule, CVE correlation endpoint, alerts, metrics and audit log are not exposed
through the adapter or dashboard.

### 🔵 Low

**F11 — Docs drift:** README badge says v4.2 while code declares v5.0. NetVision's own frontend
is a separate app, duplicating dashboard concerns with Oblivion.

---

## 4. Recommended native-integration design

```
                    ┌──────────────────────────────┐
 NetVision v5.0     │  REST /scan /devices /vulns   │
 (native engine)    │  WS typed events             │
                    └───────┬──────────────┬────────┘
                            │              │
              NetVisionClient (single path)  WS bridge
                            │              │
                    ┌───────▼──────────────▼────────┐
                    │ Native Normalizer             │
                    │ devices → CanonicalHost/Service│
                    │ vulns  → CanonicalVulnerability│
                    │ WS     → CanonicalEvent        │
                    └───────┬────────────────────────┘
                            │
                  event_bus → /api/events → timeline/WS
                            │
                  pipelines (scan lifecycle aware)
```

1. **One transport path** — make the adapter the only NetVision integration; rewrite `/api/recon/*`
   as thin wrappers over the adapter (or remove them).
2. **Native normalizer** — map NetVision payloads into Oblivion canonical entities; attach
   `source_tool="netvision"`, `external_id`, `confidence`.
3. **Event bridge** — translate every typed NetVision WS event into a `CanonicalEvent` on the bus;
   keep raw payload in `event.payload`.
4. **Scan lifecycle** — `trigger_scan` returns `scan_id`; add a pipeline step / helper that polls
   `/health/scan` and `/scan/history` until completion with timeout.
5. **Config** — `NETVISION_URL`, `NETVISION_WS_URL`, `NETVISION_USERNAME`, `NETVISION_PASSWORD`
   via environment; never ship default credentials into the adapter.
6. **Readiness-aware health** — combine `/health` (liveness) + `/health/ready` (deps) and emit
   `degraded` when nmap/tshark/DB checks fail.
7. **Surface native power** — expand adapter actions: `scan_queue`, `scan_history`, `scan_diff`,
   `scan_schedule`, `probe`, `correlate_vulns`, `capture_start/stop/status`, `top_talkers`,
   `anomalies`, `rogue_scan`, `audit_log`, `metrics`.

---

## 5. Prioritized action plan

| P | Action | Files | Effort |
|---|---|---|---|
| **P0** | Fix scan query params (F1), `/api/overview` `get()`→`health()` (F2), status normalization + `self.base_url` (F3) | `netvision_client.py`, `main.py`, `adapters/netvision.py` | ~30 min |
| **P1** | Route WS bridge typed events into event bus as CanonicalEvents (F4) | `services/ws_bridge.py`, `services/event_bus.py` | ~1 h |
| **P1** | Env-based config + readiness health (F5, F9) | adapter, client, ws_bridge | ~45 min |
| **P2** | Native normalizer + deprecate duplicate recon paths (F6, F7) | new `services/netvision_normalizer.py`, `main.py` | ~2 h |
| **P2** | Scan lifecycle helper for pipelines (F8) | `pipeline_service.py`, client | ~1 h |
| **P3** | Expose full native capability set (F10) | adapter, frontend | ~3 h |

**Bottom line:** NetVision is production-grade and should be treated as Oblivion's *native sensor
fabric*, not just another adapter. Fixing F1–F3 is required before any real pipeline run can be
trusted; P1–P2 turns it into a true first-class component feeding the canonical timeline.

### 2026-11-22 addendum — implemented
F1–F3 are fixed: scan params now travel as query parameters, `/api/overview` calls `health()`,
and the adapter normalizes NetVision's `ok` → `available`. JWT auth now uses a JSON body and
`sonar_scan` / `sonar_sensors` expose NetVision's modular discovery (including the privileged
bettercap bridge) through `/api/tools/netvision/execute`. Verified live: auth succeeds, scans
enqueue with the requested target, and the WS bridge connects.

### 2026-11-22 — Full native re-integration
NetVision is now a first-class subsystem with **41 controllable actions** and a dedicated control
plane: `GET /api/netvision/metrics` (parsed Prometheus), `GET /api/netvision/capabilities`,
`GET /api/netvision/events`, `GET /api/netvision/control`, `POST /api/netvision/control/{action}`.
Typed NetVision WebSocket events are normalized onto the canonical event bus as
`netvision.discovery.host`, `netvision.scan.*`, `netvision.health.alert`, etc. The dashboard
`/netvision` page exposes metric cards, subsystem readiness, and one-click sonar/bettercap/capture
controls. Verified live with the root bridge active: metrics reachable, 9 sensors, bettercap
LIVE, sonar runs and event fan-out working.
