'use client';

import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { CentreMetrics } from '@/hooks/useCentre';

const COLORS: Record<string, string> = {
  red: '#c07468',
  blue: '#7086a3',
  shared: '#5f6267',
  critical: '#c07468',
  high: '#c9a268',
  warning: '#c9a268',
  info: '#6da07f',
};

export function ActivityCharts({ metrics }: { metrics?: CentreMetrics }) {
  const series = metrics?.series ?? [];
  const sides = metrics?.sides ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
      {/* Activity over time */}
      <div className="border border-border bg-surface p-3 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">
            Event Activity · {metrics?.hours ?? 24}h
          </span>
          <div className="flex gap-3">
            {(['red', 'blue', 'shared'] as const).map((key) => (
              <span key={key} className="flex items-center gap-1 font-mono text-[8px] text-text-dim uppercase">
                <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[key] }} />{key}
              </span>
            ))}
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#1e2024" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" stroke="#4a4d54" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis stroke="#4a4d54" tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0d0e10', border: '1px solid #1e2024', fontSize: 10 }}
                labelStyle={{ color: '#6b6e74' }}
              />
              <Area type="monotone" dataKey="red" stackId="1" stroke={COLORS.red} fill={COLORS.red} fillOpacity={0.25} />
              <Area type="monotone" dataKey="blue" stackId="1" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.25} />
              <Area type="monotone" dataKey="shared" stackId="1" stroke={COLORS.shared} fill={COLORS.shared} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side distribution */}
      <div className="border border-border bg-surface p-3 min-w-0">
        <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-2">
          Event Distribution
        </div>
        <div className="h-48 flex items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sides} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}
                   stroke="none" paddingAngle={2}>
                {sides.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name] ?? '#5f6267'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0d0e10', border: '1px solid #1e2024', fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 -ml-16 z-10">
            {sides.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-4">
                <span className="font-mono text-[9px]" style={{ color: COLORS[entry.name] }}>
                  {entry.name.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-text">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
