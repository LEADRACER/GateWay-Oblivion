"""
GateWay:Oblivion — Vulnerability Management Service

Maintains a local vulnerability store, syncs with NetVision's
vulnerability feed, deduplicates by CVE ID, tracks lifecycle
status, and provides severity/exploitability analytics.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("oblivion.vulns")


# ── Pydantic Models ─────────────────────────────────────────────────

class VulnBase(BaseModel):
    cve_id: str
    title: str
    description: str = ""
    severity: str = "medium"  # critical | high | medium | low | info
    cvss_score: float = 0.0
    cvss_vector: str = ""
    affected_device: str = ""
    affected_port: int = 0
    affected_service: str = ""
    exploitability: str = "none"  # none | proof-of-concept | functional | weaponized
    has_exploit: bool = False
    exploit_source: str = ""
    remediation: str = ""
    references: list[str] = []

class VulnCreate(VulnBase):
    pass

class Vulnerability(VulnBase):
    id: str
    status: str = "open"  # open | acknowledged | mitigated | patched | false-positive | ignored
    notes: str = ""
    discovered_by: str = "netvision"
    first_seen: str
    last_seen: str
    updated_at: str

class VulnPatch(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    remediation: Optional[str] = None
    exploitability: Optional[str] = None
    has_exploit: Optional[bool] = None
    exploit_source: Optional[str] = None


# ── Vulnerability Store ─────────────────────────────────────────────

class VulnStore:
    def __init__(self):
        self._vulns: dict[str, Vulnerability] = {}
        self._seed_data()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _seed_data(self):
        seed = [
            VulnCreate(
                cve_id="CVE-2024-21626",
                title="runc container escape (Leaky Vessels)",
                description="A container escape vulnerability in runc that allows a malicious container to gain access to the host filesystem.",
                severity="critical",
                cvss_score=8.6,
                cvss_vector="CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
                affected_device="10.0.1.10",
                affected_port=0,
                affected_service="runtime",
                exploitability="weaponized",
                has_exploit=True,
                exploit_source="Metasploit",
                remediation="Update runc to v1.1.12+ on all container hosts.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-21626"],
            ),
            VulnCreate(
                cve_id="CVE-2024-3094",
                title="XZ Utils backdoor (liblzma)",
                description="A malicious backdoor discovered in XZ Utils versions 5.6.0 and 5.6.1 affecting SSH authentication.",
                severity="critical",
                cvss_score=10.0,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
                affected_device="10.0.1.20",
                affected_port=22,
                affected_service="ssh",
                exploitability="weaponized",
                has_exploit=True,
                exploit_source="Exploit-DB",
                remediation="Downgrade XZ Utils to v5.4.6+ or patch to fixed version immediately.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-3094"],
            ),
            VulnCreate(
                cve_id="CVE-2024-1708",
                title="ConnectWise ScreenConnect auth bypass",
                description="Authentication bypass in ConnectWise ScreenConnect that allows remote code execution on affected servers.",
                severity="critical",
                cvss_score=9.8,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                affected_device="203.0.113.5",
                affected_port=443,
                affected_service="https",
                exploitability="functional",
                has_exploit=True,
                exploit_source="PoC published",
                remediation="Apply ConnectWise patch 24.1 or disable affected endpoints.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-1709"],
            ),
            VulnCreate(
                cve_id="CVE-2024-27198",
                title="JetBrains TeamCity auth bypass",
                description="Authentication bypass in JetBrains TeamCity allowing unauthenticated RCE.",
                severity="critical",
                cvss_score=9.8,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                affected_device="10.0.1.10",
                affected_port=8111,
                affected_service="teamcity",
                exploitability="weaponized",
                has_exploit=True,
                exploit_source="Metasploit",
                remediation="Upgrade TeamCity to v2023.11.4+.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-27198"],
            ),
            VulnCreate(
                cve_id="CVE-2024-0204",
                title="GoAnywhere MFT auth bypass",
                description="Authentication bypass in GoAnywhere MFT that allows creation of admin accounts.",
                severity="high",
                cvss_score=8.1,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                affected_device="10.0.0.50",
                affected_port=8080,
                affected_service="https",
                exploitability="functional",
                has_exploit=True,
                exploit_source="Exploit-DB",
                remediation="Patch to GoAnywhere 7.4.2+ or restrict network access.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-0204"],
            ),
            VulnCreate(
                cve_id="CVE-2024-31497",
                title="PuTTY biased ECDSA nonces",
                description="A vulnerability in PuTTY that leaks private keys through biased ECDSA nonces in generated signatures.",
                severity="high",
                cvss_score=7.4,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                affected_device="10.0.1.10",
                affected_port=22,
                affected_service="ssh",
                exploitability="proof-of-concept",
                has_exploit=False,
                exploit_source="",
                remediation="Update PuTTY to v0.81+ and rotate any keys generated with vulnerable versions.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-31497"],
            ),
            VulnCreate(
                cve_id="CVE-2024-4577",
                title="PHP CGI argument injection (Windows)",
                description="An argument injection vulnerability in PHP CGI mode on Windows allows remote code execution.",
                severity="high",
                cvss_score=9.1,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
                affected_device="203.0.113.5",
                affected_port=80,
                affected_service="http-php",
                exploitability="weaponized",
                has_exploit=True,
                exploit_source="Metasploit",
                remediation="Patch PHP to v8.3.9+ / v8.2.20+ / v8.1.29+.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-4577"],
            ),
            VulnCreate(
                cve_id="CVE-2024-6387",
                title="OpenSSH regreSSHion RCE",
                description="A signal handler race condition in OpenSSH's sshd that allows unauthenticated remote code execution as root.",
                severity="critical",
                cvss_score=8.1,
                cvss_vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
                affected_device="10.0.1.10",
                affected_port=22,
                affected_service="ssh",
                exploitability="functional",
                has_exploit=True,
                exploit_source="PoC published",
                remediation="Update OpenSSH to v9.8p1+ or apply vendor patches.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-6387"],
            ),
            VulnCreate(
                cve_id="CVE-2024-38077",
                title="Windows Remote Desktop Licensing RCE",
                description="A heap-based buffer overflow in Windows Remote Desktop Licensing Service allows remote code execution.",
                severity="critical",
                cvss_score=9.8,
                cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                affected_device="10.0.0.50",
                affected_port=3389,
                affected_service="rdp",
                exploitability="functional",
                has_exploit=True,
                exploit_source="Exploit-DB",
                remediation="Apply Microsoft June 2024 security patches.",
                references=["https://nvd.nist.gov/vuln/detail/CVE-2024-38077"],
            ),
        ]
        for v in seed:
            self._vulns[str(uuid.uuid4())] = Vulnerability(
                id=str(uuid.uuid4()),
                **v.model_dump(),
                first_seen=self._now(),
                last_seen=self._now(),
                updated_at=self._now(),
            )

    # ── CRUD ─────────────────────────────────────────────────────

    def list_vulns(
        self,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        service: Optional[str] = None,
        device: Optional[str] = None,
        exploitability: Optional[str] = None,
        search: Optional[str] = None,
        has_exploit: Optional[bool] = None,
        limit: int = 200,
    ) -> list[Vulnerability]:
        results = list(self._vulns.values())

        if severity:
            results = [v for v in results if v.severity == severity]
        if status:
            results = [v for v in results if v.status == status]
        if service:
            results = [v for v in results if service.lower() in v.affected_service.lower()]
        if device:
            results = [v for v in results if device.lower() in v.affected_device.lower()]
        if exploitability:
            results = [v for v in results if v.exploitability == exploitability]
        if has_exploit is not None:
            results = [v for v in results if v.has_exploit == has_exploit]
        if search:
            q = search.lower()
            results = [
                v for v in results
                if q in v.cve_id.lower()
                or q in v.title.lower()
                or q in v.description.lower()
            ]

        return sorted(results, key=lambda v: (v.cvss_score, v.first_seen), reverse=True)[:limit]

    def get_vuln(self, vuln_id: str) -> Optional[Vulnerability]:
        return self._vulns.get(vuln_id)

    def get_vuln_by_cve(self, cve_id: str) -> Optional[Vulnerability]:
        for v in self._vulns.values():
            if v.cve_id.lower() == cve_id.lower():
                return v
        return None

    def create_vuln(self, data: VulnCreate, discovered_by: str = "manual") -> Vulnerability:
        existing = self.get_vuln_by_cve(data.cve_id)
        if existing:
            # Dedup: update last_seen and refresh data
            now = self._now()
            updated = existing.model_copy(update={
                "title": data.title,
                "description": data.description,
                "severity": data.severity,
                "cvss_score": data.cvss_score,
                "cvss_vector": data.cvss_vector,
                "affected_device": data.affected_device,
                "affected_port": data.affected_port,
                "affected_service": data.affected_service,
                "exploitability": data.exploitability,
                "has_exploit": data.has_exploit,
                "exploit_source": data.exploit_source,
                "remediation": data.remediation,
                "references": data.references,
                "last_seen": now,
                "updated_at": now,
            })
            self._vulns[existing.id] = updated
            return updated

        now = self._now()
        vuln = Vulnerability(
            id=str(uuid.uuid4()),
            **data.model_dump(),
            discovered_by=discovered_by,
            first_seen=now,
            last_seen=now,
            updated_at=now,
        )
        self._vulns[vuln.id] = vuln
        return vuln

    def patch_vuln(self, vuln_id: str, patch: VulnPatch) -> Optional[Vulnerability]:
        existing = self._vulns.get(vuln_id)
        if not existing:
            return None
        updates = {k: v for k, v in patch.model_dump(exclude_none=True).items() if v is not None}
        updates["updated_at"] = self._now()
        updated = existing.model_copy(update=updates)
        self._vulns[vuln_id] = updated
        return updated

    def delete_vuln(self, vuln_id: str) -> bool:
        if vuln_id not in self._vulns:
            return False
        del self._vulns[vuln_id]
        return True

    def bulk_ingest(self, vulns: list[VulnCreate], source: str = "netvision") -> dict:
        created = 0
        updated = 0
        for v in vulns:
            existing = self.get_vuln_by_cve(v.cve_id)
            if existing:
                self.create_vuln(v, discovered_by=source)
                updated += 1
            else:
                self.create_vuln(v, discovered_by=source)
                created += 1
        return {"created": created, "updated": updated, "total": len(vulns)}

    # ── Statistics ───────────────────────────────────────────────

    def stats(self) -> dict:
        vulns = list(self._vulns.values())
        return {
            "total": len(vulns),
            "by_severity": {
                "critical": sum(1 for v in vulns if v.severity == "critical"),
                "high": sum(1 for v in vulns if v.severity == "high"),
                "medium": sum(1 for v in vulns if v.severity == "medium"),
                "low": sum(1 for v in vulns if v.severity == "low"),
                "info": sum(1 for v in vulns if v.severity == "info"),
            },
            "by_status": {
                "open": sum(1 for v in vulns if v.status == "open"),
                "acknowledged": sum(1 for v in vulns if v.status == "acknowledged"),
                "mitigated": sum(1 for v in vulns if v.status == "mitigated"),
                "patched": sum(1 for v in vulns if v.status == "patched"),
                "false-positive": sum(1 for v in vulns if v.status == "false-positive"),
                "ignored": sum(1 for v in vulns if v.status == "ignored"),
            },
            "by_exploitability": {
                "none": sum(1 for v in vulns if v.exploitability == "none"),
                "proof-of-concept": sum(1 for v in vulns if v.exploitability == "proof-of-concept"),
                "functional": sum(1 for v in vulns if v.exploitability == "functional"),
                "weaponized": sum(1 for v in vulns if v.exploitability == "weaponized"),
            },
            "exploits_available": sum(1 for v in vulns if v.has_exploit),
            "critical_exploits": sum(
                1 for v in vulns if v.severity == "critical" and v.has_exploit
            ),
            "avg_cvss": round(sum(v.cvss_score for v in vulns) / len(vulns), 1) if vulns else 0,
            "top_services": self._top_services(vulns, limit=10),
            "affected_devices": len(set(v.affected_device for v in vulns if v.affected_device)),
        }

    def _top_services(self, vulns: list[Vulnerability], limit: int = 10) -> dict:
        counts: dict[str, int] = {}
        for v in vulns:
            svc = v.affected_service or "unknown"
            counts[svc] = counts.get(svc, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit])

    # ── Sync from NetVision ──────────────────────────────────────

    async def sync_from_netvision(self, netvision_vulns: list[dict]) -> dict:
        """Ingest NetVision vulnerability feed into local store."""
        parsed = []
        for nv in netvision_vulns:
            try:
                parsed.append(VulnCreate(
                    cve_id=nv.get("cve_id", "unknown"),
                    title=nv.get("title", nv.get("description", "")[:80]),
                    description=nv.get("description", ""),
                    severity=nv.get("severity", "medium"),
                    cvss_score=float(nv.get("cvss_score", 0) or 0),
                    cvss_vector=nv.get("cvss_vector", ""),
                    affected_device=nv.get("device_ip", ""),
                    affected_port=int(nv.get("port_id", 0)),
                    affected_service=nv.get("service", ""),
                    exploitability=nv.get("exploitability", "none"),
                    has_exploit=bool(nv.get("has_exploit", False)),
                    exploit_source=nv.get("exploit_source", ""),
                    remediation=nv.get("remediation", ""),
                    references=nv.get("references", []),
                ))
            except Exception as e:
                logger.warning("Failed to parse NetVision vuln: %s", e)

        return self.bulk_ingest(parsed, source="netvision")


# ── Singleton ──────────────────────────────────────────────────────

vuln_store = VulnStore()
