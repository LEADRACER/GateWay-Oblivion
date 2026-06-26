'use client';

// ── GateWay:Oblivion — Scans Dashboard Page ──────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { useOperations } from '@/hooks/useOperations';
import { StatCard } from '@/components/ui/primitives';

export default function ScansPage() {
  const { data: operations = [], isLoading } = useOperations();
  const scans = operations.filter((op) => op.operation_type === 'scan');

  const running = scans.filter((s) => s.status === 'running');
  const completed = scans.filter((s) => s.status === 'completed');
  const failed = scans.filter((s) => s.status === 'failed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Scans</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Reconnaissance and discovery operations
          </p>
        </div>
        <Link
          href="/operations/new"
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
        >
          + NEW SCAN
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Scans" value={scans.length} accent="accent" />
        <StatCard label="Running" value={running.length} accent="warning">
          {running.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 bg-warning animate-pulse rounded-full" />
              <span className="font-mono text-[9px] text-warning">In progress</span>
            </div>
          )}
        </StatCard>
        <StatCard label="Completed" value={completed.length} accent="accent" />
        <StatCard label="Failed" value={failed.length} accent="danger" />
        <StatCard
          label="Success Rate"
          value={scans.length > 0 ? `${Math.round((completed.length / scans.length) * 100)}%` : '—'}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            <span className="font-mono text-[10px] text-text-dim">Loading scans…</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && scans.length === 0 && (
        <div className="border border-dashed border-border bg-surface flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-2xl">📡</span>
          <span className="font-mono text-xs text-text-dim">No scans recorded</span>
          <p className="font-mono text-[10px] text-text-dim text-center max-w-md leading-relaxed">
            Scans are created through the Operations module. Start a new scan
            operation to populate this dashboard.
          </p>
          <div className="flex gap-2 mt-2">
            <Link
              href="/operations/new"
              className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
            >
              NEW SCAN OPERATION
            </Link>
            <Link
              href="/recon"
              className="font-mono text-[10px] tracking-widest text-accent border border-accent/30 px-4 py-2 hover:bg-accent/10"
            >
              RECON DASHBOARD
            </Link>
          </div>
        </div>
      )}

      {/* Scan table */}
      {scans.length > 0 && (
        <div className="border border-border bg-surface">
          <div className="grid grid-cols-[3fr_1fr_1fr_1.2fr_1fr_1fr] gap-3 px-4 py-3 border-b border-border font-mono text-[9px] tracking-widest text-text-dim uppercase">
            <span>Name</span>
            <span>Status</span>
            <span>Target</span>
            <span>Progress</span>
            <span>Duration</span>
            <span>Actions</span>
          </div>

          {scans.map((scan) => (
            <ScanRow key={scan.id} scan={scan} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scan Row ─────────────────────────────────────────────────────

function ScanRow({ scan }: { scan: { id: string; title?: string; status: string; target?: string; progress?: number; created_at?: string; completed_at?: string } }) {
  const statusColors: Record<string, string> = {
    running: 'text-warning border-warning/30 bg-warning/5',
    completed: 'text-accent border-accent/30 bg-accent/5',
    failed: 'text-danger border-danger/30 bg-danger/5',
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

  const progressBarColors: Record<string, string> = {
    running: 'bg-warning',
    completed: 'bg-accent',
    failed: 'bg-danger',
    cancelled: 'bg-text-dim',
    pending: 'bg-text-dim',
  };

  const startTime = scan.created_at ? new Date(scan.created_at).getTime() : null;
  const endTime = scan.completed_at ? new Date(scan.completed_at).getTime() : null;
  let duration = '—';
  if (startTime && endTime) {
    const secs = Math.round((endTime - startTime) / 1000);
    duration = secs > 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  } else if (startTime && scan.status === 'running') {
    const secs = Math.round((Date.now() - startTime) / 1000);
    duration = secs > 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  }

  return (
    <Link
      href={`/operations/${scan.id}`}
      className="group grid grid-cols-[3fr_1fr_1fr_1.2fr_1fr_1fr] gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 items-center hover:bg-surface-2 transition-colors"
    >
      <div className="min-w-0">
        <span className="font-mono text-[11px] text-text group-hover:text-accent transition-colors truncate block">
          {scan.title || scan.id}
        </span>
      </div>

      <span className={`font-mono text-[8px] tracking-widest border px-1.5 py-0.5 flex items-center gap-1.5 justify-center w-fit ${statusColors[scan.status] || 'text-text-dim border-border/50'}`}>
        <span className={`w-1 h-1 rounded-full ${statusDots[scan.status] || 'bg-text-dim'}`} />
        {scan.status.toUpperCase()}
      </span>

      <span className="font-mono text-[10px] text-text-dim truncate">{scan.target || '—'}</span>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded overflow-hidden">
          <div
            className={`h-full rounded transition-all duration-700 ${progressBarColors[scan.status] || 'bg-text-dim'}`}
            style={{ width: `${scan.progress ?? 0}%` }}
          />
        </div>
        <span className="font-mono text-[9px] text-text-dim w-8 text-right">{scan.progress ?? 0}%</span>
      </div>

      <span className="font-mono text-[10px] text-text-dim">{duration}</span>

      <div>
        <span className="font-mono text-[9px] text-accent tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
          VIEW →
        </span>
      </div>
    </Link>
  );
}
