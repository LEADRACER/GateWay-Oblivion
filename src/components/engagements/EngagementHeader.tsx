'use client';

import { useEngagementActions, type Engagement, type EngagementMetrics } from '@/hooks/useEngagements';
import { Badge } from '@/components/ui/primitives';
import { formatTime, stateColor } from './shared';

export function EngagementHeader({ engagement, metrics }: {
  engagement: Engagement;
  metrics?: EngagementMetrics;
}) {
  const actions = useEngagementActions();
  const canActivate = engagement.state === 'authorized';
  const canAbort = ['active', 'paused', 'authorized'].includes(engagement.state);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border border-border bg-surface">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-text-dim tracking-widest">{engagement.code}</span>
          <h1 className="font-mono text-lg text-text tracking-tight truncate">{engagement.name}</h1>
          <Badge variant={engagement.state === 'active' ? 'success' : 'default'}>{engagement.state}</Badge>
          <Badge variant="info">{engagement.engagement_type}</Badge>
          <Badge variant={engagement.priority === 'critical' ? 'danger' : 'default'}>
            {engagement.priority}
          </Badge>
        </div>
        <p className="font-mono text-[9px] text-text-dim mt-1 truncate">
          Lead: {engagement.lead_operator} · Team: {engagement.team.join(', ') || '—'} ·
          Created {formatTime(engagement.created_at)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-[8px] text-text-dim uppercase tracking-widest">Risk</div>
          <div className="font-mono text-lg" style={{ color: stateColor(engagement.state) }}>
            {metrics?.risk_score ?? engagement.risk_score}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[8px] text-text-dim uppercase tracking-widest">Progress</div>
          <div className="font-mono text-lg text-accent">{Math.round(metrics?.progress ?? engagement.progress)}%</div>
        </div>
        {canActivate && (
          <button
            onClick={() => actions.post.mutate({
              path: `/api/engagements/${engagement.id}/activate`,
              engagementId: engagement.id,
            })}
            disabled={actions.post.isPending}
            className="font-mono text-[9px] tracking-widest text-bg bg-accent px-3 py-2 disabled:opacity-40"
          >
            ACTIVATE
          </button>
        )}
        {canAbort && (
          <button
            onClick={() => actions.post.mutate({
              path: `/api/engagements/${engagement.id}/abort`,
              body: { reason: 'Aborted from dashboard' },
              engagementId: engagement.id,
            })}
            disabled={actions.post.isPending}
            className="font-mono text-[9px] tracking-widest text-danger border border-danger/40 px-3 py-2 hover:bg-danger/10 disabled:opacity-40"
          >
            ABORT
          </button>
        )}
      </div>
    </div>
  );
}
