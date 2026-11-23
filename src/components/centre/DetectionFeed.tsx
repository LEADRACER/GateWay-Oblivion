'use client';

import { useState } from 'react';
import type { CentreDetection } from '@/hooks/useCentre';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  warning: 'text-warning',
  medium: 'text-text-dim',
  low: 'text-info',
  info: 'text-text-dim',
};

export function DetectionFeed({ detections }: { detections: CentreDetection[] }) {
  const [source, setSource] = useState<string>('all');
  const sources = ['all', ...Array.from(new Set(detections.map((d) => d.source)))];
  const filtered = source === 'all' ? detections : detections.filter((d) => d.source === source);

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex flex-wrap gap-1 mb-2">
        {sources.map((key) => (
          <button
            key={key}
            onClick={() => setSource(key)}
            className={`px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase border transition-colors ${
              source === key ? 'border-info text-info' : 'border-border text-text-dim hover:text-text'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="p-3 border border-border font-mono text-[9px] text-text-dim">
            NO ACTIVE DETECTIONS
          </div>
        )}
        {filtered.map((detection) => (
          <div key={detection.id} className="p-2 border border-border bg-surface hover:bg-surface-2 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] text-text truncate">{detection.title}</span>
              <span className={`font-mono text-[8px] shrink-0 ${SEVERITY_COLOR[detection.severity] || 'text-text-dim'}`}>
                {detection.severity.toUpperCase()}
              </span>
            </div>
            <div className="font-mono text-[8px] text-text-dim mt-0.5 truncate">
              {detection.source} · {detection.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
