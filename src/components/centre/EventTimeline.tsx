'use client';

import { useState } from 'react';
import type { CentreEvent } from '@/hooks/useCentre';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  warning: 'text-warning',
  medium: 'text-text-dim',
  low: 'text-info',
  info: 'text-text-dim',
};

function time(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString();
}

export function EventTimeline({ events }: { events: CentreEvent[] }) {
  const [severity, setSeverity] = useState<string>('all');
  const filtered = severity === 'all'
    ? events
    : events.filter((event) => (event.severity || 'info') === severity);

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex flex-wrap gap-1 mb-2">
        {['all', 'critical', 'high', 'warning', 'info'].map((key) => (
          <button
            key={key}
            onClick={() => setSeverity(key)}
            className={`px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase border transition-colors ${
              severity === key ? 'border-accent text-accent' : 'border-border text-text-dim hover:text-text'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="p-3 border border-border font-mono text-[9px] text-text-dim">
            NO EVENTS FOR THIS FILTER
          </div>
        )}
        {filtered.map((event) => {
          const sideColor = event.side === 'red' ? 'text-danger' : event.side === 'blue' ? 'text-info' : 'text-text-dim';
          return (
            <div key={event.id} className="flex items-start gap-2 p-2 border border-border bg-surface hover:bg-surface-2 transition-colors">
              <span className={`font-mono text-[10px] font-bold ${sideColor} w-3 shrink-0`}>
                {event.side === 'red' ? 'R' : event.side === 'blue' ? 'B' : '·'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-text truncate">{event.title}</span>
                  <span className={`font-mono text-[8px] shrink-0 ${SEVERITY_COLOR[event.severity ?? 'info'] || 'text-text-dim'}`}>
                    {(event.severity ?? 'info').toUpperCase()}
                  </span>
                </div>
                <div className="font-mono text-[8px] text-text-dim mt-0.5 truncate">
                  {event.source} · {event.event_type}
                </div>
              </div>
              <span className="font-mono text-[8px] text-text-dim/60 shrink-0">{time(event.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
