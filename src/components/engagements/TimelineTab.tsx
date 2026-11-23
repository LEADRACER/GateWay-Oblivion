'use client';

import {
  useEngagementEvents, type Engagement,
} from '@/hooks/useEngagements';
import { formatTime, severityColor } from './shared';

export function TimelineTab({ engagement }: { engagement: Engagement }) {
  const { data: events = [] } = useEngagementEvents(engagement.id);
  return (
    <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
      {events.length === 0 && (
        <div className="p-3 border border-border font-mono text-[9px] text-text-dim">
          NO ENGAGEMENT EVENTS YET — RUN A PIPELINE OR TOOL ACTION WITH X-ENGAGEMENT
        </div>
      )}
      {events.map((event) => (
        <div key={event.id} className="p-2 border border-border bg-surface">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-text truncate">{event.title}</span>
            <span className="font-mono text-[8px]" style={{ color: severityColor(event.severity || 'info') }}>
              {(event.severity || 'info').toUpperCase()}
            </span>
          </div>
          <div className="font-mono text-[8px] text-text-dim mt-0.5">
            {event.source_tool} · {event.event_type} · {formatTime(event.timestamp)}
          </div>
        </div>
      ))}
    </div>
  );
}
