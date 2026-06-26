'use client';

// ── GateWay:Oblivion — Operation Detail Page ─────────────────────

import { useParams, useRouter } from 'next/navigation';
import {
  useOperation,
  useCancelOperation,
  useDeleteOperation,
} from '@/hooks/useOperations';
import { Badge } from '@/components/ui/primitives';

export default function OperationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: op, isLoading } = useOperation(id);
  const cancelOp = useCancelOperation();
  const deleteOp = useDeleteOperation();

  const handleDelete = () => {
    if (window.confirm(`Delete operation "${op?.name}"?`)) {
      deleteOp.mutate(id, { onSuccess: () => router.push('/operations') });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-border border-t-accent animate-spin rounded-full" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="font-mono text-sm text-text-dim">Operation not found</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">{op.name}</h1>
            <TypeBadge type={op.operation_type} />
            <StatusBadge status={op.status} />
          </div>
          <div className="font-mono text-[10px] text-text-dim mt-1 flex items-center gap-3">
            <span>Target: <span className="text-text">{op.target_ref || '—'}</span></span>
            {op.started_at && (
              <span>Started: {new Date(op.started_at).toLocaleString()}</span>
            )}
            {op.duration_seconds && (
              <span>Duration: {(op.duration_seconds / 60).toFixed(1)}m</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/operations')}
            className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2 transition-colors"
          >
            ← BACK
          </button>
          {op.status === 'running' && (
            <button
              onClick={() => cancelOp.mutate(id)}
              className="font-mono text-[10px] tracking-widest text-warning border border-warning/30 px-4 py-2 hover:bg-warning/10 transition-colors"
            >
              CANCEL
            </button>
          )}
          <button
            onClick={handleDelete}
            className="font-mono text-[10px] tracking-widest text-danger border border-danger/30 px-4 py-2 hover:bg-danger/10 transition-colors"
          >
            DELETE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* ── Left: Logs ───────────────────────── */}
        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
              Operation Logs ({op.logs.length})
            </h2>
            {op.status === 'running' && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="font-mono text-[9px] text-accent tracking-wider">LIVE</span>
              </div>
            )}
          </div>

          {op.logs.length === 0 ? (
            <div className="py-8 text-center">
              <span className="font-mono text-[10px] text-text-dim">No logs recorded yet</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[600px] overflow-y-auto font-mono">
              {op.logs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Details ──────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Info panel */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Details</h3>
            <div className="flex flex-col gap-2.5">
              <InfoRow label="Type" value={op.operation_type} />
              <InfoRow label="Status" value={op.status} />
              <InfoRow label="Progress" value={`${op.progress}%`} />
              <InfoRow label="Target" value={op.target_ref || '—'} />
              {op.started_at && (
                <InfoRow label="Started" value={new Date(op.started_at).toLocaleString()} />
              )}
              {op.completed_at && (
                <InfoRow label="Completed" value={new Date(op.completed_at).toLocaleString()} />
              )}
              {op.duration_seconds && (
                <InfoRow label="Duration" value={`${(op.duration_seconds / 60).toFixed(1)}m`} />
              )}
              <InfoRow label="Created" value={new Date(op.created_at).toLocaleDateString()} />
            </div>
          </div>

          {/* Result */}
          {op.result_summary && (
            <div className="border border-border bg-surface p-4">
              <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">Result</h3>
              <p className="font-mono text-[10px] text-text leading-relaxed">{op.result_summary}</p>
            </div>
          )}

          {/* Progress bar */}
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">Progress</h3>
            <div className="h-2 bg-border rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  op.status === 'failed' ? 'bg-danger' :
                  op.status === 'completed' ? 'bg-accent' :
                  'bg-accent animate-pulse'
                }`}
                style={{ width: `${op.progress}%` }}
              />
            </div>
            <div className="font-mono text-[9px] text-text-dim mt-1 text-right">{op.progress}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function LogEntry({ log }: { log: { level: string; message: string; timestamp: string } }) {
  const colors: Record<string, string> = {
    info: 'text-text-dim',
    warn: 'text-warning',
    error: 'text-danger',
    debug: 'text-text-dim/50',
    result: 'text-accent',
  };

  const labels: Record<string, string> = {
    info: '→',
    warn: '⚠',
    error: '✗',
    result: '✓',
    debug: '·',
  };

  return (
    <div className={`flex items-start gap-2 py-1 ${colors[log.level] || 'text-text-dim'}`}>
      <span className="shrink-0 w-3 text-center font-mono text-[9px]">{labels[log.level] || '·'}</span>
      <span className="font-mono text-[9px] leading-relaxed whitespace-pre-wrap break-all">
        {log.message}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] tracking-wider text-text-dim uppercase">{label}</span>
      <span className="font-mono text-xs text-text text-right max-w-[160px] truncate">{value}</span>
    </div>
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
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 uppercase ${colors[type] || colors.manual}`}>
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
