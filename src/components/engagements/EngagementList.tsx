'use client';

import { useState } from 'react';
import { useEngagements, useEngagementActions, type Engagement } from '@/hooks/useEngagements';
import { Badge } from '@/components/ui/primitives';
import { formatTime } from './shared';

export function EngagementList({ selected, onSelect }: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: engagements = [] } = useEngagements();
  const actions = useEngagementActions();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [engagementType, setEngagementType] = useState('red');
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? engagements
    : engagements.filter((item) => item.state === filter);

  const create = () => {
    if (!name.trim()) return;
    actions.post.mutate(
      { path: '/api/engagements', body: { name, engagement_type: engagementType } },
      { onSuccess: () => { setName(''); setShowCreate(false); } },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-mono text-[10px] tracking-[0.2em] text-text-dim uppercase">
          Engagements ({engagements.length})
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="font-mono text-[9px] tracking-widest text-accent border border-accent/40 px-3 py-1.5 hover:bg-accent-bg"
        >
          {showCreate ? 'CANCEL' : '+ NEW'}
        </button>
      </div>

      {showCreate && (
        <div className="p-3 border border-border bg-surface space-y-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Engagement name"
            className="w-full bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <select
              value={engagementType}
              onChange={(event) => setEngagementType(event.target.value)}
              className="bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text"
            >
              <option value="red">red</option>
              <option value="purple">purple</option>
              <option value="blue-validation">blue-validation</option>
              <option value="osint">osint</option>
            </select>
            <button
              onClick={create}
              disabled={actions.post.isPending}
              className="font-mono text-[9px] tracking-widest text-bg bg-accent px-3 py-1.5 disabled:opacity-40"
            >
              CREATE
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {['all', 'draft', 'authorized', 'active', 'paused', 'completed'].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase border ${
              filter === key ? 'border-accent text-accent' : 'border-border text-text-dim'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="p-3 border border-border font-mono text-[9px] text-text-dim">
            NO ENGAGEMENTS — CREATE ONE TO BEGIN
          </div>
        )}
        {filtered.map((engagement: Engagement) => (
          <button
            key={engagement.id}
            onClick={() => onSelect(engagement.id)}
            className={`w-full text-left p-3 border transition-colors ${
              selected === engagement.id
                ? 'border-accent bg-accent-bg'
                : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-text-dim">{engagement.code}</span>
              <Badge variant={engagement.state === 'active' ? 'success' : 'default'}>
                {engagement.state}
              </Badge>
            </div>
            <div className="font-mono text-[11px] text-text mt-1 truncate">{engagement.name}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-surface-3">
                <div className="h-full bg-accent" style={{ width: `${engagement.progress}%` }} />
              </div>
              <span className="font-mono text-[8px] text-text-dim">{Math.round(engagement.progress)}%</span>
            </div>
            <div className="font-mono text-[8px] text-text-dim mt-1">
              {engagement.findings_count} findings · {formatTime(engagement.updated_at)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
