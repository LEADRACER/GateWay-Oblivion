'use client';

// ── GateWay:Oblivion — Pipeline Orchestrator Page ─────────────────

import { useState } from 'react';
import {
  usePipelines,
  usePipelineRuns,
  useRunPipeline,
  useApprovePipelineRun,
  useCancelPipelineRun,
  PipelineRun,
} from '@/hooks/useIntelligence';

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING', color: 'var(--color-text-dim)' },
  running: { label: 'RUNNING', color: 'var(--color-info)' },
  completed: { label: 'COMPLETED', color: 'var(--color-accent)' },
  failed: { label: 'FAILED', color: 'var(--color-danger)' },
  cancelled: { label: 'CANCELLED', color: 'var(--color-text-dim)' },
  gated: { label: 'GATED', color: 'var(--color-warning)' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className="font-mono text-[9px] tracking-widest" style={{ color: style.color }}>
      {style.label}
    </span>
  );
}

export default function PipelinesPage() {
  const { data: pipelines = [] } = usePipelines();
  const { data: runs = [] } = usePipelineRuns();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const active = pipelines.find((p) => p.id === selectedId) || pipelines[0];
  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;

  const runMutation = useRunPipeline();
  const approveMutation = useApprovePipelineRun();
  const cancelMutation = useCancelPipelineRun();

  const handleRun = () => {
    if (!active) return;
    runMutation.mutate(active.id);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Pipelines</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Multi-tool orchestration — recon → scan → exploit → report with HITL gates
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={!active || runMutation.isPending}
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all disabled:opacity-40"
        >
          {runMutation.isPending ? 'RUNNING…' : '▶ RUN PIPELINE'}
        </button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* ── Pipeline list ───────────────────── */}
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-1">
            Runbooks
          </h2>
          {pipelines.length === 0 && (
            <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
              NO PIPELINES REGISTERED
            </div>
          )}
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`text-left p-3 rounded border transition-colors ${
                (active?.id || '') === p.id
                  ? 'border-accent/50 bg-accent-bg'
                  : 'border-border bg-surface hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-text">{p.name}</span>
                <span className="font-mono text-[8px] text-text-dim tracking-widest uppercase">
                  RUNBOOK
                </span>
              </div>
              <div className="font-mono text-[8px] text-text-dim mt-1 tracking-wide uppercase">
                {p.steps.length} STEPS
              </div>
            </button>
          ))}
        </div>

        {/* ── Selected pipeline detail ────────── */}
        <div className="flex flex-col gap-4">
          {active ? (
            <div className="p-4 border border-border bg-surface">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm text-text">{active.name}</h3>
              </div>
              <p className="font-mono text-[9px] text-text-dim mt-1 tracking-wide">{active.description}</p>

              <div className="mt-4 flex flex-col gap-2">
                {active.steps.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2 border border-border bg-surface-2 rounded"
                  >
                    <span className="font-mono text-[9px] text-text-dim w-6">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] text-text truncate">{s.name}</div>
                      <div className="font-mono text-[8px] text-text-dim mt-0.5 tracking-wide">
                        {s.tool}::{s.action}
                        {s.depends_on.length > 0 && ` → depends on ${s.depends_on.join(', ')}`}
                        {s.gate ? ' · ⚠ HUMAN GATE' : ''}
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
              SELECT A PIPELINE
            </div>
          )}

          {/* ── Selected run controls ─────────── */}
          {selectedRun && (
            <div className="p-4 border border-border bg-surface">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm text-text">RUN {selectedRun.id.slice(0, 8).toUpperCase()}</h3>
                <StatusBadge status={selectedRun.status} />
              </div>
              {selectedRun.status === 'gated' && !selectedRun.approved && (
                <div className="mt-3 p-3 border border-warning/40 bg-warning/10 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-warning tracking-wide">
                    ⚠ DESTRUCTIVE STEP PENDING HUMAN APPROVAL
                  </span>
                  <button
                    onClick={() => approveMutation.mutate(selectedRun.id)}
                    disabled={approveMutation.isPending}
                    className="font-mono text-[9px] tracking-widest text-bg bg-warning px-3 py-1.5 hover:brightness-110 transition-all disabled:opacity-40"
                  >
                    APPROVE &amp; CONTINUE
                  </button>
                </div>
              )}
              {selectedRun.status === 'running' && (
                <div className="mt-3">
                  <button
                    onClick={() => cancelMutation.mutate(selectedRun.id)}
                    disabled={cancelMutation.isPending}
                    className="font-mono text-[9px] tracking-widest text-text-muted border border-border px-3 py-1.5 hover:text-danger hover:border-danger transition-all disabled:opacity-40"
                  >
                    CANCEL RUN
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Runs ─────────────────────────────── */}
      <div className="mt-8">
        <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
          Pipeline Runs
        </h2>
        {runs.length === 0 ? (
          <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
            NO PIPELINE RUNS YET — EXECUTE A RUNBOOK
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map((r: PipelineRun) => (
              <button
                key={r.id}
                onClick={() => setSelectedRunId(r.id)}
                className="text-left p-3 border border-border bg-surface hover:bg-surface-2 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-text-dim tracking-widest">RUN</span>
                  <span className="font-mono text-[10px] text-text">{r.pipeline_name}</span>
                  <span className="font-mono text-[8px] text-text-dim tracking-wide">{r.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <span className="font-mono text-[8px] text-text-dim tracking-wide">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
