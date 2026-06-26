'use client';

// ── GateWay:Oblivion — Campaign Manager Component ─────────────────

import { useState } from 'react';
import { useCampaigns, useCreateCampaign, useDeleteCampaign } from '@/hooks/useCampaigns';
import { Badge } from '@/components/ui/primitives';

export function CampaignManager() {
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createCampaign.mutateAsync({ name, description: description || undefined });
    setName('');
    setDescription('');
    setShowCreate(false);
  };

  const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
    active: 'success',
    draft: 'default',
    paused: 'warning',
    completed: 'info',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Campaigns</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="font-mono text-[10px] tracking-widest text-accent hover:text-accent/80 transition-colors"
        >
          {showCreate ? '— CANCEL' : '+ NEW CAMPAIGN'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 mb-4 p-3 border border-border bg-surface-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
            placeholder="Campaign name"
            required
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
            placeholder="Description (optional)"
          />
          <button
            type="submit"
            disabled={createCampaign.isPending || !name.trim()}
            className="self-end font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 disabled:opacity-50"
          >
            {createCampaign.isPending ? 'CREATING...' : 'CREATE'}
          </button>
        </form>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-20">
          <div className="w-4 h-4 border-2 border-border border-t-accent animate-spin rounded-full" />
        </div>
      )}

      {campaigns && campaigns.length === 0 && (
        <div className="flex items-center justify-center h-20 border border-dashed border-border">
          <span className="font-mono text-[10px] text-text-dim">No campaigns yet</span>
        </div>
      )}

      {campaigns && campaigns.length > 0 && (
        <div className="flex flex-col gap-1">
          {campaigns.map((camp) => (
            <div key={camp.id} className="flex items-center justify-between p-3 border border-border bg-surface hover:bg-surface-2 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-text truncate">{camp.name}</div>
                {camp.description && (
                  <div className="font-mono text-[10px] text-text-dim truncate mt-0.5">{camp.description}</div>
                )}
                <div className="font-mono text-[9px] text-text-dim mt-1">{camp.targets.length} target(s)</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={statusVariant[camp.status] || 'default'}>{camp.status}</Badge>
                <button
                  onClick={() => { if (confirm('Delete this campaign?')) deleteCampaign.mutate(camp.id); }}
                  className="font-mono text-[10px] text-text-dim hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
