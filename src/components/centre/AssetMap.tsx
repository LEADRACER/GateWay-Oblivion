'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CentreAssets } from '@/hooks/useCentre';

const VENDOR_COLORS = ['#5ee28a', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#6b7280'];

export function AssetMap({ assets }: { assets?: CentreAssets }) {
  const [selected, setSelected] = useState<string | null>(null);
  const hosts = assets?.hosts ?? [];
  const active = hosts.find((host) => host.ip === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
      <div className="min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
          {hosts.length === 0 && (
            <div className="col-span-full p-3 border border-border font-mono text-[9px] text-text-dim">
              NO ASSETS DISCOVERED — RUN A SONAR SCAN
            </div>
          )}
          {hosts.map((host) => (
            <button
              key={host.ip}
              onClick={() => setSelected(selected === host.ip ? null : host.ip)}
              className={`text-left p-2 border transition-colors min-w-0 ${
                selected === host.ip ? 'border-accent bg-accent-bg' : 'border-border bg-surface hover:bg-surface-2'
              }`}
            >
              <div className="font-mono text-[10px] text-text truncate">{host.ip}</div>
              <div className="font-mono text-[8px] text-text-dim truncate">
                {host.vendor || host.hostname || host.source}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-[8px] text-text-dim">{host.ports} PORTS</span>
                {host.health && (
                  <span className={`font-mono text-[8px] ${host.health === 'up' ? 'text-accent' : 'text-danger'}`}>
                    {host.health.toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        {active && (
          <div className="mt-2 p-2 border border-border bg-surface-2 font-mono text-[9px] text-text-dim grid grid-cols-2 gap-1">
            <span>IP: <span className="text-text">{active.ip}</span></span>
            <span>MAC: <span className="text-text">{active.mac || '—'}</span></span>
            <span>HOST: <span className="text-text">{active.hostname || '—'}</span></span>
            <span>OS: <span className="text-text">{active.os || '—'}</span></span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="font-mono text-[9px] tracking-widest text-text-dim uppercase mb-1">By Vendor</div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={assets?.by_vendor ?? []} dataKey="value" nameKey="name"
                   outerRadius={58} stroke="none">
                {(assets?.by_vendor ?? []).map((entry, index) => (
                  <Cell key={entry.name} fill={VENDOR_COLORS[index % VENDOR_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0d0e10', border: '1px solid #1e2024', fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
