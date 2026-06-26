'use client';

// ── GateWay:Oblivion — Operations Dashboard Page ──────────────────

import { useState } from 'react';
import Link from 'next/link';
import {
  useOperations,
  useOpsStats,
  useRunbooks,
  useCancelOperation,
  useCreateOperation,
} from '@/hooks/useOperations';
import { StatCard, Badge } from '@/components/ui/primitives';

export default function OperationsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filters: Record<string, string> = {};
  if (typeFilter) filters.operation_type = typeFilter;
  if (statusFilter) filters.status = statusFilter;
  if (search) filters.search = search;

  const { data: ops = [], isLoading } = useOperations(filters);
  const { data: stats } = useOpsStats();
  const { data: runbooks = [] } = useRunbooks();
  const cancelOp = useCancelOperation();
  const createOp = useCreateOperation();

  const handleRunRunbook = (runbook: { name: string }) => {
    createOp.mutate({
      name: `${runbook.name} — ${new Date().toLocaleDateString()}`,
      operation_type: 'runbook',
      target_ref: '',
      parameters: { runbook: runbook.name },
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">Operations</h1>
            <RunningCount running={stats?.running ?? 0} />
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Execute scans, commands, and runbook workflows
          </p>
        </div>
        <Link
          href="/operations/new"
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
        >
          + NEW OPERATION
        </Link>
      </div>

      {/* ── Stat cards ──────────────────────────── */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard label="Total" value={stats?.total ?? '…'} accent="accent" />
        <StatCard label="Running" value={stats?.running ?? '…'} accent="accent" />
        <StatCard label="Pending" value={stats?.pending ?? '…'} />
        <StatCard label="Completed" value={stats?.completed ?? '…'} />
        <StatCard label="Failed" value={stats?.failed ?? '…'} accent="danger" />
        <StatCard label="Scans" value={stats?.by_type?.scan ?? '…'} />
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* ── Left column: Operations table ────── */}
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-bg border border-border px-3 py-1.5 font-mono text-[10px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-48"
              placeholder="Search operations…"
            />

            <label className="font-mono text-[10px] text-text-dim tracking-wider">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text focus:outline-none"
            >
              <option value="">All</option>
              <option value="scan">Scan</option>
              <option value="command">Command</option>
              <option value="runbook">Runbook</option>
              <option value="manual">Manual</option>
            </select>

            <label className="font-mono text-[10px] text-text-dim tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text focus:outline-none"
            >
              <option value="">All</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_0.8fr_1fr_1.2fr_0.8fr_1.2fr_1fr] gap-3 px-3 py-2 border-b border-border">
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Operation</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Type</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Status</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Target</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Progress</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Duration</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Actions</span>
          </div>

          {/* Table body */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            </div>
          )}

          {!isLoading && ops.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
              <span className="font-mono text-xs text-text-dim">
                {search || typeFilter || statusFilter
                  ? 'No operations match your filters'
                  : 'No operations yet'}
              </span>
            </div>
          )}

          {!isLoading && ops.map((op) => (
            <div
              key={op.id}
              className="grid grid-cols-[2fr_0.8fr_1fr_1.2fr_0.8fr_1.2fr_1fr] gap-3 px-3 py-2.5 border-b border-border hover:bg-surface-2 transition-colors items-center"
            >
              <div className="min-w-0">
                <Link
                  href={`/operations/${op.id}`}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {op.name}
                </Link>
                <div className="font-mono text-[9px] text-text-dim mt-0.5">
                  {new Date(op.created_at).toLocaleDateString()}
                </div>
              </div>

              <TypeBadge type={op.operation_type} />
              <StatusBadge status={op.status} />
              <span className="font-mono text-[10px] text-text-dim truncate">
                {op.target_ref || '—'}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-border rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all ${
                      op.status === 'failed' ? 'bg-danger' :
                      op.status === 'running' ? 'bg-accent' :
                      op.status === 'completed' ? 'bg-accent' :
                      'bg-text-dim'
                    }`}
                    style={{ width: `${op.progress}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-text-dim">{op.progress}%</span>
              </div>
              <span className="font-mono text-[10px] text-text-dim">
                {op.duration_seconds
                  ? `${(op.duration_seconds / 60).toFixed(0)}m`
                  : op.status === 'running'
                    ? '…'
                    : '—'}
              </span>

              <div className="flex gap-1">
                {op.status === 'running' && (
                  <button
                    onClick={() => cancelOp.mutate(op.id)}
                    className="font-mono text-[9px] tracking-wider text-danger border border-danger/30 px-1.5 py-0.5 hover:bg-danger/10"
                  >
                    Cancel
                  </button>
                )}
                <Link
                  href={`/operations/${op.id}`}
                  className="font-mono text-[9px] tracking-wider text-text border border-border px-1.5 py-0.5 hover:bg-surface-2"
                >
                  Logs
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── Right column: Runbooks ──────────── */}
        <div className="flex flex-col gap-4">
          {/* Active operations */}
          <div className="border border-border bg-surface p-4">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
              Active Operations
            </h2>
            {stats?.running === 0 && stats?.pending === 0 && (
              <span className="font-mono text-[10px] text-text-dim">No active operations</span>
            )}
            {ops
              .filter((o) => o.status === 'running' || o.status === 'pending')
              .slice(0, 5)
              .map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/operations/${op.id}`}
                      className="font-mono text-[10px] text-accent hover:underline truncate block"
                    >
                      {op.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TypeBadge type={op.operation_type} />
                      <div className="h-1 flex-1 bg-border rounded overflow-hidden max-w-[80px]">
                        <div
                          className="h-full bg-accent rounded"
                          style={{ width: `${op.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {op.status === 'running' && (
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0 ml-2" />
                  )}
                </div>
              ))}
          </div>

          {/* Runbooks */}
          <div className="border border-border bg-surface p-4">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
              Runbooks
            </h2>
            <div className="flex flex-col gap-2">
              {runbooks.map((rb) => (
                <button
                  key={rb.name}
                  onClick={() => handleRunRunbook(rb)}
                  disabled={createOp.isPending}
                  className="flex items-center justify-between p-2 border border-border hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] text-text">{rb.name}</div>
                    <div className="font-mono text-[9px] text-text-dim truncate mt-0.5">
                      {rb.description}
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-text-dim shrink-0 ml-2">
                    {rb.steps.length} steps →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function RunningCount({ running }: { running: number }) {
  if (running === 0) return null;
  return (
    <span className="font-mono text-[10px] tracking-widest text-accent border border-accent/30 px-2 py-0.5 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      {running} active
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    scan: 'text-accent border-accent/30',
    command: 'text-warning border-warning/30',
    runbook: 'text-info border-info/30',
    manual: 'text-text-dim border-border/50',
  };
  return (
    <span className={`font-mono text-[8px] tracking-widest border px-1 py-0.5 uppercase ${colors[type] || colors.manual}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'text-accent border-accent/30',
    completed: 'text-text-muted border-border',
    failed: 'text-danger border-danger/30',
    pending: 'text-warning border-warning/30',
    cancelled: 'text-text-dim border-border/50',
  };
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${colors[status] || 'text-text-dim border-border'}`}>
      {status}
    </span>
  );
}
