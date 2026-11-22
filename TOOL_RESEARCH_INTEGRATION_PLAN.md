# High-Starred Security Tools — Research & Integration Plan for GateWay:Oblivion

**Date:** 2026-11-22
**Source:** live GitHub API star counts (2026-11-22), tool documentation and current Oblivion architecture.
**Already integrated:** NetVision (native sonar + bettercap), Metasploit, Recon-ng, God's Eye View, Obsidian.

---

## 1. Executive summary

Oblivion already has the hard part: adapters → canonical events → event bus → pipelines → the
Unified Red/Blue Centre. Adding tools is now mostly writing adapters and runbook steps.

The best-value additions are:

1. **ProjectDiscovery toolchain** (nuclei, subfinder, httpx, katana, naabu, dnsx) — one composite
   adapter fills the modern recon/vuln gap and feeds directly into existing recon pipelines.
2. **OSINT username/domain tools** (Sherlock, Maigret, theHarvester, SpiderFoot, Amass) — cheap to
   integrate, high-signal for the blue/OSINT side and for attribution dossiers.
3. **Blue-team telemetry** (Wazuh, Suricata, Zeek, Sigma, YARA, osquery/Velociraptor) — turns the
   Centre's "detections" panel from event-derived into real security telemetry.
4. **Adversary emulation & C2** (Sliver, Mythic, Havoc, CALDERA, Atomic Red Team, BloodHound) —
   powerful but higher-risk; integrate behind strict scope + HITL gates.

---

## 2. Researched tools (stars, category, fit)

| Tool | Stars | Category | What it adds to Oblivion | Fit |
|---|---:|---|---|---|
| sherlock-project/sherlock | 115,695 | OSINT | Username → social account discovery | High, trivial adapter |
| soxoj/maigret | 41,163 | OSINT | 6k-site username dossier | High |
| projectdiscovery/nuclei | 33,193 | Vuln scan | Template-driven CVE/exposure scanning | **Very high** |
| robertdavidgraham/masscan | 26,176 | Discovery | Already present inside NetVision's sonar | Already covered |
| osquery/osquery | 23,791 | Endpoint | SQL-based host telemetry | Medium (needs endpoint agents) |
| laramies/theHarvester | 18,382 | OSINT | Emails, subdomains, names | High |
| projectdiscovery/katana | 17,884 | Web recon | Next-gen crawler/spider | High |
| wazuh/wazuh | 17,860 | SIEM/XDR | Real alerts, file integrity, compliance | **Very high (blue)** |
| fortra/impacket | 16,295 | Red / network | Protocol-level exploitation primitives | Medium/high-risk |
| projectdiscovery/subfinder | 14,845 | Recon | Fast passive subdomain enumeration | **Very high** |
| redcanaryco/atomic-red-team | 12,898 | Purple | MITRE ATT&CK detection tests | High (emulation pipeline) |
| owasp-amass/amass | 15,547 | Attack surface | In-depth asset/domain mapping | High |
| BishopFox/sliver | 12,393 | C2 | Modern adversary-emulation C2 | Medium/high-risk |
| SigmaHQ/sigma | 11,545 | Detection | Generic SIEM detection rules | High (blue rules engine) |
| projectdiscovery/httpx | 10,641 | Web recon | Fast HTTP probing/technology fingerprint | High |
| VirusTotal/yara | 10,054 | Malware | Pattern matching for artifacts | High (blue) |
| HavocFramework/Havoc | 8,504 | C2 | Modern C2 framework | Medium/high-risk |
| zeek/zeek | 8,271 | Network | Rich network telemetry/logs | High (blue) |
| OISF/suricata | 6,921 | IDS/IPS | Signature-based network detection | High (blue) |
| MISP/MISP | 6,692 | Threat intel | IOC sharing / threat feeds | High (blue) |
| projectdiscovery/naabu | 6,389 | Port scan | Fast reliable port scanning | Medium (overlaps NetVision) |
| Pennyw0rth/NetExec | 6,042 | Red / network | Post-exploitation network execution | Medium/high-risk |
| its-a-feature/Mythic | 4,930 | C2 | Collaborative red-team framework | Medium/high-risk |
| Velocidex/velociraptor | 4,501 | Endpoint | Endpoint visibility/hunting | Medium |
| TheHive-Project/TheHive | 3,951 | Incident response | Incident management / case workflow | High (blue cases) |
| apache/caldera | 7,547 | Purple | Automated adversary emulation | High (purple pipeline) |
| smicallef/spiderfoot | 24,831 | OSINT | 200+ OSINT modules, unified results | High |
| SpecterOps/BloodHound | 3,593 | Red / AD | AD attack-path graph | Medium (Windows/AD only) |

**Note on licensing:** most are open source but licences differ (GPL, Apache, MIT, some with
commercial-use restrictions). Check each licence before redistribution; adapters only shell out
to locally installed binaries, so no code is bundled.

---

## 3. Architecture fit — how every tool plugs in

```
Tool binary / local API
        │
        ▼
ToolAdapter.execute(action, params)     ← one adapter per tool or composite
        │
        ▼
normalizer → CanonicalEvent / CanonicalHost / CanonicalService /
             CanonicalVulnerability / CanonicalDetection / CanonicalIncident
        │
        ▼
event_bus.emit()  ──► /api/events ──► /api/centre/timeline ──► /centre dashboard
        │
        ▼
pipeline steps (depends_on, gates)  ──► audit_log  ──► SQLite (local)
```

No architectural changes are required — only new adapters, normalizers and UI cards.

---

## 4. Proposed integration tiers

### Tier 1 — Quick wins (1–2 days each)

**Tier 1a: ProjectDiscovery composite adapter (`projectdiscovery`)**
- Binary detection + subprocess actions: `subfinder -d <domain> -json`, `httpx -l <urls> -json`,
  `katana -u <url> -json`, `nuclei -u <url> -json`, `naabu -host <ip>`, `dnsx -d <domain>`.
- Actions: `subdomains`, `http_probe`, `crawl`, `nuclei_scan`, `port_scan`, `dns_resolve`.
- Canonical events: `pd.subdomain.found`, `pd.service.discovered`, `pd.vuln.found`.
- Pipelines: *Web Vuln Sweep* = subfinder → httpx → katana → nuclei → NetVision sync.

**Tier 1b: OSINT adapters**
- `sherlock`, `maigret` → `osint.username.found`; export dossier note to Obsidian.
- `theHarvester` → `osint.email.found`, `osint.host.found`.
- `spiderfoot` (local API) → bulk OSINT enrichment → canonical events.
- `amass` → `asset.subdomain.found` with ASN/org metadata.
- Pipeline: *Target Profiling* = theHarvester → Sherlock → Amass → Obsidian dossier.

### Tier 2 — Blue-team backbone (3–5 days each)

- **Wazuh adapter** (REST API): alerts, agents, active responses; actions `alerts`, `agents`,
  `active_response`; canonical `detection.alert`, `endpoint.agent`.
- **Suricata / Zeek log ingestors**: tail EVE JSON / Zeek logs into `CanonicalDetection` with
  signature, src/dst IP, severity; no daemon management, just local file watchers.
- **Sigma/YARA rules service**: match local rules against events/artifacts; canonical
  `detection.rule_match`; expose rule inventory in the Centre.
- **TheHive + MISP**: push detections → cases, pull IOC feeds → `intel.ioc`.
- **osquery / Velociraptor**: endpoint query adapter with `query` action and result normalization.

### Tier 3 — Advanced red / purple (5–10 days each, HITL mandatory)

- **Sliver / Mythic / Havoc adapters**: session/listeners/generate/list actions. Every destructive or
  agent-generating action must be a gated pipeline step and audited.
- **CALDERA + Atomic Red Team**: emulate ATT&CK techniques against authorized targets; results feed
  `detection.rule_match` to measure blue-team coverage (true purple-team loop).
- **Impacket / NetExec**: protocol-level validation steps only inside explicit engagements.
- **BloodHound**: AD graph import → `CanonicalGraphNode` / `CanonicalAttackPath`, rendered in the
  Centre as an attack-path view (Windows-only engagements).

---

## 5. New canonical entities needed

| Entity | Key fields | Source tools |
|---|---|---|
| `CanonicalDomain` | domain, registrar, created, tags | amass, theHarvester, subfinder |
| `CanonicalSubdomain` | fqdn, parent, ip, source | subfinder, amass, dnsx |
| `CanonicalUrl` | url, status, title, tech, source | httpx, katana |
| `CanonicalDetection` | rule_id, signature, severity, src_ip, dst_ip, sensor | Wazuh, Suricata, Zeek, Sigma, YARA |
| `CanonicalIncident` | case_id, status, owner, timeline | TheHive, MISP |
| `CanonicalCampaign` | name, scope, objective, operator, status | Sliver, Mythic, CALDERA |
| `CanonicalAttackPath` | nodes[], edges[], risk | BloodHound |
| `CanonicalIOc` | type, value, confidence, source | MISP, GodEye |

---

## 6. Example new pipelines

1. **Bug-Bounty Sweep** — subfinder → httpx → katana → nuclei → NetVision sync → Obsidian report.
2. **Target Dossier** — theHarvester → Sherlock → Maigret → Amass → Obsidian note + canvas.
3. **Purple Validation** — Atomic Red Team technique → Wazuh/Sigma detection check → TheHive case.
4. **Exposure Watch** — NetVision sonar → Amass → Nuclei → MISP IOC push → Centre blue feed.
5. **AD Attack Path** (authorized only) — BloodHound ingest → risk-ranked path → gated exploit step.

---

## 7. Guardrails (non-negotiable)

- All new offensive actions must pass through `OBLIVION_SCOPE` allowlist checks.
- C2/exploit steps must be `gate=True` and write an audit entry before execution.
- All tools run locally/offline by default; no cloud dependency without explicit opt-in.
- Adapters report binary availability in `/api/tools` and degrade gracefully when absent —
  exactly like nmap/tshark/bettercap today.

---

## 8. Recommended order

1. **Tier 1a ProjectDiscovery composite adapter** — biggest immediate capability gain.
2. **Tier 1b OSINT adapters** — cheap, visible in the Centre, feeds Obsidian dossiers.
3. **Tier 2 Wazuh + Suricata/Zeek ingest** — makes the blue side real.
4. **Tier 3** only after scope enforcement, HITL and audit are exercised in real engagements.

**Bottom line:** the platform is ready for all of them; start with ProjectDiscovery + OSINT for
the fastest, lowest-risk expansion of Oblivion's recon and intel surface.
