'use client';

import { useState } from 'react';
import { usePipelines } from '@/hooks/useIntelligence';
import { useEngagementActions, type Engagement } from '@/hooks/useEngagements';

export function PipelinesTab({ engagement }: { engagement: Engagement }) {
  const { data: pipelines = [] } = usePipelines();
  const actions = useEngagementActions();
  const [lastRun, setLastRun] = useState<string>('');

  return (
    <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
      {lastRun && (
        <div className="p-2 border border-accent/40 bg-accent-bg font-mono text-[9px] text-accent">
          LAST RUN: {lastRun}
        </div>
      )}
      {pipelines.map((pipeline) => (
        <div key={pipeline.id} className="p-3 border border-border bg-surface flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-text truncate">{pipeline.name}</div>
            <div className="font-mono text-[8px] text-text-dim mt-0.5">
              {pipeline.steps.length} steps · {pipeline.steps.some((step) => step.gate) ? 'GATED' : 'AUTO'}
            </div>
          </div>
          <button
            onClick={() => actions.post.mutate(
              {
                path: `/api/engagements/${engagement.id}/pipelines/${pipeline.id}/run`,
                engagementId: engagement.id,
              },
              {
                onSuccess: (data) => setLastRun(
                  `${pipeline.name}: ${String(data.status ?? 'started')} (${String(data.run_id ?? '').slice(0, 8)})`
                ),
              },
            )}
            disabled={engagement.state !== 'active' || actions.post.isPending}
            className="font-mono text-[9px] tracking-widest text-danger border border-danger/40 px-3 py-1.5 disabled:opacity-40 shrink-0"
          >
            RUN
          </button>
        </div>
      ))}
      {engagement.state !== 'active' && (
        <div className="font-mono text-[8px] text-warning">
          ENGAGEMENT MUST BE ACTIVE TO RUN PIPELINES
        </div>
      )}
    </div>
  );
}
