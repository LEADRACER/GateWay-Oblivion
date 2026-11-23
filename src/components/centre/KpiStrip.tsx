'use client';

export interface Kpi {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}

export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="border border-border bg-surface p-3 border-l-2 transition-colors hover:bg-surface-2"
          style={{ borderLeftColor: kpi.color }}
        >
          <div className="font-mono text-[8px] tracking-widest text-text-dim uppercase truncate">
            {kpi.label}
          </div>
          <div className="font-mono text-2xl mt-1" style={{ color: kpi.color }}>{kpi.value}</div>
          {kpi.sub && <div className="font-mono text-[8px] text-text-dim mt-1 truncate">{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}
