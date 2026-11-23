'use client';

import type { Engagement } from '@/hooks/useEngagements';

export function ReportsTab({ engagement }: { engagement: Engagement }) {
  return (
    <div className="p-4 border border-border bg-surface space-y-2">
      <div className="font-mono text-[10px] text-text uppercase">Engagement Report</div>
      <p className="font-mono text-[9px] text-text-dim leading-relaxed">
        Report generation and Obsidian export are planned for the next engagement phase.
        The activity record, findings, evidence and audit chain for {engagement.code} are already
        persisted in the local SQLite database and can be exported through the existing
        intelligence report endpoints.
      </p>
    </div>
  );
}
