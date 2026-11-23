'use client';

// ── GateWay:Oblivion — Global Error Boundary (root) ──────────────────

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[oblivion] global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-bg text-text antialiased">
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-md border border-danger/40 bg-surface p-6 text-center">
            <h2 className="font-mono text-sm text-text tracking-widest uppercase">Signal Lost</h2>
            <p className="font-mono text-[10px] text-text-dim mt-2">The console hit an unrecoverable error.</p>
            <button
              onClick={reset}
              className="mt-4 font-mono text-[9px] tracking-widest text-bg bg-accent px-4 py-2"
            >
              RETRY
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
