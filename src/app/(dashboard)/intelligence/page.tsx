'use client';

// ── GateWay:Oblivion — Intelligence Dashboard Page ────────────────

import { useState } from 'react';
import Link from 'next/link';
import {
  useIntelSummary,
  useTimeline,
  useThreats,
  useReports,
} from '@/hooks/useIntelligence';
import { StatCard } from '@/components/ui/primitives';

export default function IntelligencePage() {
  const { data: summary } = useIntelSummary();
  const { data: timeline = [] } = useTimeline();
  const { data: threats = [] } = useThreats();
  const { data: reports = [] } = useReports();

  const sev = summary?.severity_breakdown ?? {};

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">Intelligence</h1>
            <NetVisionBadge reachable={summary?.netvision_status.reachable ?? false} />
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Executive summary, threat feed, and security reporting
          </p>
        </div>
        <Link
          href="/intelligence/reports/generate"
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
        >
          + GENERATE REPORT
        </Link>
      </div>

      {/* ── Stat cards ────────────────────────── */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard label="Risk Score" value={summary?.risk_score ?? '…'} accent={summary?.risk_score && summary.risk_score >= 7 ? 'danger' : summary?.risk_score && summary.risk_score >= 4 ? 'warning' : 'accent'} />
        <StatCard label="Total Vulns" value={summary?.total_vulnerabilities ?? '…'} accent="accent" />
        <StatCard label="Critical" value={sev.critical ?? 0} accent="danger" />
        <StatCard label="High" value={sev.high ?? 0} accent="warning" />
        <StatCard label="Exploits" value={summary?.critical_exploits ?? '…'} accent="danger" />
        <StatCard label="Ops Success" value={summary ? `${summary.operations_success_rate}%` : '…'} />
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* ── Left column ────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Threat Feed */}
          {threats.length > 0 && (
            <>
              <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Threat Feed</h2>
              <div className="flex flex-col gap-1">
                {threats.map((t) => (
                  <ThreatRow key={t.id} threat={t} />
                ))}
              </div>
            </>
          )}

          {/* Timeline */}
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Security Timeline (48h)</h2>
          <div className="flex flex-col gap-1">
            {timeline.map((evt) => (
              <TimelineRow key={evt.id} event={evt} />
            ))}
          </div>
        </div>

        {/* ── Right column ───────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Severity Breakdown */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
              Severity Breakdown
            </h3>
            <div className="flex flex-col gap-2.5">
              <SeverityBar label="Critical" count={sev.critical ?? 0} color="var(--color-danger)" total={summary?.total_vulnerabilities ?? 1} />
              <SeverityBar label="High" count={sev.high ?? 0} color="var(--color-warning)" total={summary?.total_vulnerabilities ?? 1} />
              <SeverityBar label="Medium" count={sev.medium ?? 0} color="var(--color-text-dim)" total={summary?.total_vulnerabilities ?? 1} />
              <SeverityBar label="Low" count={sev.low ?? 0} color="var(--color-text-dim)" total={summary?.total_vulnerabilities ?? 1} />
            </div>
          </div>

          {/* Recent Reports */}
          <div className="border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Reports</h3>
              <Link
                href="/intelligence/reports"
                className="font-mono text-[9px] tracking-wider text-accent hover:underline"
              >
                View all →
              </Link>
            </div>
            {reports.length === 0 && (
              <span className="font-mono text-[10px] text-text-dim">No reports yet</span>
            )}
            {reports.slice(0, 4).map((r) => (
              <Link
                key={r.id}
                href={`/intelligence/reports/${r.id}`}
                className="block py-2 border-b border-border last:border-b-0 hover:opacity-80 transition-opacity"
              >
                <div className="font-mono text-[10px] text-accent truncate">{r.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <TypeBadge type={r.report_type} />
                  {r.risk_score && (
                    <span className="font-mono text-[9px] text-text-dim">
                      Score: {r.risk_score}/10
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function NetVisionBadge({ reachable }: { reachable: boolean }) {
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 flex items-center gap-1.5 ${
      reachable ? 'text-accent border-accent/30' : 'text-warning border-warning/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${reachable ? 'bg-accent' : 'bg-warning animate-pulse'}`} />
      NETVISION {reachable ? 'CONNECTED' : 'OFFLINE'}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    executive: 'EXECUTIVE',
    technical: 'TECHNICAL',
    compliance: 'COMPLIANCE',
    recon: 'RECON',
    operations: 'OPS',
  };
  const colors: Record<string, string> = {
    executive: 'text-accent border-accent/30',
    technical: 'text-info border-info/30',
    compliance: 'text-warning border-warning/30',
    recon: 'text-text-dim border-border/50',
    operations: 'text-text border-border',
  };
  return (
    <span className={`font-mono text-[8px] tracking-widest border px-1 py-0.5 ${colors[type] || 'text-text-dim border-border/50'}`}>
      {labels[type] || type.toUpperCase()}
    </span>
  );
}

function ThreatRow({ threat }: { threat: { type: string; title: string; severity: string; source: string; affected: string; status: string; timestamp: string } }) {
  const severityColors: Record<string, string> = {
    critical: 'text-danger',
    high: 'text-warning',
    medium: 'text-text-dim',
    low: 'text-text-dim/60',
  };

  const statusColors: Record<string, string> = {
    active: 'text-danger border-danger/30',
    confirmed: 'text-warning border-warning/30',
    investigating: 'text-info border-info/30',
  };

  return (
    <div className="grid grid-cols-[1.5fr_0.6fr_0.8fr_1.2fr_0.6fr] gap-3 px-3 py-2.5 border border-border hover:bg-surface-2 transition-colors items-center">
      <div className="min-w-0">
        <div className="font-mono text-[10px] text-text truncate">{threat.title}</div>
        <div className="font-mono text-[8px] text-text-dim mt-0.5">{threat.source}</div>
      </div>
      <span className={`font-mono text-[9px] tracking-wider ${severityColors[threat.severity] || 'text-text-dim'}`}>
        {threat.severity.toUpperCase()}
      </span>
      <span className="font-mono text-[9px] tracking-widest text-text-dim">{threat.type.toUpperCase()}</span>
      <span className="font-mono text-[9px] text-text-dim truncate">{threat.affected}</span>
      <span className={`font-mono text-[8px] tracking-widest border px-1 py-0.5 text-center ${statusColors[threat.status] || 'text-text-dim border-border/50'}`}>
        {threat.status}
      </span>
    </div>
  );
}

function TimelineRow({ event }: { event: { event_type: string; title: string; description?: string; severity?: string; timestamp: string } }) {
  const icons: Record<string, string> = {
    vulnerability: '⚡',
    operation: '⚙',
    scan: '📡',
    alert: '🚨',
    target: '🎯',
  };

  const severityColors: Record<string, string> = {
    critical: 'text-danger',
    high: 'text-warning',
    medium: 'text-text-dim',
  };

  return (
    <div className="flex items-start gap-3 px-3 py-2 border border-border hover:bg-surface-2 transition-colors">
      <span className="text-xs mt-0.5">{icons[event.event_type] || '·'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text">{event.title}</span>
          {event.severity && (
            <span className={`font-mono text-[8px] tracking-wider ${severityColors[event.severity] || 'text-text-dim'}`}>
              {event.severity.toUpperCase()}
            </span>
          )}
        </div>
        {event.description && (
          <div className="font-mono text-[9px] text-text-dim mt-0.5">{event.description}</div>
        )}
        <div className="font-mono text-[8px] text-text-dim/50 mt-0.5">
          {new Date(event.timestamp + 'Z').toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function SeverityBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[9px] tracking-wider text-text-dim uppercase">{label}</span>
        <span className="font-mono text-[9px] text-text-dim">{count}</span>
      </div>
      <div className="h-1.5 bg-border rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
