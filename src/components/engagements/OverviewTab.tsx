'use client';

import {
  useEngagementScope, useEngagementRoe, useEngagementMetrics,
  type Engagement,
} from '@/hooks/useEngagements';
import { KpiStrip } from '@/components/centre/KpiStrip';
import { formatTime } from './shared';

export function OverviewTab({ engagement }: { engagement: Engagement }) {
  const { data: scope } = useEngagementScope(engagement.id);
  const { data: roe } = useEngagementRoe(engagement.id);
  const { data: metrics } = useEngagementMetrics(engagement.id);

  return (
    <div className="space-y-4">
      <KpiStrip
        kpis={[
          { label: 'Progress', value: `${Math.round(metrics?.progress ?? 0)}%`, color: '#5ee28a' },
          { label: 'Tasks', value: metrics?.tasks_total ?? 0, color: '#60a5fa', sub: `${metrics?.task_status?.done ?? 0} done` },
          { label: 'Findings', value: metrics?.findings_total ?? 0, color: '#f87171', sub: `${metrics?.findings_by_severity?.critical ?? 0} critical` },
          { label: 'Evidence', value: metrics?.evidence_count ?? 0, color: '#fbbf24' },
          { label: 'Events', value: metrics?.events_count ?? 0, color: '#a78bfa' },
          { label: 'Risk', value: metrics?.risk_score ?? 0, color: '#5ee28a' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 border border-border bg-surface">
          <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-2">Objective</div>
          <p className="font-mono text-[11px] text-text leading-relaxed">
            {engagement.objective || 'No objective recorded.'}
          </p>
          <div className="font-mono text-[8px] text-text-dim mt-3">
            Client: {engagement.client || 'Internal'} · Start: {formatTime(engagement.start_at)} · End: {formatTime(engagement.end_at)}
          </div>
        </div>

        <div className="p-4 border border-border bg-surface">
          <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-2">
            Rules of Engagement
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] ${roe?.signed ? 'text-accent' : 'text-danger'}`}>
              {roe?.signed ? 'SIGNED' : 'UNSIGNED'}
            </span>
            <span className="font-mono text-[9px] text-text-dim">
              by {roe?.authorized_by || '—'} · v{roe?.version ?? 0}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-3">
            {(roe?.stop_conditions ?? []).map((condition) => (
              <span key={condition} className="font-mono text-[8px] border border-warning/40 text-warning px-2 py-0.5">
                {condition}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border border-border bg-surface">
        <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-2">Scope Summary</div>
        <div className="flex flex-wrap gap-1.5">
          {(scope?.include ?? []).map((item) => (
            <span key={item} className="font-mono text-[9px] border border-accent/40 text-accent px-2 py-0.5">{item}</span>
          ))}
          {(scope?.exclude ?? []).map((item) => (
            <span key={item} className="font-mono text-[9px] border border-danger/40 text-danger px-2 py-0.5">! {item}</span>
          ))}
        </div>
        <div className="font-mono text-[8px] text-text-dim mt-3">
          Tools: {(scope?.allowed_tools ?? []).join(', ') || 'all'} · Actions: {(scope?.allowed_actions ?? []).join(', ') || 'all'}
        </div>
      </div>
    </div>
  );
}
