# GateWay:Oblivion ☠️

> The security command terminal. Targets, recon, vulnerabilities, campaigns.

A dark-operations command center for penetration testing and security operations. Oblivion connects to **NetVision** (the network scanner) and presents recon data, vulnerability intel, and campaign tracking in a war-room dashboard.

**Oblivion does NOT scan.** It consumes NetVision's data and orchestrates operations. NetVision is the engine below deck. Oblivion is the bridge.

## Architecture

```
Oblivion (port 8001)        NetVision (port 8000)
┌────────────────────┐      ┌────────────────────┐
│  Frontend (Next.js) │      │  Scanner Engine     │
│  • Overview         │      │  • Nmap integration │
│  • Targets          │◄─────│  • Packet capture   │
│  • Recon Dashboard  │ HTTP │  • CVE lookup       │
│  • Vuln Management  │      │  • Task queue       │
│  • Campaigns        │      │  • WebSocket events │
│  • Settings         │      │  • Prometheus       │
└────────┬───────────┘      └────────────────────┘
         │ WebSocket (30s heartbeat)
         ▼
┌────────────────────┐
│  WS Bridge         │
│  Auto-reconnect    │
│  Exponential       │
│  backoff           │
└────────────────────┘
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (dark theme) |
| Auth | Supabase (cookie-based SSR) |
| State | Zustand (UI) + TanStack Query (server data) |
| Charts | Recharts |
| Backend | FastAPI (Python) — port 8001 |
| Real-time | WebSocket with auto-reconnect |

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirect to `/dashboard` |
| `/login` | Supabase email/password auth |
| `/dashboard` | Overview — stats, recent scans, vuln alerts |
| `/targets` | Target management (create, edit, tag, status) |
| `/recon` | Recon dashboard — live scan feed, devices, port matrix |
| `/vulnerabilities` | Vulnerability management & CVE tracking |
| `/campaigns` | Campaign orchestration (planned) |
| `/settings` | User & system settings |

## Getting Started

```bash
# Frontend (Next.js) — the colon in the path breaks npx
/root/Builds/GateWay:Oblivion/node_modules/.bin/next dev

# Backend (FastAPI)
cd /root/Builds/GateWay:Oblivion/backend && python3 main.py

# Both need NetVision running on port 8000
cd /root/Builds/netvision/backend && python3 main.py
```

## Current Phase

| Phase | Status |
|-------|--------|
| Phase 0: Foundation & Auth | ✅ Complete |
| Phase 1: Target Management | ✅ Complete |
| Phase 2: Recon Dashboard | ✅ Complete |
| Phase 3: Vulnerability Management | In Progress |
| Phase 4: Campaign Orchestration | ⬜ Planned |

## Design

- **Theme:** Dark ops — terminal aesthetic
- **Colors:** `#0a0a0f` background, `#1a1a2e` surface, `#00ff88` accent
- **Glassmorphism:** `.glass` utilities throughout
- **Motion:** Minimal — data density over animation
- **Font:** Geist (next/font/google)
