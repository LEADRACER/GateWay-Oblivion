'use client';

// ── GateWay:Oblivion — Vulnerability Dashboard Page ───────────────

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useVulnerabilities, useVulnStats, usePatchVuln, useSyncVulns } from '@/hooks/useVulnerabilities';
import { StatCard, Badge } from '@/components/ui/primitives';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
const STATUS_OPTIONS = ['all', 'open', 'acknowledged', 'mitigated', 'patched', 'false-positive', 'ignored'] as const;
const EXPLOIT_OPTIONS = ['all', 'none', 'proof-of-concept', 'functional', 'weaponized'] as const;

export default function VulnerabilitiesPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [exploitFilter, setExploitFilter] = useState<string>('');
  const [hasExploitOnly, setHasExploitOnly] = useState(false);

  const filters: Record<string, string> = {};
  if (severityFilter) filters.severity = severityFilter;
  if (statusFilter) filters.status = statusFilter;
  if (exploitFilter) filters.exploitability = exploitFilter;
  if (hasExploitOnly) filters.has_exploit = 'true';
  if (search) filters.search = search;

  const { data: vulns = [], isLoading } = useVulnerabilities(filters);
  const { data: stats } = useVulnStats();
  const patchVuln = usePatchVuln();
  const syncVulns = useSyncVulns();

  const handleStatusChange = (id: string, status: string) => {
    patchVuln.mutate({ id, status });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">Vulnerabilities</h1>
            <VulnCountBadge total={stats?.total ?? 0} critical={stats?.by_severity?.critical ?? 0} />
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            CVE tracking, severity scoring, exploitability assessment
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncVulns.mutate()}
            disabled={syncVulns.isPending}
            className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {syncVulns.isPending ? 'SYNCING…' : 'SYNC FROM NETVISION'}
          </button>
          <Link
            href="/vulnerabilities/new"
            className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
          >
            + NEW VULN
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────── */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Vulns" value={stats?.total ?? '…'} accent="danger" />
        <StatCard label="Critical" value={stats?.by_severity?.critical ?? '…'} accent="danger" />
        <StatCard label="High" value={stats?.by_severity?.high ?? '…'} accent="warning" />
        <StatCard label="Medium" value={stats?.by_severity?.medium ?? '…'} accent="accent" />
        <StatCard label="Exploits Available" value={stats?.exploits_available ?? '…'} accent="danger" />
        <StatCard label="Avg CVSS" value={stats?.avg_cvss ?? '…'} />
      </div>

      {/* ── Filters ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg border border-border px-3 py-1.5 font-mono text-[10px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-52"
          placeholder="Search CVE ID, title…"
        />

        <label className="font-mono text-[10px] text-text-dim tracking-wider">Severity</label>
        <div className="flex gap-1">
          {['', ...SEVERITIES].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setSeverityFilter(s)}
              className={`font-mono text-[9px] tracking-widest px-2.5 py-1 border transition-colors ${
                severityFilter === s
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-border text-text-dim hover:text-text hover:border-text-dim'
              }`}
            >
              {s ? s.toUpperCase() : 'ALL'}
            </button>
          ))}
        </div>

        <label className="font-mono text-[10px] text-text-dim tracking-wider ml-2">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s === 'all' ? '' : s}>
              {s}
            </option>
          ))}
        </select>

        <label className="font-mono text-[10px] text-text-dim tracking-wider ml-2">Exploitability</label>
        <select
          value={exploitFilter}
          onChange={(e) => setExploitFilter(e.target.value)}
          className="bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text focus:outline-none"
        >
          {EXPLOIT_OPTIONS.map((e) => (
            <option key={e} value={e === 'all' ? '' : e}>
              {e}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 ml-2">
          <input
            type="checkbox"
            checked={hasExploitOnly}
            onChange={(e) => setHasExploitOnly(e.target.checked)}
            className="accent-accent"
          />
          <span className="font-mono text-[10px] text-text-dim">Has exploit</span>
        </label>
      </div>

      {/* ── Table header ────────────────────────── */}
      <div className="grid grid-cols-[2fr_0.6fr_1fr_0.7fr_1.2fr_1.2fr_0.8fr_0.7fr] gap-3 px-3 py-2 border-b border-border">
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">CVE / Title</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Severity</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">CVSS</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Device</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Service</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Exploit</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Status</span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Actions</span>
      </div>

      {/* ── Table body ─────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
        </div>
      )}

      {!isLoading && vulns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <span className="font-mono text-xs text-text-dim">
            {search || severityFilter || statusFilter
              ? 'No vulnerabilities match your filters'
              : 'No vulnerabilities tracked yet'}
          </span>
        </div>
      )}

      {!isLoading && vulns.map((vuln) => (
        <div
          key={vuln.id}
          className="grid grid-cols-[2fr_0.6fr_1fr_0.7fr_1.2fr_1.2fr_0.8fr_0.7fr] gap-3 px-3 py-2.5 border-b border-border hover:bg-surface-2 transition-colors items-center"
        >
          <div className="min-w-0">
            <Link
              href={`/vulnerabilities/${vuln.id}`}
              className="font-mono text-xs text-accent hover:underline"
            >
              {vuln.cve_id}
            </Link>
            <div className="font-mono text-[9px] text-text-dim truncate mt-0.5">
              {vuln.title}
            </div>
          </div>

          <SeverityBadge severity={vuln.severity} />

          <div className="font-mono text-xs text-text">
            {vuln.cvss_score > 0 ? vuln.cvss_score.toFixed(1) : '—'}
          </div>

          <div className="font-mono text-[10px] text-text-dim truncate">
            {vuln.affected_device || '—'}
          </div>

          <div className="font-mono text-[10px] text-text-dim truncate">
            {vuln.affected_service
              ? `${vuln.affected_service}${vuln.affected_port ? '/' + vuln.affected_port : ''}`
              : '—'}
          </div>

          <ExploitIndicator
            exploitability={vuln.exploitability}
            hasExploit={vuln.has_exploit}
            source={vuln.exploit_source}
          />

          <StatusBadge status={vuln.status} />

          <StatusDropdown
            current={vuln.status}
            onChange={(s) => handleStatusChange(vuln.id, s)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Severity Badge ─────────────────────────────────────────────────

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

// ── Status Badge ──────────────────────────────────────────────────

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

// ── Exploit Indicator ─────────────────────────────────────────────

function ExploitIndicator({
  exploitability,
  hasExploit,
  source,
}: {
  exploitability: string;
  hasExploit: boolean;
  source: string;
}) {
  const eColor: Record<string, string> = {
    weaponized: 'text-danger',
    functional: 'text-warning',
    ['proof-of-concept']: 'text-accent',
    none: 'text-text-dim',
  };
  return (
    <div>
      <span className={`font-mono text-[9px] tracking-wider ${eColor[exploitability] || 'text-text-dim'}`}>
        {exploitability === 'weaponized' ? 'WEAPONIZED' :
         exploitability === 'functional' ? 'FUNCTIONAL' :
         exploitability === 'proof-of-concept' ? 'PoC' :
         exploitability === 'none' ? 'NONE' : exploitability}
      </span>
      {source && (
        <div className="font-mono text-[8px] text-text-dim">{source}</div>
      )}
    </div>
  );
}

// ── Status Dropdown ───────────────────────────────────────────────

function StatusDropdown({
  current,
  onChange,
}: {
  current: string;
  onChange: (status: string) => void;
}) {
  const options = ['open', 'acknowledged', 'mitigated', 'patched', 'false-positive', 'ignored'];
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg border border-border px-1.5 py-1 font-mono text-[9px] text-text focus:outline-none focus:border-accent w-full max-w-[100px]"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// ── Count Badge ───────────────────────────────────────────────────

function VulnCountBadge({ total, critical }: { total: number; critical: number }) {
  return (
    <span className="font-mono text-[10px] tracking-widest text-danger border border-danger/30 px-2 py-0.5">
      {total} total · {critical} critical
    </span>
  );
}
