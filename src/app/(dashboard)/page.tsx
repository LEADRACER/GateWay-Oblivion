'use client';

// ── GateWay:Oblivion — Hub Command Dashboard ─────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { useOverview } from '@/hooks/useOverview';
import type { VulnItem, RecentOperation } from '@/hooks/useOverview';
import { StatCard } from '@/components/ui/primitives';

export default function OverviewPage() {
  const { data, isLoading, isError } = useOverview();
  const stats = data?.stats;

  return (
    <div>
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">Command Center</h1>
            <HubBadge count={data?.services.length ?? 0} />
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Central hub — {data?.services.map((s) => s.name).join(' · ') || 'no connected services'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickActionButton href="/operations/new" label="NEW OP" />
          <QuickActionButton href="/vulnerabilities/new" label="NEW VULN" />
          <QuickActionButton href="/intelligence/reports/generate" label="NEW REPORT" />
        </div>
      </div>

      {/* ── Loading state ──────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-border border-t-accent animate-spin rounded-full" />
            <span className="font-mono text-[10px] text-text-dim">Loading command center…</span>
          </div>
        </div>
      )}

      {/* ── Error/offline state ────────────────── */}
      {isError && (
        <div className="border border-warning/30 bg-warning/5 p-6 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-warning animate-pulse rounded-full" />
            <span className="font-mono text-[10px] text-warning tracking-widest uppercase">Backend Offline</span>
          </div>
          <p className="font-mono text-[10px] text-text-dim mt-2 leading-relaxed">
            Cannot reach the Oblivion API server. Start it with{' '}
            <code className="text-accent">python3 backend/main.py</code> to see live data.
          </p>
        </div>
      )}

      {/* ── Connected Services Bar ─────────────── */}
      {data?.services && data.services.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          {data.services.map((svc) => (
            <ServiceBadge key={svc.name} service={svc} />
          ))}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Risk Score"
          value={stats?.risk_score ?? '…'}
          accent={
            stats && stats.risk_score >= 7 ? 'danger' :
            stats && stats.risk_score >= 4 ? 'warning' : 'accent'
          }
        >
          {stats && (
            <div className="h-1 bg-border rounded overflow-hidden mt-2">
              <div
                className={`h-full rounded ${
                  stats.risk_score >= 7 ? 'bg-danger' :
                  stats.risk_score >= 4 ? 'bg-warning' : 'bg-accent'
                }`}
                style={{ width: `${stats.risk_score * 10}%` }}
              />
            </div>
          )}
        </StatCard>

        <StatCard label="Vulnerabilities" value={stats?.total_vulnerabilities ?? '…'} accent="danger">
          {stats && stats.total_vulnerabilities > 0 && (
            <div className="flex gap-2 mt-1">
              <span className="font-mono text-[9px] text-danger">{stats.critical_vulnerabilities} critical</span>
              <span className="font-mono text-[9px] text-warning">{stats.high_vulnerabilities} high</span>
            </div>
          )}
        </StatCard>

        <StatCard label="Targets" value={stats?.total_targets ?? '…'} accent="info">
          {stats && stats.total_targets > 0 && (
            <Link href="/targets" className="font-mono text-[9px] text-accent hover:underline block mt-1">
              View all →
            </Link>
          )}
        </StatCard>

        <StatCard label="Operations" value={stats?.operations_total ?? '…'} accent="accent">
          {stats && stats.operations_running > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 bg-warning animate-pulse rounded-full" />
              <span className="font-mono text-[9px] text-warning">{stats.operations_running} running</span>
            </div>
          )}
          {stats && stats.operations_running === 0 && stats.operations_total > 0 && (
            <Link href="/operations" className="font-mono text-[9px] text-accent hover:underline block mt-1">
              View history →
            </Link>
          )}
        </StatCard>
      </div>

      {/* ── Main grid ──────────────────────────── */}
      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="flex flex-col gap-6">
          {/* Critical Vulnerabilities */}
          {data?.critical_vulnerabilities && data.critical_vulnerabilities.length > 0 && (
            <SectionCard title="Critical Vulnerabilities" href="/vulnerabilities?severity=critical" count={data.critical_vulnerabilities.length}>
              {data.critical_vulnerabilities.map((v) => (
                <VulnRow key={v.id} vuln={v} />
              ))}
            </SectionCard>
          )}

          {/* High Vulnerabilities */}
          {data?.high_vulnerabilities && data.high_vulnerabilities.length > 0 && (
            <SectionCard title="High Vulnerabilities" href="/vulnerabilities?severity=high" count={data.high_vulnerabilities.length}>
              {data.high_vulnerabilities.map((v) => (
                <VulnRow key={v.id} vuln={v} />
              ))}
            </SectionCard>
          )}

          {/* Recent Operations */}
          {data?.recent_operations && data.recent_operations.length > 0 && (
            <SectionCard title="Recent Operations" href="/operations" count={data.recent_operations.length}>
              {data.recent_operations.map((op) => (
                <OpRow key={op.id} op={op} />
              ))}
            </SectionCard>
          )}

          {/* Empty states */}
          {data && !data.critical_vulnerabilities?.length && !data.recent_operations?.length && (
            <div className="border border-border bg-surface p-8 flex flex-col items-center justify-center gap-3">
              <span className="font-mono text-xs text-text-dim">No data yet</span>
              <p className="font-mono text-[10px] text-text-dim text-center leading-relaxed max-w-sm">
                Start by adding targets, running scans, or generating reports.
                Everything aggregates here in real time.
              </p>
              <div className="flex gap-2 mt-2">
                <Link
                  href="/targets/new"
                  className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
                >
                  ADD TARGET
                </Link>
                <Link
                  href="/operations/new"
                  className="font-mono text-[10px] tracking-widest text-accent border border-accent/30 px-4 py-2 hover:bg-accent/10 transition-colors"
                >
                  RUN OPERATION
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ──────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Hub Status */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Hub</h3>
            <HubServiceRow name="Oblivion API" status="online" version="v0.5" />
            {data?.services.map((svc) => (
              <HubServiceRow key={svc.name} name={svc.name} status={svc.status} version={svc.version} />
            ))}
          </div>

          {/* Summary */}
          {stats && (
            <div className="border border-border bg-surface p-4">
              <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Summary</h3>
              <div className="flex flex-col gap-2.5">
                <SummaryRow label="Vulnerabilities" value={String(stats.total_vulnerabilities)} />
                <SummaryRow label="Critical" value={String(stats.critical_vulnerabilities)} accent="danger" />
                <SummaryRow label="High" value={String(stats.high_vulnerabilities)} accent="warning" />
                <SummaryRow label="Targets" value={String(stats.total_targets)} />
                <SummaryRow label="Operations" value={String(stats.operations_total)} />
                <SummaryRow label="Reports" value={String(stats.reports_count)} />
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Quick Links</h3>
            <div className="flex flex-col gap-1.5">
              <QuickLink href="/recon" label="Reconnaissance" />
              <QuickLink href="/targets" label="Target Management" />
              <QuickLink href="/vulnerabilities" label="Vulnerabilities" />
              <QuickLink href="/operations" label="Operations" />
              <QuickLink href="/intelligence" label="Intelligence" />
              <QuickLink href="/intelligence/reports" label="Reports" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function HubBadge({ count }: { count: number }) {
  return (
    <span className="font-mono text-[9px] tracking-widest text-accent border border-accent/30 px-1.5 py-0.5">
      HUB · {count} SERVICE{count !== 1 ? 'S' : ''}
    </span>
  );
}

function QuickActionButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="font-mono text-[9px] tracking-widest text-bg bg-accent px-3 py-1.5 hover:brightness-110 transition-all"
    >
      + {label}
    </Link>
  );
}

function ServiceBadge({ service }: { service: { name: string; status: string; type: string } }) {
  const statusColors: Record<string, string> = {
    online: 'text-accent border-accent/30',
    offline: 'text-danger border-danger/30',
    degraded: 'text-warning border-warning/30',
  };
  const statusDots: Record<string, string> = {
    online: 'bg-accent',
    offline: 'bg-danger',
    degraded: 'bg-warning',
  };
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-2 py-1 flex items-center gap-1.5 ${statusColors[service.status] || 'text-text-dim border-border/50'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDots[service.status] || 'bg-text-dim'}`} />
      {service.name} · {service.status.toUpperCase()}
    </span>
  );
}

function SectionCard({ title, href, count, children }: { title: string; href: string; count: number; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-text-dim">{count}</span>
          <Link href={href} className="font-mono text-[9px] text-accent hover:underline">View all →</Link>
        </div>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

function VulnRow({ vuln }: { vuln: VulnItem }) {
  const severityColors: Record<string, string> = {
    critical: 'text-danger',
    high: 'text-warning',
    medium: 'text-text-dim',
    low: 'text-text-dim/60',
  };

  const exploitabilityLabels: Record<string, string> = {
    weaponized: 'WPN',
    functional: 'FUNC',
    'proof-of-concept': 'PoC',
  };

  return (
    <Link
      href={`/vulnerabilities/${vuln.id}`}
      className="group grid grid-cols-[2fr_0.8fr_1.2fr_0.6fr_auto] gap-3 py-2.5 border-b border-border/50 last:border-b-0 items-center hover:opacity-80 transition-opacity"
    >
      <div className="min-w-0">
        <div className="font-mono text-xs text-text truncate">{vuln.cve_id}</div>
        <div className="font-mono text-[9px] text-text-dim truncate mt-0.5">{vuln.title}</div>
      </div>
      <span className={`font-mono text-[9px] tracking-wider ${severityColors[vuln.severity] || 'text-text-dim'}`}>
        {vuln.severity.toUpperCase()}
      </span>
      <span className="font-mono text-[9px] text-text-dim truncate">{vuln.affected_device}</span>
      <span className="font-mono text-[9px] text-text-dim">
        {vuln.cvss_score ? vuln.cvss_score.toFixed(1) : '—'}
      </span>
      <div className="flex items-center gap-1.5">
        {vuln.exploitability && vuln.exploitability !== 'none' && (
          <span className={`font-mono text-[8px] tracking-widest border px-1 py-0.5 ${
            vuln.exploitability === 'weaponized' ? 'text-danger border-danger/30' :
            vuln.exploitability === 'functional' ? 'text-warning border-warning/30' :
            'text-text-dim border-border/50'
          }`}>
            {exploitabilityLabels[vuln.exploitability] || vuln.exploitability.toUpperCase()}
          </span>
        )}
        {vuln.has_exploit && (
          <span className="font-mono text-[8px] text-danger">⚡</span>
        )}
      </div>
    </Link>
  );
}

function OpRow({ op }: { op: RecentOperation }) {
  const statusColors: Record<string, string> = {
    running: 'text-warning border-warning/30',
    completed: 'text-accent border-accent/30',
    failed: 'text-danger border-danger/30',
    cancelled: 'text-text-dim border-border/50',
    pending: 'text-text-dim border-border/50',
  };
  const statusDots: Record<string, string> = {
    running: 'bg-warning animate-pulse',
    completed: 'bg-accent',
    failed: 'bg-danger',
    cancelled: 'bg-text-dim',
    pending: 'bg-text-dim',
  };
  const typeLabels: Record<string, string> = {
    scan: 'SCAN',
    command: 'CMD',
    runbook: 'RUN',
    manual: 'MAN',
  };

  return (
    <Link
      href={`/operations/${op.id}`}
      className="group grid grid-cols-[2fr_0.6fr_0.8fr_1fr] gap-3 py-2.5 border-b border-border/50 last:border-b-0 items-center hover:opacity-80 transition-opacity"
    >
      <div className="min-w-0">
        <div className="font-mono text-xs text-text truncate">{op.title}</div>
      </div>
      <span className="font-mono text-[8px] tracking-widest text-text-dim border border-border/50 px-1 py-0.5 text-center">
        {typeLabels[op.type] || op.type.toUpperCase()}
      </span>
      <span className={`font-mono text-[8px] tracking-widest border px-1 py-0.5 text-center flex items-center justify-center gap-1 ${statusColors[op.status] || 'text-text-dim border-border/50'}`}>
        <span className={`w-1 h-1 rounded-full ${statusDots[op.status] || 'bg-text-dim'}`} />
        {op.status.toUpperCase()}
      </span>
      <span className="font-mono text-[9px] text-text-dim text-right">
        {new Date(op.created_at).toLocaleDateString()}
      </span>
    </Link>
  );
}

function HubServiceRow({ name, status, version }: { name: string; status: string; version?: string }) {
  const dotColors: Record<string, string> = {
    online: 'bg-accent',
    offline: 'bg-danger',
    degraded: 'bg-warning',
  };
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] || 'bg-text-dim'}`} />
        <span className="font-mono text-[10px] text-text">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {version && <span className="font-mono text-[8px] text-text-dim">{version}</span>}
        <span className={`font-mono text-[8px] tracking-widest ${
          status === 'online' ? 'text-accent' : status === 'offline' ? 'text-danger' : 'text-warning'
        }`}>
          {status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] tracking-wider text-text-dim uppercase">{label}</span>
      <span className={`font-mono text-xs ${accent ? `text-${accent}` : 'text-text'}`}>{value}</span>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="font-mono text-[10px] text-text-dim hover:text-accent hover:pl-1 transition-all py-1"
    >
      → {label}
    </Link>
  );
}
