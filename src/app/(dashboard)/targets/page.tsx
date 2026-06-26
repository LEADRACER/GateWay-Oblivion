'use client';

// ── GateWay:Oblivion — Targets List Page ───────────────────────────

import { useState, useMemo } from 'react';
import { useTargets, useTargetStats, usePatchTarget } from '@/hooks/useTargets';
import { TargetRow } from '@/components/targets/TargetRow';
import { CampaignManager } from '@/components/targets/CampaignManager';
import { StatCard } from '@/components/ui/primitives';
import { BulkImport } from '@/components/targets/BulkImport';
import Link from 'next/link';

export default function TargetsPage() {
  const { data: targets, isLoading } = useTargets();
  const { data: stats } = useTargetStats();
  const patchTarget = usePatchTarget();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  // Compute unique tags from all targets
  const allTags = useMemo(() => {
    if (!targets) return [];
    const tagSet = new Set<string>();
    targets.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [targets]);

  // Filter targets
  const filtered = useMemo(() => {
    if (!targets) return [];
    return targets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (tagFilter && !t.tags?.includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.ip_address && t.ip_address.includes(q)) ||
          (t.hostname && t.hostname.toLowerCase().includes(q)) ||
          (t.domain && t.domain.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [targets, statusFilter, tagFilter, search]);

  const statuses = ['active', 'archived', 'compromised', 'pending'];

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Targets</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Managed assets, objectives, and reconnaissance targets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="font-mono text-[10px] tracking-widest text-text-muted hover:text-text px-3 py-2 border border-border transition-colors"
          >
            BULK IMPORT
          </button>
          <Link
            href="/targets/new"
            className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
          >
            + ADD TARGET
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total" value={stats?.total ?? '…'} />
        <StatCard label="Active" value={stats?.active ?? '…'} accent="accent" />
        <StatCard label="Compromised" value={stats?.compromised ?? '…'} accent="danger" />
        <StatCard label="Archived" value={stats?.archived ?? '…'} accent="default" />
        <StatCard label="Pending" value={stats?.pending ?? '…'} accent="warning" />
      </div>

      {/* Bulk import panel */}
      {showBulk && (
        <div className="mb-6 border border-border bg-surface p-4">
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-4">Bulk Import</h2>
          <BulkImport
            onComplete={() => setShowBulk(false)}
            onCancel={() => setShowBulk(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
              placeholder="Search by name, IP, hostname, domain…"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent transition-colors"
            >
              <option value="">All Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            {tagFilter && (
              <button
                onClick={() => setTagFilter('')}
                className="font-mono text-[10px] text-accent hover:text-accent/80"
              >
                ✕ Clear tag
              </button>
            )}
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_auto] gap-4 px-4 py-2 border-b border-border">
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Name</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Status</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Tags</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Hostname</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Created</span>
            <span />
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
              <span className="font-mono text-xs text-text-dim">
                {search || statusFilter || tagFilter ? 'No targets match your filters' : 'No targets yet'}
              </span>
              {!search && !statusFilter && !tagFilter && (
                <Link
                  href="/targets/new"
                  className="mt-4 font-mono text-[10px] tracking-widest text-accent hover:text-accent/80"
                >
                  + ADD YOUR FIRST TARGET
                </Link>
              )}
            </div>
          )}

          {/* Target rows */}
          {!isLoading && filtered.length > 0 && (
            <div>
              {filtered.map((target) => (
                <TargetRow key={target.id} target={target} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Campaigns */}
        <div>
          <div className="border border-border bg-surface p-4 sticky top-20">
            <CampaignManager />
          </div>
        </div>
      </div>
    </div>
  );
}
