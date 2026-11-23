# GateWay:Oblivion — Engagement Model (Detailed Design & Implementation Plan)

**Date:** 2026-11-23
**Status:** DESIGN — not yet implemented
**Scope:** Red-team / purple-team engagement lifecycle inside Oblivion, built on the existing
adapters, canonical event bus, pipeline orchestrator, SQLite persistence, audit chain and Centre.

---

## 1. Goals

1. Replace "pipelines as a proxy for engagements" with a first-class **Engagement** object.
2. Make scope, rules of engagement, authorization and human approval **enforceable**, not advisory.
3. Link every finding, artifact, session, pipeline run and event to an engagement and an operator.
4. Give the Centre a real operational picture: active engagements, progress, risk, blockers, evidence.
5. Produce defensible reports from a tamper-evident activity record.

---

## 2. Core concepts

| Concept | Definition |
|---|---|
| **Engagement** | Authorized assessment with objective, scope, dates, team, RoE and state. |
| **Rules of Engagement (RoE)** | Signed authorization: scope, exclusions, time windows, allowed techniques, stop conditions, contacts. |
| **Scope Entry** | Explicit target (CIDR/domain/host) with in/out flag and technique restrictions. |
| **Operator** | Human actor (lead, operator, observer, client reviewer). Identity via `X-Operator` today; real auth later. |
| **Task** | Unit of work inside an engagement, often one pipeline step or manual action. |
| **Finding** | Normalized security issue with severity, evidence, owner, status. |
| **Evidence** | Artifact proving a finding: raw tool output, screenshot hash, PCAP ref, loot hash, log line. |
| **Approval** | Explicit human authorization for a destructive/gated action. |
| **Engagement Event** | Canonical event tagged with engagement ID, forming the engagement timeline. |

---

## 3. Canonical data model (new entities)

Extend `backend/models/canonical.py`:

```python
class CanonicalEngagement(BaseModel):
    id: str
    code: str                       # e.g. ENG-2026-014
    name: str
    objective: str
    engagement_type: str            # red | purple | blue-validation | osint
    state: str                      # see state machine
    priority: str                   # low | medium | high | critical
    lead_operator: str
    team: list[str]
    client: Optional[str]
    start_at: Optional[str]
    end_at: Optional[str]
    created_at: str
    updated_at: str
    scope_id: str
    roe_id: str
    risk_score: float = 0.0
    findings_count: int = 0
    progress: float = 0.0

class CanonicalScope(BaseModel):
    id: str
    engagement_id: str
    include: list[str]              # CIDRs, domains, hosts
    exclude: list[str]
    allowed_tools: list[str]
    allowed_actions: list[str]
    forbidden_actions: list[str]
    time_windows: list[dict]        # {start, end, timezone}
    max_rate: Optional[int]
    data_handling: str

class CanonicalRoE(BaseModel):
    id: str
    engagement_id: str
    version: int
    authorized_by: str
    authorized_at: str
    document_ref: Optional[str]
    emergency_contacts: list[dict]
    stop_conditions: list[str]
    legal_notes: Optional[str]
    signed: bool = False

class CanonicalTask(BaseModel):
    id: str
    engagement_id: str
    title: str
    technique: Optional[str]        # ATT&CK ID
    tool: Optional[str]
    action: Optional[str]
    params: dict
    depends_on: list[str]
    status: str                     # planned|ready|executing|blocked|done|skipped
    gate: bool
    owner: Optional[str]
    pipeline_run_id: Optional[str]
    created_at: str
    updated_at: str

class CanonicalFinding(BaseModel):   # extends existing entity
    engagement_id: str
    task_id: Optional[str]
    severity: str                   # critical|high|medium|low|info
    cvss_score: Optional[float]
    cve_id: Optional[str]
    status: str                     # new|triaged|confirmed|remediated|accepted-risk|closed
    owner: Optional[str]
    evidence_ids: list[str]
    remediation: Optional[str]
    discovered_at: str

class CanonicalEvidence(BaseModel):
    id: str
    engagement_id: str
    finding_id: Optional[str]
    kind: str                       # output|screenshot|pcap|loot|log|note
    source_tool: str
    sha256: str
    path_or_hash: str               # local file path or content hash
    captured_at: str
    captured_by: str
    metadata: dict

class CanonicalApproval(BaseModel):
    id: str
    engagement_id: str
    requested_by: str
    approved_by: str
    action: str
    target: str
    reason: str
    decided_at: str
    decision: str                   # approved | denied
```

Existing `CanonicalEvent` gains `engagement_id` and `task_id` optional fields.

---

## 4. State machines

### Engagement
```
DRAFT → AUTHORIZED → ACTIVE ⇄ PAUSED → COMPLETED → ARCHIVED
              ↓          ↓
          CANCELLED   ABORTED (stop condition triggered)
```
Transitions are guarded:
- `AUTHORIZED` requires a signed RoE and nonempty include scope.
- `ACTIVE` requires at least one operator assigned.
- `ABORTED` requires a reason and immediately revokes all tool tokens for that engagement.

### Finding
```
NEW → TRIAGED → CONFIRMED → REMEDIATED → CLOSED
                ↘ ACCEPTED-RISK ↗
```
Every transition requires an actor and writes to the audit chain.

### Task
```
PLANNED → READY → EXECUTING → DONE
                    ↘ BLOCKED → READY
                    ↘ SKIPPED
```
`gate=True` tasks cannot leave READY without an `CanonicalApproval`.

---

## 5. Enforcement architecture

```
Operator request (tool execute / pipeline run)
        │
        ▼
EngagementGuard (middleware in main.py)
  1. resolve active engagement from header/query/state
  2. verify engagement.state == ACTIVE
  3. verify target ∈ scope.include and ∉ scope.exclude
  4. verify current time ∈ RoE time_windows
  5. verify tool/action ∈ allowed_actions and ∉ forbidden_actions
  6. if destructive → require matching APPROVAL by lead
  7. write audit entry BEFORE execution
        │
        ▼
adapter.execute() → canonical event (engagement_id, task_id) → bus → Centre
        │
        ▼
result → Finding / Evidence creation → engagement timeline
```

`EngagementGuard` replaces the current coarse `OBLIVION_SCOPE` check with per-engagement scope,
while keeping `OBLIVION_SCOPE` as a global hard ceiling.

---

## 6. Persistence — new SQLite tables

Add to `backend/services/local_db.py` schema v2 (migration from v1 automatic):

```sql
engagements(id PK, code UNIQUE, data JSON, state, created_at, updated_at)
scopes(id PK, engagement_id, data JSON)
roes(id PK, engagement_id, version, data JSON, signed)
tasks(id PK, engagement_id, status, data JSON)
findings(id PK, engagement_id, severity, status, data JSON)
evidence(id PK, engagement_id, finding_id, sha256, data JSON)
approvals(id PK, engagement_id, decision, data JSON)
engagement_events(seq PK, engagement_id, event_id, data JSON)
reports(id PK, engagement_id, kind, path, created_at)
```
Indexes on `engagement_id`, `state`, `severity`, `timestamp`. Snapshot/backup endpoints already
cover the DB file; no new infrastructure.

---

## 7. API surface (REST)

```
# Engagements
GET    /api/engagements                      list (filters: state, type, lead)
POST   /api/engagements                      create draft
GET    /api/engagements/{id}                 full detail
PATCH  /api/engagements/{id}                 update metadata
POST   /api/engagements/{id}/transition      {to, reason}
POST   /api/engagements/{id}/activate        authorized → active
POST   /api/engagements/{id}/abort           emergency stop

# Scope & RoE
GET/PUT /api/engagements/{id}/scope
GET/PUT /api/engagements/{id}/roe
POST    /api/engagements/{id}/roe/sign

# Tasks & pipelines
GET/POST   /api/engagements/{id}/tasks
PATCH      /api/engagements/{id}/tasks/{task_id}
POST       /api/engagements/{id}/tasks/{task_id}/approve
POST       /api/engagements/{id}/pipelines/{pipeline_id}/run   (scoped, audited)

# Findings & evidence
GET/POST   /api/engagements/{id}/findings
PATCH      /api/engagements/{id}/findings/{finding_id}
POST       /api/engagements/{id}/findings/{fid}/evidence
GET        /api/engagements/{id}/evidence

# Timeline & reporting
GET    /api/engagements/{id}/events?side=&severity=&limit=
GET    /api/engagements/{id}/metrics      progress, findings by severity, task burnup
POST   /api/engagements/{id}/report       generate Markdown report → Obsidian note
GET    /api/engagements/{id}/report       download latest
```

Every mutation writes an audit entry with actor from `X-Operator`.

---

## 8. Frontend design (`/engagements`)

### List view
Cards/table with code, name, state badge, priority, lead, progress bar, findings count, dates.
Filters by state/type/lead; sort by risk/date.

### Detail view (tabbed, responsive)
1. **Overview** — objective, RoE summary, scope chip cloud, team, risk gauge, progress ring.
2. **Scope** — include/exclude CIDRs, allowed tools/actions, time windows; visual scope map.
3. **Timeline** — engagement-filtered canonical events, red/blue/severity filters.
4. **Tasks** — kanban board (Planned / Ready / Executing / Blocked / Done) with drag-to-transition
   and gate approval buttons.
5. **Findings** — sortable table + severity distribution chart; click → detail drawer with evidence.
6. **Evidence** — hash-verified artifact list, tool/source, capture time, SHA-256.
7. **Pipelines** — scoped pipeline runs with approval workflow.
8. **Reports** — generate/export report to Obsidian; executive/technical toggle.

Reuse Centre components (Panel, KpiStrip, charts, timeline) for visual consistency.

---

## 9. Integration with existing systems

| Existing system | Engagement integration |
|---|---|
| Event bus | Events gain `engagement_id`/`task_id`; Centre timeline filters by active engagement |
| Pipelines | Steps become tasks; gates become approvals; runs scoped to engagement |
| Adapters | All execute calls pass through EngagementGuard |
| Audit log | Every engagement mutation + guarded action recorded in hash chain |
| SQLite | New tables, transactional state transitions, automatic backup |
| Obsidian | Reports exported as notes + canvas; evidence index note |
| Centre | New "Active Engagement" strip with state, progress, risk, blockers |
| Canonical model | New entities above; findings/artifacts/sessions reused |

---

## 10. Reporting

Generated Markdown (via Obsidian adapter):
```
# ENG-2026-014 — Assessment Report
## Executive Summary
## Rules of Engagement (reference)
## Scope & Methodology
## Findings (severity-ranked, with evidence hashes)
## Attack Path / Timeline
## Tools & Operators
## Remediation Roadmap
## Appendix: Audit chain verification
```
Two views: **executive** (risk-focused) and **technical** (evidence-focused).

---

## 11. Safety & compliance

- No engagement can be ACTIVE without signed RoE and explicit include scope.
- Global `OBLIVION_SCOPE` remains a hard ceiling over all engagement scopes.
- Destructive/gated actions require a second human approval and are audited before execution.
- ABORT immediately blocks all tool calls for that engagement.
- Evidence stores hashes, not raw secrets; credential artifacts are referenced by ID only.
- Report explicitly states authorization and scope for legal defensibility.

---

## 12. Implementation phases & effort

| Phase | Deliverable | Effort |
|---|---|---|
| 1 | Canonical engagement/scope/RoE/task/finding/evidence/approval entities + SQLite schema v2 migration | 1–2 d |
| 2 | `EngagementService` CRUD + state machines + `EngagementGuard` middleware | 2–3 d |
| 3 | API endpoints + audit hooks + event-bus engagement tagging | 2 d |
| 4 | Task/pipeline integration + approval workflow | 2 d |
| 5 | `/engagements` frontend (list + detail tabs + kanban + charts) | 3–4 d |
| 6 | Report generation + Obsidian export + Centre integration | 2 d |
| 7 | Tests: state machine, guard enforcement, migration, API integration | 2 d |

**Total:** ~2–3 weeks of focused work.

---

## 13. Recommended order

Start with **Phase 1 + 2** (model, persistence, guard) because every later feature depends on
enforceable scope and state. Then Phase 3/4 to wire pipelines and audit. UI last, once real data exists.

**Design principle:** nothing in the current build changes behavior until an engagement is explicitly
created and activated — existing adapters, pipelines and Centre keep working exactly as today.

## Implementation status

**2026-11-23 — Phases 1 + 2 implemented:** `backend/models/engagement.py` defines all eight canonical
entities plus state-transition tables; `CanonicalEvent` gained optional `engagement_id`/`task_id`.
`backend/services/local_db.py` migrated to schema v2 with unified `engagement_entities` and
`engagement_events` tables (verified: integrity `ok` on an existing v1 database).
`backend/services/engagement_service.py` implements CRUD, state machines, scope/RoE management,
task approvals, findings/evidence, metrics and the enforceable `guard()`.
The REST API exposes `/api/engagements/*`, and `X-Engagement` activates per-engagement guarding on
tool execution while preserving legacy `OBLIVION_SCOPE` behavior when the header is absent.
*Verified live:* create → scope → RoE sign → authorized → active → task approval; out-of-scope
target returns 403, destructive action without approval returns 403, in-scope action succeeds,
no-header legacy call unchanged, audit chain valid, 4 unit tests passing.

**2026-11-23 — Phases 3 + 4 implemented:** `PipelineRun` and `PipelineStep` gained engagement/task
fields; the orchestrator now calls engagement hooks before each step (scope/RoE/approval guard),
creates a canonical task per step, auto-creates findings from step results, tags canonical events with
`engagement_id`/`task_id`, and requires engagement approval for gated steps. New endpoint
`POST /api/engagements/{id}/pipelines/{pipeline_id}/run`; standard pipeline runs accept `X-Engagement`.
Pipeline approval now resumes gated runs (bug fixed). *Verified live:* scoped runs complete, gated
runs halt with `engagement-approval`, approval resumes and creates tasks, engagement metrics/events
populate, audit chain valid, 6 unit tests passing.

**2026-11-23 — Phase 5 implemented:** `/engagements` frontend with responsive list/detail layout,
eight tabs (Overview, Scope & RoE, Tasks kanban, Findings with severity chart, Timeline, Evidence,
Pipelines, Reports), editable scope/RoE, activate/abort controls, approval buttons, and typed hooks
in `src/hooks/useEngagements.ts`. Engagement progress now refreshes after pipeline task completion.
Verified: `tsc`, ESLint and production `npm run build` clean.

**2026-11-23 — Phase 6 implemented:** `backend/services/engagement_report.py` renders Obsidian
Flavored Markdown reports (frontmatter, callouts, wikilinks) in executive/technical variants,
exports them to `Oblivion/Engagements/<CODE>-<kind>.md` in the vault, and persists content/path in
SQLite. New endpoints: `POST|GET|GET /api/engagements/{id}/report[/download|s]`. ReportsTab now
generates, previews and downloads reports. Verified live: executive + technical reports generated,
vault file written, download works, audit chain valid, 9 unit tests, production build clean.

**2026-11-23 — Phase 7 implemented:** `backend/test_integration_e2e.py` runs the entire engagement
lifecycle over FastAPI TestClient against an isolated temporary SQLite DB and fake Obsidian writer:
create → scope → RoE sign → authorize → activate → task approval → guarded tool execution →
scoped pipeline run → findings/evidence → metrics → executive/technical reports + download →
audit verification → schema v2 integrity → emergency abort. All patched globals are restored on
teardown so the full suite runs together. **Full suite: 33 tests passing.**
