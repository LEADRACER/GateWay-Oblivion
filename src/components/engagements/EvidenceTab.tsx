'use client';

import { useEngagementEvidence, type Engagement } from '@/hooks/useEngagements';
import { formatTime } from './shared';

export function EvidenceTab({ engagement }: { engagement: Engagement }) {
  const { data: evidence = [] } = useEngagementEvidence(engagement.id);
  return (
    <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
      {evidence.length === 0 && (
        <div className="p-3 border border-border font-mono text-[9px] text-text-dim">
          NO EVIDENCE CAPTURED YET
        </div>
      )}
      {evidence.map((item) => (
        <div key={item.id} className="p-2 border border-border bg-surface">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-text uppercase">{item.kind}</span>
            <span className="font-mono text-[8px] text-text-dim">{item.source_tool}</span>
          </div>
          <div className="font-mono text-[8px] text-text-dim mt-1 truncate">SHA256: {item.sha256 || item.path_or_hash}</div>
          <div className="font-mono text-[8px] text-text-dim mt-0.5">
            {item.captured_by} · {formatTime(item.captured_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
