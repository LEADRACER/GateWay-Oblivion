# Oblivion — Multi-Tool Integration Plan

## Goal
Turn Oblivion into the unified dashboard/workflow hub for Metasploit, Recon-ng, NetVision (engine), and God's Eye View (OSINT/spatial + web scanner), piping data and events between tools.

## Current State
- Next.js 16 + FastAPI backend, Supabase auth.
- NetVision already integrated via `NetVisionClient`, `ws_bridge`.
- In-memory stores for targets/campaigns/vulns/ops/intel.
- No adapters for Metasploit, Recon-ng, God's Eye View.

## Architecture Additions

### 1. Tool Adapter Layer (`backend/adapters/`)
Create a common interface `ToolAdapter`:
- `health()`, `connect()`, `disconnect()`
- `list_capabilities()`, `execute(action, params)`
- `stream_events()` async generator
- `normalize_result(raw) -> CanonicalEvent`

Adapters:
- `NetVisionAdapter` (refactor existing client)
- `MetasploitAdapter`: RPC (msgpack over HTTP) — sessions, modules, exploits, post modules, loot, hosts/services.
- `ReconNgAdapter`: subprocess/JSON export or REST if available — modules, workspaces, hosts, contacts, credentials, vulnerabilities.
- `GodsEyeAdapter`: (a) OSINT globe HTTP/WS feeds (flights/ships/sats/cameras) for spatial intel; (b) web scanner CLI/API for tech/CVE fingerprinting.

### 2. Canonical Data Model (`backend/models/canonical.py`)
Unified entities: Target, Host, Service, Vulnerability, Credential, Session, Artifact, Finding, Event. Map each tool's output to canonical schema. Add `source_tool`, `external_id`, `confidence`.

### 3. Event Bus / Workflow Piping
- Internal async event bus (Redis Streams or in-process asyncio queue + WS fan-out).
- Tool events normalized -> bus -> WebSocket to frontend + persisted timeline.
- Workflows as DAG runbooks: Recon-ng -> NetVision scan -> Metasploit exploit -> post-exploit loot -> report. Allow conditional branching on findings.

### 4. Pipeline / Orchestration Service
- `PipelineService` with templates: Full Recon, Exploitation Chain, OSINT Enrichment, Web Vuln Sweep.
- Step executor dispatches to adapters; collects outputs; feeds next step inputs.
- Human-in-the-loop gates for destructive actions (Metasploit exploit).

### 5. Frontend Dashboard Enhancements
- Add pages: `/msf` (sessions/modules), `/recon-ng` (workspaces/hosts), `/osint` (God's Eye globe embed or data layers), `/pipelines` (builder/runner).
- Unified timeline & asset graph across tools.
- Tool status panel in TopBar (health indicators).
- Action palette to launch tool actions.

### 6. Security & Safety
- Scope enforcement: targets allowlist; require confirmation for exploit execution.
- Credential vault (encrypted) for tool creds.
- Audit log of all cross-tool actions.
- Rate limiting and sandboxing for shell commands.

### 7. Persistence
- Migrate in-memory stores to PostgreSQL/Supabase tables for targets, findings, sessions, pipelines, audit logs.
- Keep Redis for event bus/cache.

## Phases
1. Adapter interface + NetVision refactor (1 week)
2. Metasploit adapter + sessions view (1 week)
3. Recon-ng adapter + workspace view (1 week)
4. God's Eye adapter + OSINT panel (1 week)
5. Canonical model + event bus (1 week)
6. Pipeline orchestrator + runbooks (2 weeks)
7. Frontend integration & polish (2 weeks)
8. Persistence + audit + security hardening (1 week)

## Risks
- Metasploit RPC availability/versioning.
- Recon-ng lacks stable API; use CLI + JSON.
- God's Eye View is a browser app; integrate via its data sources/exports or run as service.
- In-memory state loss; migrate early.

## Deliverables
- `backend/adapters/*`, `backend/services/pipeline_service.py`, `backend/models/canonical.py`
- New frontend routes and components.
- Updated ARCHITECTURE.md and README.
- Tests for adapters and pipeline.
