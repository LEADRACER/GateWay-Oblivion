# GateWay:Oblivion — Architecture & Phase Plan

## Vision

If Colossus is the public face — the showcase, the gallery — then Oblivion is the engine room.

Oblivion is the **internal operations command center**: where reconnaissance data is aggregated, offensive campaigns are orchestrated, vulnerabilities are tracked across targets, and intelligence is distilled into actionable operations. It is not a public platform. It is a **war room**.

The name is deliberate. Oblivion is where data goes to be consumed, processed, and transformed into decisive action. It is the shadow behind the gateway.

## Design Philosophy

- **Dark-first.** Not dark mode — dark *identity*. This is not a theme toggle. The entire UI lives in the void.
- **Neon accent:** Keep the green (`oklch(0.75 0.25 145)`) from the GateWay design system, but use it sparingly — as a weapon, not decoration. Green means active. Green means alive. Green means danger.
- **Data density.** Every pixel earns its place. No wasted whitespace. Information is the interface.
- **Operational rhythm.** The dashboard is organized around the workflow: Recon → Scan → Exploit → Post-Exploit → Report. Each phase has its view.
- **Terminal aesthetic.** Monospace for data. Sharp corners. No rounded edges on operational elements. This is not a social platform — it is a command surface.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | Consistency with Colossus, Turbopack speed |
| Language | TypeScript (strict) | Operational reliability |
| Styling | Tailwind v4 + CSS variables | Design system continuity |
| State | Zustand | Lightweight, no boilerplate for operational state |
| Data Fetching | TanStack Query | Stale-while-revalidate for live scan data |
| Backend API | FastAPI (Python) | NetVision integration, scanner orchestration |
| Database | PostgreSQL + Supabase | Shared infra with Colossus, familiar tooling |
| Real-time | WebSocket (native) | Live scan progress, event streaming |
| Auth | Supabase Auth (admin-only) | Private platform, invite-only |
| Charts | Recharts | Already in design system |

## Phase Plan

### Phase 0: Foundation — The Void
- Next.js 16 scaffold with strict TypeScript
- Dark design system tokens (CSS variables)
- Auth gate (redirect unauthenticated)
- Layout: persistent top bar + collapsible side nav
- WebSocket provider with auto-reconnect
- FastAPI backend skeleton

### Phase 1: Target Management
- Targets CRUD (IP, hostname, domain, CIDR range)
- Target groups / campaigns
- Target status (active, archived, compromised)
- Tag-based classification
- Bulk import (CSV, text paste)

### Phase 2: Recon Dashboard
- Live network topology view (SVG-based)
- Device discovery feed (auto-populated from NetVision scans)
- Port/service matrix
- OS fingerprinting results
- Historical scan comparison (diff view)

### Phase 3: Vulnerability Tracker
- CVE database integration (NVD API)
- Per-target vulnerability listing
- Severity heatmap
- Remediation tracking
- Exploit availability flagging

### Phase 4: Operations Command
- Campaign orchestrator (multi-target scan jobs)
- Real-time scan progress dashboard
- Queue management (pause, resume, cancel)
- Agent/sensor status monitoring
- Webhook event inbox

### Phase 5: Intelligence & Reporting
- Consolidated target dossiers
- Timeline view of all activity per target
- Report generator (Markdown → PDF)
- Export (JSON, CSV, STIX)
- Activity audit log

## File Structure

```
/root/Builds/GateWay:Oblivion/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  # Overview
│   │   │   ├── targets/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── scans/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── vulnerabilities/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── operations/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── intelligence/
│   │   │       ├── page.tsx
│   │   │       └── [targetId]/page.tsx
│   │   └── api/
│   │       ├── targets/
│   │       ├── scans/
│   │       └── vulnerabilities/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx
│   │   │   ├── SideNav.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── targets/
│   │   ├── scans/
│   │   ├── vulnerabilities/
│   │   └── ui/
│   │       ├── StatCard.tsx
│   │       ├── DataTable.tsx
│   │       ├── ProgressBar.tsx
│   │       └── Badge.tsx
│   ├── hooks/
│   │   ├── useWS.ts
│   │   └── useTargets.ts
│   ├── lib/
│   │   ├── supabase/
│   │   ├── api.ts
│   │   └── types/
│   ├── stores/
│   │   └── operations.ts
│   └── styles/
│       └── globals.css
├── backend/
│   ├── main.py
│   ├── models/
│   ├── routers/
│   └── services/
├── supabase/
│   └── migrations/
├── package.json
└── tsconfig.json
```

## Design Tokens (Dark)

```css
:root {
  --color-bg: #08090a;
  --color-surface: #0d0e10;
  --color-surface-2: #121316;
  --color-surface-3: #1a1c20;
  --color-border: #1e2024;
  --color-border-light: #2a2d33;
  --color-text: #c8cacc;
  --color-text-muted: #6b6e74;
  --color-text-dim: #4a4d54;
  --color-accent: oklch(0.75 0.25 145);
  --color-accent-bg: oklch(0.75 0.25 145 / 0.08);
  --color-accent-glow: oklch(0.75 0.25 145 / 0.3);
  --color-danger: oklch(0.65 0.25 25);
  --color-warning: oklch(0.7 0.2 80);
  --color-info: oklch(0.65 0.2 240);
}
```

## What Oblivion Is NOT

- It is NOT a public platform. No registration, no social features.
- It is NOT a replacement for NetVision. It consumes NetVision's data.
- It is NOT a vulnerability scanner itself. It orchestrates and tracks scans.
- It is NOT a document generator. It produces operational outputs, not marketing.

## What Oblivion IS

- The **command center** behind the gateway.
- The **war room** where targets are tracked, campaigns are orchestrated, and intelligence is consumed.
- The **bridge** between NetVision (recon data) and operational decisions.
- The **audit trail** of every offensive action taken through the gateway.
