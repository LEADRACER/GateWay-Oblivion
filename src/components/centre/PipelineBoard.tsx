'use client';

import {
  usePipelines, useRunPipeline, useApprovePipelineRun,
  type Pipeline,
} from '@/hooks/useIntelligence';

export function PipelineBoard({ gatedRunIds = [] }: { gatedRunIds?: string[] }) {
  const { data: pipelines = [] } = usePipelines();
  const runPipeline = useRunPipeline();
  const approveRun = useApprovePipelineRun();

  return (
    <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
      {pipelines.length === 0 && (
        <div className="p-3 border border-border font-mono text-[9px] text-text-dim">
          NO RUNBOOKS REGISTERED
        </div>
      )}
      {pipelines.map((pipeline: Pipeline) => {
        const hasGate = pipeline.steps.some((step) => step.gate);
        return (
          <div key={pipeline.id} className="p-3 border border-border bg-surface hover:border-danger/40 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-text truncate">{pipeline.name}</span>
              <button
                onClick={() => runPipeline.mutate(pipeline.id)}
                disabled={runPipeline.isPending}
                className="font-mono text-[8px] tracking-widest text-danger border border-danger/40 px-2 py-1 hover:bg-danger/10 disabled:opacity-40 shrink-0"
              >
                RUN
              </button>
            </div>
            <div className="font-mono text-[8px] text-text-dim mt-1 tracking-wide">
              {pipeline.steps.length} STEPS {hasGate ? '· ⚠ HUMAN GATE' : ''}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {pipeline.steps.map((step) => (
                <span key={step.id} className="font-mono text-[7px] border border-border px-1 py-0.5 text-text-dim truncate max-w-[120px]">
                  {step.tool}::{step.action}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {gatedRunIds.length > 0 && (
        <div className="p-2 border border-warning/40 bg-warning/10">
          <div className="font-mono text-[9px] text-warning tracking-wider">
            ⚠ {gatedRunIds.length} RUN(S) AWAITING APPROVAL
          </div>
          {gatedRunIds.map((id) => (
            <button
              key={id}
              onClick={() => approveRun.mutate(id)}
              className="mt-2 font-mono text-[8px] tracking-widest text-bg bg-warning px-2 py-1 hover:brightness-110"
            >
              APPROVE {id.slice(0, 8).toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
