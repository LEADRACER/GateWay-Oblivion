'use client';

// ── GateWay:Oblivion — Tools Dashboard Page ────────────────────────

import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface ToolInfo {
  name: string;
  status: string;
  available?: boolean;
  connected?: boolean;
  actions: string[];
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  available: { label: 'ONLINE', color: 'var(--color-accent)' },
  unavailable: { label: 'OFFLINE', color: 'var(--color-danger)' },
  error: { label: 'ERROR', color: 'var(--color-danger)' },
  connected: { label: 'CONNECTED', color: 'var(--color-accent)' },
};

export default function ToolsPage() {
  const { data: tools = [], isLoading, refetch } = useQuery<ToolInfo[]>({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/tools`);
      if (!res.ok) throw new Error('Failed to fetch tools');
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: 30_000,
  });

  const connectMutation = useMutation({
    mutationFn: async (tool: string) => {
      const res = await fetch(`${API_BASE}/api/tools/${tool}/connect`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to connect');
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (tool: string) => {
      const res = await fetch(`${API_BASE}/api/tools/${tool}/disconnect`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-mono text-text mb-1">Tools</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Unified command surface for NetVision, Metasploit, Recon-ng and God&apos;s Eye View
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="font-mono text-[10px] tracking-widest text-text-muted border border-border px-3 py-1.5 hover:text-accent hover:border-accent transition-all"
        >
          REFRESH
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            <span className="font-mono text-[10px] text-text-dim">Loading tools…</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {tools.map((t) => {
            const style = STATUS_STYLES[t.status] || STATUS_STYLES.unavailable;
            const online = t.status === 'available';
            return (
              <div key={t.name} className="p-4 rounded border border-border bg-surface">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: style.color, boxShadow: `0 0 8px ${style.color}` }}
                    />
                    <span className="font-mono text-sm text-text">{t.name}</span>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest" style={{ color: style.color }}>
                    {style.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {t.actions.map((a) => (
                      <span
                        key={a}
                        className="font-mono text-[9px] tracking-wide text-text-dim border border-border px-2 py-0.5 rounded"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {online ? (
                      <button
                        onClick={() => connectMutation.mutate(t.name)}
                        disabled={t.connected}
                        className="font-mono text-[9px] tracking-widest px-2 py-1 border border-border text-text-muted hover:text-accent hover:border-accent transition-all disabled:opacity-40"
                      >
                        CONNECT
                      </button>
                    ) : null}
                    <button
                      onClick={() => disconnectMutation.mutate(t.name)}
                      disabled={!t.connected}
                      className="font-mono text-[9px] tracking-widest px-2 py-1 border border-border text-text-muted hover:text-danger hover:border-danger transition-all disabled:opacity-40"
                    >
                      DISCONNECT
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
