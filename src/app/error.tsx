'use client';

// ── GateWay:Oblivion — Global Route Error Boundary ───────────────────

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[oblivion] render error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-8">
      <div className="w-full max-w-md border border-danger/40 bg-surface p-6 text-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <h2 className="font-mono text-sm text-text tracking-widest uppercase mt-3">Signal Lost</h2>
        <p className="font-mono text-[10px] text-text-dim mt-2 leading-relaxed">
          The console hit an unrecoverable error.
          {error.digest ? ` Digest: ${error.digest}` : ''}
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={reset}
            className="font-mono text-[9px] tracking-widest text-bg bg-accent px-4 py-2 hover:opacity-90 transition-opacity"
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
