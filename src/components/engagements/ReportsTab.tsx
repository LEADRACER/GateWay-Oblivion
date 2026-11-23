'use client';

import { useState } from 'react';
import {
  useEngagementReport, useEngagementReports, useEngagementActions,
  type Engagement,
} from '@/hooks/useEngagements';
import { formatTime } from './shared';

export function ReportsTab({ engagement }: { engagement: Engagement }) {
  const [kind, setKind] = useState('executive');
  const { data: report } = useEngagementReport(engagement.id, kind);
  const { data: reports = [] } = useEngagementReports(engagement.id);
  const actions = useEngagementActions();

  const generate = () => actions.post.mutate({
    path: `/api/engagements/${engagement.id}/report`,
    body: { kind },
    engagementId: engagement.id,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {['executive', 'technical'].map((option) => (
          <button
            key={option}
            onClick={() => setKind(option)}
            className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase border ${
              kind === option ? 'border-accent text-accent' : 'border-border text-text-dim'
            }`}
          >
            {option}
          </button>
        ))}
        <button
          onClick={generate}
          disabled={actions.post.isPending}
          className="font-mono text-[9px] tracking-widest text-bg bg-accent px-3 py-1.5 disabled:opacity-40"
        >
          {actions.post.isPending ? 'GENERATING…' : 'GENERATE + EXPORT'}
        </button>
        {report && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/engagements/${engagement.id}/report/download?kind=${kind}`}
            className="font-mono text-[9px] tracking-widest text-info border border-info/40 px-3 py-1.5"
          >
            DOWNLOAD .MD
          </a>
        )}
      </div>

      {report ? (
        <div className="space-y-2">
          <div className="font-mono text-[9px] text-text-dim">
            Path: <span className="text-text">{report.path}</span> · Generated {formatTime(report.generated_at)}
          </div>
          <pre className="p-3 border border-border bg-surface font-mono text-[9px] text-text-dim leading-relaxed max-h-[420px] overflow-auto whitespace-pre-wrap">
            {report.content}
          </pre>
        </div>
      ) : (
        <div className="p-4 border border-border bg-surface font-mono text-[9px] text-text-dim">
          NO {kind.toUpperCase()} REPORT YET — GENERATE ONE TO EXPORT TO OBSIDIAN
        </div>
      )}

      <div>
        <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-2">
          Generated Reports ({reports.length})
        </div>
        <div className="space-y-1">
          {reports.map((item) => (
            <div key={item.id} className="p-2 border border-border bg-surface flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-text uppercase">{item.kind}</span>
              <span className="font-mono text-[8px] text-text-dim truncate">{item.path}</span>
              <span className="font-mono text-[8px] text-text-dim">{formatTime(item.generated_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
