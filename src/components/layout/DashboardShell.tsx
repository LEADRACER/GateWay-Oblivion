'use client';

// ── GateWay:Oblivion — Dashboard Shell ─────────────────────────────

import { AuthGate } from '@/components/layout/AuthGate';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="p-6">
        {children}
      </div>
    </AuthGate>
  );
}
