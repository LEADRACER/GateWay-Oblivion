'use client';

// ── GateWay:Oblivion — Dashboard Error Boundary ──────────────────────

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[oblivion] dashboard error:', error);
  }, [error]);

  return (
    <div className="p-8">
      <div className="max-w-md mx-auto border border-danger/40 bg-surface p-6 text-center">
        <h2 className="font-mono text-sm text-text tracking-widest uppercase">Signal Lost</h2>
        <p className="font-mono text-[10px] text-text-dim mt-2">The console hit an unrecoverable error.</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={reset}
            className="font-mono text-[9px] tracking-widest text-bg bg-accent px-4 py-2"
          >
            RETRY
          </button>
          <button
            onClick={() => window.location.reload()}
            className="font-mono text-[9px] tracking-widest text-text border border-border px-4 py-2 hover:border-accent hover:text-accent transition-colors"
          >
            RELOAD
          </button>
        </div>
      </div>
    </div>
  );
}
