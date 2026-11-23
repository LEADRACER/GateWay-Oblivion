# 🛰️ Oblivion — Multi-Tool Integration & Upgrade Plan

> **Goal:** Turn Oblivion into the unified command dashboard that **pipes the entire workflow and communication** between **NetVision** (your own scanner engine), **Metasploit**, **Recon-ng**, and **God's Eye View** (the popular `bilawalsidhu/gods-eye-view` repo) — with the Next.js website as the central operational hub.

**Project:** `/home/dark00/Projects/GateWay-Oblivion`
**Status baseline:** audited 2026-11-21

---

## 1. Objective

Oblivion should become the **single pane of glass** and **orchestrator** for the full
offensive/recon lifecycle:

```
Recon-ng (recon / OSINT modules) → NetVision (scan / vulns / topology)
      → Metasploit (exploit / post-exploit / sessions / loot)
      → God's Eye View (live world intel: aircraft, vessels, satellites, CCTV, weather…)
      → Intelligence report → Dashboard timeline / war room
```

Oblivion does not need to *be* each tool. It **consumes** their outputs, **normalizes**
them into a canonical model, **pipes** events through a bus, **executes** orchestrated
pipelines, and **displays/records** everything in the UI.

---

## 2. Verified Current State (audit findings)

### 2.1 What already exists and works

| Layer | State | Evidence |
|---|---|---|
| NetVision API client | ✅ Complete | `backend/services/netvision_client.py` (auth token, scan, devices, vulns, topology, correlation, capture, recon_summary) |
| NetVision WebSocket bridge | ✅ Complete | `backend/services/ws_bridge.py` (reconnect w/ backoff, listener fan-out) |
| NetVision adapter actions | ✅ Partial | `backend/adapters/netvision.py` (`trigger_scan`, `stop_scan`, `devices`, `vulnerabilities`, `topology`, `correlation`, `recon_summary`) |
| NetVision-driven backend APIs | ✅ Present | `/api/recon/*`, `/api/vulnerabilities`, `/api/overview`, `/api/intelligence/*` |
| Tool base adapter + NetVision | ✅ | `backend/adapters/base.py`, `backend/adapters/netvision.py` |
| Operations store + runbooks (scans/commands) | ✅ Partial | `backend/services/operations_service.py` (`scan`, `command`, `runbook`, `manual` types) |
| Frontend hooks (TanStack Query + WS) | ✅ Present | `src/hooks/use*.ts` |
| Frontend pages (dashboard, recon, targets, scans, vulns, operations, intelligence, tools…) | ✅ Present | `src/app/(dashboard)/**/` |
| Plans (integration / enhancement / debug) | ✅ Present | `INTEGRATION_PLAN.md`, `ENHANCEMENT_PLAN.md`, `DEBUG_PLAN.md` |

### 2.2 What is stub / partial / missing (the actual upgrade surface)

| Layer | State | Gap |
|---|---|---|
| **Metasploit adapter** | 🔴 Stub | `health()` = `shutil.which`; `connect()` → `False`; `execute()` → `NotImplementedError` |
| **Recon-ng adapter** | 🔴 Stub | Same pattern — CLI detection only, no execution |
| **God's Eye View adapter** | 🔴 Stub | `health()` = filesystem dir check; `execute()` → `NotImplementedError` |
| **Canonical data model** | 🔴 Skeleton | Only `CanonicalTarget`, `CanonicalFinding` — no Host/Service/Session/Artifact/Event/credential entities |
| **Event bus** | 🟡 Partial | In-process **sync** pub/sub; no async fan-out to WS manager/timeline/audit; no normalized event envelope |
| **Pipeline service** | 🟡 Skeleton | `Pipeline`, `PipelineStep`, `PipelineService.register` exist — **no executor, no runbooks wired to adapters** |
| **Backend API** | 🟡 Partial | Missing: full `/api/tools/*`, `/api/pipelines/*`, `/api/events`, `/api/audit` endpoints |
| **Frontend `/tools` page** | 🔴 Static stub | Hardcoded 4 cards with fake statuses |
| **Frontend TopBar** | 🔴 Hardcoded | `WS CONNECTED` static — no real status |
| **Frontend OSINT / globe page** | 🔴 Missing | No route for God's Eye View data |
| **Frontend Pipelines page** | 🔴 Missing | No route to launch/manage pipelines |
| **Persistence** | 🔴 Missing | All stores in-memory — event/timeline persistence not wired |

---

## 3. Target Architecture (upgrade design)

### 3.1 Tool Adapter Layer — `backend/adapters/`

Common contract (exists in `base.py`, to be completed):

```python
class ToolAdapter(ABC):
    name: str
    async def health(self) -> dict
    async def connect(self) -> bool
    async def disconnect(self) -> None
    async def execute(self, action: str, params: dict | None = None) -> dict
    async def stream_events(self) -> AsyncIterator[dict]
    def normalize_result(self, raw) -> CanonicalEvent
```

Refactor into a **registry** (`backend/adapters/registry.py`) that owns live adapter
instances (no per-request instantiation in `/tools/health`).

#### NetVision adapter (refactor of existing)
- Actions: `health`, `connect`, `disconnect`, `trigger_scan`, `stop_scan`, `scan_history`,
  `scan_queue`, `devices`, `vulnerabilities`, `topology`, `correlation`, `recon_summary`,
  `capture_status`, `top_talkers`, `geolocation`, `rogue_scan`, `reports`, `probes`.
- Results normalized → canonical vulnerability/host events.

#### Metasploit adapter (to implement)
- **Transport A (preferred):** native RPC — Metasploit `msf-server` on `127.0.0.1:55553`
  (JSON-RPC over msgpack). Capabilities: version, sessions (list/stop), modules (search/list),
  exploits (search/list), events.
- **Transport B (fallback):** `msfconsole -x "<command chain>"` / `--script` subprocess.
  Command chains example: `use <module>\nset RHOSTS <ip>\nexploit` / `sessions -l`.
- Actions: `health`, `sessions_list`, `sessions_kill`, `modules_search`, `exploits_search`,
  `module_info`, `use_module`, `run_module`, `post_run`, `events`.
- Event types to emit: `session.created`, `session.terminated`, `module.started`,
  `module.finished`, `exploit.result`.

#### Recon-ng adapter (to implement)
- **Transport:** subprocess `recon-ng -W <workspace>` with stdin command list.
  Commands: `module: search <q>`, `module: use <m>`, `run`, `show hosts`, `show vulns`,
  `show contacts`, `show credentials`, `show services`.
- Actions: `health`, `workspace_list`, `workspace_create`, `module_search`, `module_use`,
  `module_run`, `show_hosts`, `show_vulns`, `show_contacts`, `show_credentials`.

#### God's Eye View adapter (to implement)
- **Transport:** MCP stdio server (`server/mcp/stdio.js`, JSON-RPC newline-delimited,
  `npm run mcp -- --api-base http://localhost:4173`) spawned from Python (MCP stdio client),
  **or** direct HTTP to the running God's Eye View app API (its tools read relative
  `/api/...` paths resolved against `apiBase`).
- Actions from God's Eye View core tool set: `getEarthquakes`, `getActiveFires`, `getRecentLaunches`,
  `aircraftInArea` / `findAircraft` / `getAircraftTrack` / `getAircraftInfo`,
  `vesselsInArea` / `findVessel` / `getVesselTrack`, `satellitesOverhead` / `nextSatellitePass`,
  `findCctvCameras` / `getCctvSnapshot`, `findAlprCameras`, `findRadioStations`,
  `searchPlaces` / `placesNearby` / `planRoute`, `getWeather` / `getWeatherMap` / `getWind`,
  `getRecentImagery`, `findSubmarineCables`, `findInfrastructure`, `findMilitaryInstallations`,
  `getMapFeatures`, `situationBrief`, `militaryAwareness`, `showInGodsEyeView`, `panelRequest`.
- Emit events: `geo.entity.seen`, `intel.brief.generated`, etc.

### 3.2 Canonical Data Model — `backend/models/canonical.py`

Expand to real entities (all carrying `source_tool`, `external_id`, `confidence`):

- `CanonicalEvent` — id, ts, source_tool, source_event_id, type, severity, payload, correlation_id
- `CanonicalTarget` — (existing) + `source_tool`, `external_id`
- `CanonicalHost` — ip, mac, vendor, os, source_tool, external_id
- `CanonicalService` — host, port, proto, service, version, source_tool
- `CanonicalVulnerability` — cve_id, severity, cvss, affected_host, source_tool, external_id, exploit_available, remediation
- `CanonicalCredential` — source, type, value_ref, host, source_tool
- `CanonicalSession` — session_id, exploit_module, msf_session_id, target, state, source_tool
- `CanonicalArtifact` — name, kind, size, sha256, path, source_tool
- `CanonicalFinding` — links vuln + evidence + confidence → severity score

### 3.3 Event Bus / Workflow Piping — `backend/services/event_bus.py`

- Convert to **async** pub/sub (asyncio queue + fan-out callbacks) — or keep simple object but async publish.
- Every adapter emits normalized `CanonicalEvent`s:
  - NetVision WS bridge events → normalize → bus
  - Metasploit session/module events → bus
  - Recon-ng module/host/vuln events → bus
  - God's Eye View intel events → bus
- Bus fans out to: WebSocket manager (frontend live feed), timeline store, audit log.

### 3.4 Pipeline Orchestrator — `backend/services/pipeline_service.py`

- `Pipeline` = `{name, description, steps: [{id, name, tool, action, params, depends_on[], condition?, gate?}]}`
- Executor: run steps in order; pass previous step normalized outputs into next step params;
  support conditional branching (`condition` on findings); **destructive steps require human-in-the-loop gate**.
- Runbooks (upgrading existing 5 in operations service):
  1. `full-recon` — Recon-ng OSINT → NetVision scan → vulns sync → intel summary
  2. `recon-to-exploit` — NetVision critical vulns w/ exploit → Metasploit exploit → post-exploit → loot → capture → report
  3. `osint-enrichment` — God's Eye View entities near geo-located target → intel
  4. `web-vuln-sweep` — Recon-ng web modules → NetVision deep/security scan → vulns
  5. `threat-report` — aggregate → report generation

### 3.5 Backend API additions

```
GET    /api/tools
GET    /api/tools/{tool}/health
POST   /api/tools/{tool}/connect
DELETE /api/tools/{tool}/disconnect
GET    /api/tools/{tool}/actions
POST   /api/tools/{tool}/execute          {tool, action, params, target_ref?, correlation_id?}
GET    /api/pipelines
POST   /api/pipelines/{id}/run
GET    /api/pipelines/{id}/status
DELETE /api/pipelines/{id}/cancel
GET    /api/events?source=&tool=&type=&limit=
GET    /api/audit
```

### 3.6 Frontend additions

- `/tools` — live health polling, per-tool action console, connect/disconnect, capabilities.
- `/osint` (new) — God's Eye View globe panel / live entities near tracked targets.
- `/pipelines` (new) — runbook runner UI, live step progress, logs, timeline.
- Timeline — unify from event bus across tools.
- TopBar — real WS status + tool health chips.

---

## 4. Per-Tool Integration Specification

### 4.1 NetVision — ✅ integrated (consume mode)
- Base: `http://localhost:8000` (Oblivion backend on `:8001`).
- Flow: adapter → client → REST + WS bridge → normalize → canonical → UI/timeline/report.
- **Upgrade needed:** adapter action parity for capture/rogue/probes/reports; expose via tools API.

### 4.2 Metasploit — 🔴 to build
- Local: `msfconsole` (`/usr/bin/msfconsole`), msf-server RPC on `127.0.0.1:55553`.
- Integration: adapter executes module runs; results feed vulnerability→exploit mapping;
  session events feed C2 visibility in NetVision capture + intel timeline.
- Security: destructive (exploit) → HITL + scope allowlist.

### 4.3 Recon-ng — 🔴 to build
- Local: `recon-ng` (`/usr/bin/recon-ng`), workspaces via `-W`.
- Integration: recon outputs (hosts/services/vulns/contacts/credentials) → canonical model →
  NetVision vuln store / intel / downstream Metasploit exploitation.

### 4.4 God's Eye View — 🔴 to build
- Local repo: `/home/dark00/Projects/gods-eye-view` (port/api-base ≈ `http://localhost:4173` for preview; MCP stdio via `npm run mcp -- --api-base …`).
- Integration: MCP tools (`getAircraftTrack`, `vesselsInArea`, `satellitesOverhead`, `findCctvCameras`,
  `getWeather`, `situationBrief`, `showInGodsEyeView`, …) as adapter actions; OSINT enrichment of
  geo-located targets; globe panel embed in Oblivion UI.

---

## 5. End-to-End Piping Workflows (planned)

### Workflow A — Full Recon → Report
`recon-ng module:OSINT/dns` → collect hosts → `netvision trigger_scan` → vulns sync →
godseye enrichment (nearby aircraft/vessels/cameras) → intel timeline → report.

### Workflow B — Recon → Exploit → Post-Exploit
NetVision critical vuln (exploit_available) → Metasploit `exploits_search` → HITL confirm →
`run_module` → session events → post module (`whoami`, `loot`) → artifacts → NetVision capture → report.

### Workflow C — Threat Hunt / OSINT
God's Eye View live entities → IOC matching → Metasploit module search → optional chain.

---

## 6. Upgrade Phases (aligned with existing plans, now including verified gaps)

| Phase | Focus | Duration | Key deliverables |
|---|---|---|---|
| **1** | Adapter layer completion: Metasploit, Recon-ng, GodEye adapters + registry + `/api/tools/*` | 1–2 wk | Working adapters, health, execute |

**Phase 1 status (2026-11-21): ✅ IMPLEMENTED & VERIFIED** — `backend/adapters/` now contains working
`MetasploitAdapter` (msfconsole `-x` headless scripts: version → `6.5.6-dev`, sessions_list; RPC probe at :55553),
`ReconNgAdapter` (subprocess `recon-ng -w <ws>` + stdin scripts: module_search via `modules search <q>`),
`GodsEyeAdapter` (HTTP against God's Eye View `/api/*`), `NetVisionAdapter` (refactored health/connect),
and an `AdapterRegistry` (`backend/adapters/registry.py`).
Backend endpoints live: `GET /api/tools`, `GET /api/tools/{tool}/health|actions`,
`POST|DELETE /api/tools/{tool}/connect|disconnect`, `POST /api/tools/{tool}/execute`.
Frontend `/tools` page now renders live status + actions from `/api/tools`.
*Live-verified via uvicorn + curl:* `/api/tools` (4 tools), `/tools/health`, msf `version`/`sessions_list`,
recon-ng `module_search` (RC=0, module results), unknown-tool 404, godseye offline handling.
*Remaining in Phase 1:* Metasploit native-RPC client wiring (currently RPC probe + script fallback).
| **2** | Canonical model + async event bus + normalized events + timeline | 1–2 wk | `CanonicalEvent`, fan-out, `/api/events` |

**Phase 2 status (2026-11-21): ✅ IMPLEMENTED & VERIFIED** — `backend/models/canonical.py` now holds the
full unified entity set (CanonicalEvent, Target, Finding, Host, Service, Vulnerability, Credential, Session, Artifact)
+ `canonical_event()` factory; `backend/services/event_bus.py` upgraded to an async bus (subscribe/unsubscribe/publish/emit/list_events)
with bounded history; `main.py` now emits normalized canonical events from `/api/tools/{tool}/execute`
through the bus and fans them to WS clients (`/ws` bus_forward) and exposes `GET /api/events`.
*Live-verified:* tool execute → canonical event → bus history → `/api/events` (metasploit.version event returned).
*2026-11-21 update:* `IntelStore.build_timeline` now sources live canonical events from the event bus
(`_live_timeline_events`, filtered by `hours`) and only falls back to seed events when the bus is empty.
`canonical_to_timeline()` maps canonical events (tool.action) onto UI timeline categories
(vulnerability | scan | recon | operation | intel | target).
*Live-verified:* metasploit version → `/api/intelligence/timeline?hours=48` returns the live event
(event_type: operation, source: metasploit) ✅
| **3** | Pipeline orchestrator + runbooks wired to adapters + HITL | 2 wk | `PipelineService` executor, run API |

**Phase 3 status (2026-11-21): ✅ IMPLEMENTED & VERIFIED** — `backend/services/pipeline_service.py` now contains the
DAG runner (topological step ordering, step status/results/logs, condition support, destructive-step gating)
+ 3 built-in runbooks (Full Recon, Exploit Chain, OSINT Enrichment). Backend endpoints: `GET/POST /api/pipelines`,
`GET/DELETE /api/pipelines/{id}`, `POST /api/pipelines/{id}/run`, `GET /api/pipelines/runs/{id}`,
`POST /api/pipelines/runs/{id}/approve`, `DELETE /api/pipelines/runs/{id}/cancel`.
*Live-verified:* Full Recon run → `completed` (reconng→netvision→netvision); Exploit Chain → `gated` at s3
(destructive step held), approve → approved, cancel → cancelled; run state via `GET /api/pipelines/runs/{id}`.
| **4** | Frontend: `/tools` live, `/osint`, `/pipelines`, unified timeline, TopBar real status | 2 wk | UI complete |

**Phase 4 status (2026-11-21): ✅ IMPLEMENTED** — frontend `/osint` (live GodEye sources + threat feed + risk stats),
`/pipelines` (runbook list, step DAG, run / approve / cancel, run history), `/obsidian` (vault notes + canvas
management), live unified timeline on `/intelligence`, and real TopBar status (WS state via `useWS` + live tool
fleet counts from `/api/tools`). SideNav now includes Pipelines, OSINT and Obsidian entries.
`tsc --noEmit` and `eslint` clean.

**2026-11-23 — Centre visual upgrade:** modular components under `src/components/centre/`
(KPI strip, Recharts activity/donation charts, attack-surface map, event timeline, detection feed,
pipeline board, posture panel), true WebSocket push via `useCentreLive`, responsive 12-column grid,
interactive side/severity/source/time-window filters, and new backend endpoints
`GET /api/centre/metrics` + `GET /api/centre/assets`. Production `npm run build` verified.

**Obsidian integration (2026-11-21): ✅ IMPLEMENTED & VERIFIED** — `backend/services/obsidian_service.py`
(server-side vault management at `/home/dark00/Obsidian/Vault`, configurable via `OBSIDIAN_VAULT_PATH`):
notes (list/read/create/update/append/delete/search + report→Obsidian Flavored Markdown export with frontmatter,
wikilinks and callouts), canvases (list/read/create/validate/add node/add edge + JSON Canvas 1.0 pipeline map
generator with 16-hex IDs). `backend/adapters/obsidian.py` registers Obsidian as the 5th tool (15 actions),
and the API exposes `GET /api/obsidian/status|notes|notes/search|canvases`,
`POST/PATCH/DELETE /api/obsidian/notes*`, `POST /api/obsidian/canvases[/generate|/{name}/nodes|/{name}/edges]`,
`POST /api/obsidian/reports/export`; writes emit `obsidian.*` canonical events.
*Live-verified:* vault status, tool registry listing, note create/read/append/search/delete, report export,
canvas generate (12 nodes/5 edges), canvas add-node (validated), invalid-edge rejection, path-traversal
rejection (HTTP 400), and event-bus fan-out of `obsidian.*` events.
*Note:* runs in file mode (no desktop app/REST API plugin required); `OBSIDIAN_API_KEY`/`OBSIDIAN_API_HOST`
are reported in status for optional REST API use.

**Autonomic backend upgrade (2026-11-21): ✅ IMPLEMENTED & VERIFIED** — `backend/services/resilience.py`
adds `TTLCache` (single-flight, bounded, hit-rate stats), `CircuitBreaker` (closed/open/half-open with
adaptive recovery) and `HealthMonitor` (background concurrent probes, self-optimizing intervals,
auto-reconnect, `tool.online|offline|recovered` events). Registry health probes now run concurrently with a
15s cache; event bus fans out via `asyncio.gather`; pipeline runner executes independent DAG levels in
parallel; God's Eye View reuses a pooled httpx client. New control plane: `GET /api/system/autonomy`,
`POST /api/system/autonomy/recheck`, `POST /api/system/autonomy/recover/{tool}`,
`DELETE /api/system/autonomy/cache`; `/api/tools/{tool}/execute` is breaker-protected and read-only
actions are cached (`X-Cache: HIT|MISS`).
*Live-verified:* tool transition events at startup, cache MISS→HIT with 50% hit rate, breaker opens after
3 failures and rejects with HTTP 503, recheck/recover/cache-clear endpoints, and Full Recon pipeline
still completes under the concurrent runner.
| **5** | Safety & persistence: scope allowlist, audit log, credential vault, Supabase/Postgres migration | 2 wk | Hardened ops |

**Phase 5 status (2026-11-22): ✅ CORE IMPLEMENTED (file-backed)** — `backend/services/persistence.py`
atomically snapshots targets, campaigns, vulnerabilities, operations, reports, pipelines, runs and
event history to `OBLIVION_DATA_DIR` (default `backend/data`); restored on boot and flushed every
30s + on shutdown. `backend/services/audit_log.py` provides an append-only SHA-256 hash-chained
audit trail (`/api/audit`, `/api/audit/verify`), written immediately for tool executions, NetVision
controls and pipeline run/approve/cancel, with actor from the `X-Operator` header. Offensive targets
are checked against `OBLIVION_SCOPE`. NetVision/Obsidian credentials move to environment variables
(`backend/.env.example`). *Verified:* snapshot restore across restart (targets/events preserved),
hash-chain tamper detection, 5 unit tests, full `npm run build`.
*Remaining by design:* no remote database (local SQLite is the intended storage model); a proper
secret manager/vault for credentials is still optional.

**2026-11-22 update — embedded SQLite (no remote DB):** `backend/services/local_db.py` replaces
the JSON files with a single ACID SQLite database in WAL mode (`OBLIVION_DB_PATH`, default
`backend/data/oblivion.db`). Snapshots, canonical events and the hash-chained audit log live in
one file with checksums, `PRAGMA integrity_check`, local timestamped backups and `VACUUM`. Legacy
JSON/JSONL data is imported automatically on first run. New endpoints: `GET /api/persistence/stats`,
`POST /api/persistence/backup`, `GET /api/persistence/backups`, `POST /api/persistence/vacuum`.
*Verified live:* integrity `ok`, WAL mode, 8 snapshots + 1 audit entry migrated, backup created,
restore across restart, 6 unit tests passing. No remote database is required.

---

## 7. Risks & Mitigations

- **Metasploit RPC/version drift** → native RPC primary + `msfconsole -x` fallback; health-check both.
- **Recon-ng output parsing** → normalize defensively, keep raw payloads, version-tolerant parsers.
- **God's Eye View runtime** → requires local app/MCP server; degrade gracefully when offline.
- **In-memory state loss** → migrate stores early (Phase 5), persist events before Phase 2 fan-out grows.
- **Destructive actions** → scope allowlist + human-in-the-loop + audit log (Phase 5 / runbook gates).

---

## 8. Definition of Done (integration milestone)

1. All four adapters report healthy and execute actions via `/api/tools`.
2. Canonical events flow NetVision/Metasploit/Recon-ng/GodEye → bus → UI timeline.
3. At least one end-to-end runbook executes and shows in timeline.
4. `/tools`, `/osint`, `/pipelines` frontend pages functional.

---

*Next step when you're ready: start **Phase 1** (Metasploit + Recon-ng + GodEye adapters, registry, tools API).*
