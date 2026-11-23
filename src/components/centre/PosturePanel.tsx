'use client';

import type { CentreOverview } from '@/hooks/useCentre';

export function PosturePanel({
  blue,
  scope,
  toolsReady = [],
}: {
  blue?: CentreOverview['blue'];
  scope?: CentreOverview['scope'];
  toolsReady?: string[];
}) {
  const score = blue?.posture_score ?? 0;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between font-mono text-[9px] tracking-widest text-text-dim uppercase">
          <span>Posture Score</span>
          <span className="text-text">{score}/100</span>
        </div>
        <div className="h-2 bg-surface-3 mt-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${score >= 70 ? 'bg-accent' : 'bg-warning'}`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Mini label="Ops Success" value={`${blue?.operations_success_rate ?? 0}%`} />
        <Mini label="Critical Alerts" value={String(blue?.critical_detections ?? 0)} />
      </div>

      <div>
        <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-1.5">
          Blue Sources
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(blue?.blue_sources ?? {}).map(([name, ready]) => (
            <span
              key={name}
              className={`font-mono text-[8px] tracking-widest uppercase border px-2 py-0.5 ${
                ready ? 'border-accent/40 text-accent' : 'border-border text-text-dim'
              }`}
            >
              {name} {ready ? 'ON' : 'OFF'}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-1.5">
          Tools Ready
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toolsReady.map((name) => (
            <span key={name} className="font-mono text-[8px] border border-border px-2 py-0.5 text-text capitalize">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="p-2 border border-border bg-surface-2">
        <div className="font-mono text-[8px] tracking-widest text-text-dim uppercase">Scope</div>
        <div className="font-mono text-[9px] text-text mt-0.5 truncate">
          {scope?.enforced ? scope.allowlist.join(', ') : 'ADVISORY / NO ALLOWLIST'}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 border border-border bg-surface">
      <div className="font-mono text-[8px] tracking-widest text-text-dim uppercase">{label}</div>
      <div className="font-mono text-sm text-text mt-0.5">{value}</div>
    </div>
  );
}
