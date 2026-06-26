'use client';

// ── GateWay:Oblivion — Target Form ─────────────────────────────────

import { useState } from 'react';
import type { Target } from '@/lib/types/database';

interface TargetFormProps {
  initial?: Partial<Target>;
  onSubmit: (data: Partial<Target>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function TargetForm({ initial, onSubmit, onCancel, loading }: TargetFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [ip_address, setIpAddress] = useState(initial?.ip_address || '');
  const [hostname, setHostname] = useState(initial?.hostname || '');
  const [domain, setDomain] = useState(initial?.domain || '');
  const [cidr_range, setCidrRange] = useState(initial?.cidr_range || '');
  const [status, setStatus] = useState(initial?.status || 'active');
  const [tagsStr, setTagsStr] = useState(initial?.tags?.join(', ') || '');
  const [notes, setNotes] = useState(initial?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      ip_address: ip_address || undefined,
      hostname: hostname || undefined,
      domain: domain || undefined,
      cidr_range: cidr_range || undefined,
      status,
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Target Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            placeholder="Web Server, DB Cluster, etc."
            required
          />
        </div>

        {/* IP Address */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">IP Address</label>
          <input
            value={ip_address}
            onChange={(e) => setIpAddress(e.target.value)}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            placeholder="10.0.1.10"
          />
        </div>

        {/* Hostname */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Hostname</label>
          <input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            placeholder="web-01.internal"
          />
        </div>

        {/* Domain */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Domain</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            placeholder="example.com"
          />
        </div>

        {/* CIDR Range */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">CIDR Range</label>
          <input
            value={cidr_range}
            onChange={(e) => setCidrRange(e.target.value)}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            placeholder="10.0.0.0/24"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'archived' | 'compromised' | 'pending')}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent transition-colors"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="compromised">Compromised</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Tags (comma-separated)</label>
          <input
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            placeholder="web, production, critical"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors resize-y"
            placeholder="Additional context..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[10px] tracking-widest text-text-muted hover:text-text px-4 py-2 border border-border transition-colors"
        >
          CANCEL
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-6 py-2 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {loading ? 'SAVING...' : initial ? 'UPDATE TARGET' : 'ADD TARGET'}
        </button>
      </div>
    </form>
  );
}
