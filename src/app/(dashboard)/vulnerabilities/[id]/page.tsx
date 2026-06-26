'use client';

// ── GateWay:Oblivion — Vulnerability Detail Page ───────────────────

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useVulnerability,
  usePatchVuln,
  useDeleteVuln,
} from '@/hooks/useVulnerabilities';
import { Badge } from '@/components/ui/primitives';

export default function VulnDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: vuln, isLoading } = useVulnerability(id);
  const patchVuln = usePatchVuln();
  const deleteVuln = useDeleteVuln();

  const [notes, setNotes] = useState('');
  const [remediation, setRemediation] = useState('');

  // Sync form fields when data loads
  if (vuln && !notes && !remediation) {
    if (vuln.notes) setNotes(vuln.notes);
    if (vuln.remediation) setRemediation(vuln.remediation);
  }

  const handleSave = () => {
    patchVuln.mutate({ id, notes, remediation });
  };

  const handleStatusChange = (status: string) => {
    patchVuln.mutate({ id, status });
  };

  const handleDelete = () => {
    if (window.confirm(`Delete ${vuln?.cve_id}?`)) {
      deleteVuln.mutate(id, {
        onSuccess: () => router.push('/vulnerabilities'),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-border border-t-accent animate-spin rounded-full" />
      </div>
    );
  }

  if (!vuln) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="font-mono text-sm text-text-dim">Vulnerability not found</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">{vuln.cve_id}</h1>
            <SeverityBadge severity={vuln.severity} />
            <StatusBadge status={vuln.status} />
            <ExploitBadge exploitability={vuln.exploitability} />
          </div>
          <p className="font-mono text-xs text-text-dim mt-1">{vuln.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/vulnerabilities')}
            className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2 transition-colors"
          >
            ← BACK
          </button>
          <button
            onClick={handleDelete}
            className="font-mono text-[10px] tracking-widest text-danger border border-danger/30 px-4 py-2 hover:bg-danger/10 transition-colors"
          >
            DELETE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* ── Left column ────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Description */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">Description</h3>
            <p className="font-mono text-xs text-text leading-relaxed">{vuln.description}</p>
          </div>

          {/* CVSS Score */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">CVSS Assessment</h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-mono text-text">{vuln.cvss_score.toFixed(1)}</div>
              <div className="flex-1">
                <div className="h-2 bg-border rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all ${
                      vuln.cvss_score >= 9 ? 'bg-danger' :
                      vuln.cvss_score >= 7 ? 'bg-warning' :
                      vuln.cvss_score >= 4 ? 'bg-accent' :
                      'bg-text-dim'
                    }`}
                    style={{ width: `${(vuln.cvss_score / 10) * 100}%` }}
                  />
                </div>
                <div className="font-mono text-[9px] text-text-dim mt-1">
                  Vector: {vuln.cvss_vector || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Status actions */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Status Actions</h3>
            <div className="flex flex-wrap gap-2">
              {['open', 'acknowledged', 'mitigated', 'patched', 'false-positive', 'ignored'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`font-mono text-[10px] tracking-wider px-3 py-1.5 border transition-colors ${
                    vuln.status === s
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'border-border text-text-dim hover:text-text hover:border-text-dim'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes + Remediation */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Notes & Remediation</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-mono text-[9px] tracking-wider text-text-dim mb-1 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent h-24 resize-none"
                  placeholder="Investigation notes, reproduction steps, references…"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] tracking-wider text-text-dim mb-1 block">Remediation Plan</label>
                <textarea
                  value={remediation}
                  onChange={(e) => setRemediation(e.target.value)}
                  className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent h-24 resize-none"
                  placeholder="Steps to remediate, patch references, mitigation details…"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={patchVuln.isPending}
                className="self-end font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all disabled:opacity-50"
              >
                {patchVuln.isPending ? 'SAVING…' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column ───────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Info panel */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Details</h3>
            <div className="flex flex-col gap-2.5">
              <InfoRow label="CVE ID" value={vuln.cve_id} />
              <InfoRow label="Severity" value={vuln.severity.toUpperCase()} />
              <InfoRow label="CVSS Score" value={vuln.cvss_score.toFixed(1)} />
              <InfoRow label="Affected Device" value={vuln.affected_device || '—'} />
              <InfoRow label="Affected Port" value={vuln.affected_port ? String(vuln.affected_port) : '—'} />
              <InfoRow label="Affected Service" value={vuln.affected_service || '—'} />
              <InfoRow label="Exploitability" value={vuln.exploitability} />
              <InfoRow label="Has Exploit" value={vuln.has_exploit ? 'Yes' : 'No'} />
              {vuln.exploit_source && <InfoRow label="Exploit Source" value={vuln.exploit_source} />}
              <InfoRow label="Discovered By" value={vuln.discovered_by} />
              <InfoRow label="Status" value={vuln.status} />
              <InfoRow label="First Seen" value={new Date(vuln.first_seen).toLocaleDateString()} />
              <InfoRow label="Last Seen" value={new Date(vuln.last_seen).toLocaleDateString()} />
            </div>
          </div>

          {/* References */}
          {vuln.references.length > 0 && (
            <div className="border border-border bg-surface p-4">
              <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">References</h3>
              <div className="flex flex-col gap-1.5">
                {vuln.references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-accent hover:underline truncate"
                  >
                    {ref}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] tracking-wider text-text-dim uppercase">{label}</span>
      <span className="font-mono text-xs text-text text-right max-w-[160px] truncate">{value}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'text-danger border-danger/40 bg-danger/10',
    high: 'text-warning border-warning/40 bg-warning/10',
    medium: 'text-accent border-accent/40 bg-accent/10',
    low: 'text-text-muted border-border',
    info: 'text-text-dim border-border/50',
  };
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 uppercase ${colors[severity] || colors.info}`}>
      {severity || 'info'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'text-danger border-danger/30',
    acknowledged: 'text-warning border-warning/30',
    mitigated: 'text-accent border-accent/30',
    patched: 'text-text-muted border-border',
    ['false-positive']: 'text-text-dim border-border/50',
    ignored: 'text-text-dim border-border/50',
  };
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${colors[status] || 'text-text-dim border-border'}`}>
      {status || 'open'}
    </span>
  );
}

function ExploitBadge({ exploitability }: { exploitability: string }) {
  const colors: Record<string, string> = {
    weaponized: 'text-danger border-danger/30',
    functional: 'text-warning border-warning/30',
    ['proof-of-concept']: 'text-accent border-accent/30',
    none: 'text-text-dim border-border/50',
  };
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${colors[exploitability] || 'text-text-dim border-border'}`}>
      {exploitability || 'none'}
    </span>
  );
}
