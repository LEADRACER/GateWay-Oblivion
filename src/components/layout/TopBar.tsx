'use client';

// ── GateWay:Oblivion — Top Bar ─────────────────────────────────────

import { useSidebarStore } from '@/stores/operations';
import { useTools } from '@/hooks/useTools';
import { useWS } from '@/hooks/useWS';

const API_HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
const WS_URL = API_HOST.replace(/^http/, 'ws');

export function TopBar() {
  const toggle = useSidebarStore((s) => s.toggle);
  const { data: tools = [] } = useTools();
  const { status: wsStatus } = useWS({ url: WS_URL, onMessage: () => {} });

  const total = tools.length;
  const online = tools.filter((t) => t.status === 'available').length;
  const anyLive = online > 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 border-b border-border bg-surface flex items-center px-4 gap-3">
      {/* Hamburger */}
      <button
        onClick={toggle}
        className="flex items-center justify-center w-8 h-8 text-text-muted hover:text-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Logo / Identity */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs tracking-widest uppercase text-accent">Oblivion</span>
        <span className="w-px h-4 bg-border" />
        <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">Ops Center</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live status cluster */}
      <div className="flex items-center gap-4">
        {/* WebSocket */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              wsStatus === 'connected' ? 'bg-accent glow-accent' : 'bg-danger'
            }`}
          />
          <span className="font-mono text-[10px] tracking-widest text-text-muted">
            WS · {wsStatus.toUpperCase()}
          </span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Tool fleet */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest text-text-muted">TOOLS</span>
          <span
            className={`font-mono text-[10px] tracking-widest ${
              anyLive ? 'text-accent' : 'text-danger'
            }`}
          >
            {anyLive ? 'LIVE' : 'OFFLINE'}
          </span>
          <span className="font-mono text-[9px] text-text-dim">
            {online}/{total} ONLINE
          </span>
        </div>
      </div>
    </header>
  );
}
