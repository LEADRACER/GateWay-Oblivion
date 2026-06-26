'use client';

// ── GateWay:Oblivion — Target Status Badge ─────────────────────────

import { Badge } from '@/components/ui/primitives';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  active: 'success',
  compromised: 'danger',
  archived: 'default',
  pending: 'warning',
};

export function TargetStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant[status] || 'default'}>{status}</Badge>;
}

// ── Target Row (for DataTable) ─────────────────────────────────────

import type { Target } from '@/lib/types/database';
import Link from 'next/link';

export function TargetRow({ target }: { target: Target }) {
  return (
    <Link
      href={`/targets/${target.id}`}
      className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_auto] gap-4 px-4 py-3 items-center border-b border-border hover:bg-surface-2 transition-colors"
    >
      <div>
        <div className="font-mono text-xs text-text">{target.name}</div>
        <div className="font-mono text-[10px] text-text-dim mt-0.5">{target.ip_address || target.hostname || target.cidr_range || '—'}</div>
      </div>

      <div>
        <TargetStatusBadge status={target.status} />
      </div>

      <div className="font-mono text-[10px] text-text-muted">
        {target.tags?.length ? target.tags.slice(0, 3).join(', ') : '—'}
      </div>

      <div className="font-mono text-[10px] text-text-muted">
        {target.hostname || '—'}
      </div>

      <div className="font-mono text-[10px] text-text-muted">
        {target.created_at ? new Date(target.created_at).toLocaleDateString() : '—'}
      </div>

      <div className="font-mono text-[10px] text-text-dim cursor-default hover:text-accent">
        →
      </div>
    </Link>
  );
}
