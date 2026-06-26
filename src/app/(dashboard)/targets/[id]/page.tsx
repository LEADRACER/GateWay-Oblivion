'use client';

// ── GateWay:Oblivion — Target Detail Page ──────────────────────────

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTarget, useUpdateTarget, useDeleteTarget, usePatchTarget } from '@/hooks/useTargets';
import { TargetForm } from '@/components/targets/TargetForm';
import { TargetStatusBadge } from '@/components/targets/TargetRow';
import { Badge } from '@/components/ui/primitives';
import type { Target } from '@/lib/types/database';

export default function TargetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: target, isLoading } = useTarget(id);
  const updateTarget = useUpdateTarget();
  const deleteTarget = useDeleteTarget();
  const patchTarget = usePatchTarget();

  const [editing, setEditing] = useState(false);

  const handleUpdate = async (data: Partial<Target>) => {
    try {
      await updateTarget.mutateAsync({ id, data });
      setEditing(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this target?')) return;
    await deleteTarget.mutateAsync(id);
    router.push('/targets');
  };

  const quickStatusChange = async (status: string) => {
    await patchTarget.mutateAsync({ id, updates: { status } as Partial<Target> });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
      </div>
    );
  }

  if (!target) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="font-mono text-xs text-text-dim">Target not found</span>
        <button onClick={() => router.push('/targets')} className="mt-4 font-mono text-[10px] text-accent">
          ← BACK TO TARGETS
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push('/targets')}
        className="font-mono text-[10px] text-text-muted hover:text-accent mb-4 flex items-center gap-1 transition-colors"
      >
        ← BACK TO TARGETS
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">{target.name}</h1>
            <TargetStatusBadge status={target.status} />
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            {target.ip_address || target.cidr_range || target.hostname || 'No address'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="font-mono text-[10px] tracking-widest text-text-muted hover:text-text px-3 py-2 border border-border transition-colors"
          >
            {editing ? 'CANCEL' : 'EDIT'}
          </button>
          <button
            onClick={handleDelete}
            className="font-mono text-[10px] tracking-widest text-danger border border-danger/30 px-3 py-2 hover:bg-danger/10 transition-colors"
          >
            DELETE
          </button>
        </div>
      </div>

      {editing ? (
        /* Edit mode */
        <div className="max-w-2xl border border-border bg-surface p-6">
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-4">Edit Target</h2>
          <TargetForm
            initial={target}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            loading={updateTarget.isPending}
          />
        </div>
      ) : (
        /* View mode */
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <div className="flex flex-col gap-6">
            {/* Info card */}
            <div className="border border-border bg-surface p-5">
              <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-4">Details</h2>
              <InfoRow label="IP Address" value={target.ip_address || '—'} />
              <InfoRow label="Hostname" value={target.hostname || '—'} />
              <InfoRow label="Domain" value={target.domain || '—'} />
              <InfoRow label="CIDR Range" value={target.cidr_range || '—'} />
              <InfoRow label="Created" value={target.created_at ? new Date(target.created_at).toLocaleString() : '—'} />
              <InfoRow label="Updated" value={target.updated_at ? new Date(target.updated_at).toLocaleString() : '—'} />
            </div>

            {/* Notes */}
            {target.notes && (
              <div className="border border-border bg-surface p-5">
                <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-4">Notes</h2>
                <p className="font-mono text-xs text-text whitespace-pre-wrap">{target.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Tags */}
            <div className="border border-border bg-surface p-4">
              <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {target.tags?.length ? target.tags.map((tag) => (
                  <Badge key={tag} variant="accent">{tag}</Badge>
                )) : (
                  <span className="font-mono text-[10px] text-text-dim">No tags</span>
                )}
              </div>
            </div>

            {/* Quick status change */}
            <div className="border border-border bg-surface p-4">
              <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Change Status</h2>
              <div className="flex flex-col gap-1">
                {['active', 'compromised', 'archived', 'pending'].map((s) => (
                  <button
                    key={s}
                    onClick={() => quickStatusChange(s)}
                    disabled={s === target.status}
                    className={`font-mono text-[10px] tracking-wider px-3 py-2 text-left transition-colors ${
                      s === target.status
                        ? 'bg-accent/10 text-accent border border-accent/30'
                        : 'text-text-muted hover:text-text border border-transparent hover:border-border'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                    {s === target.status && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info Row Helper ────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-border last:border-b-0">
      <span className="font-mono text-[10px] tracking-widest text-text-dim uppercase">{label}</span>
      <span className="font-mono text-xs text-text">{value}</span>
    </div>
  );
}
