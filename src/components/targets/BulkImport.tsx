'use client';

// ── GateWay:Oblivion — Bulk Import UI ──────────────────────────────

import { useState } from 'react';
import { useBulkImport } from '@/hooks/useTargets';

interface BulkImportProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function BulkImport({ onComplete, onCancel }: BulkImportProps) {
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<'csv' | 'paste'>('paste');
  const [campaignId, setCampaignId] = useState('');
  const bulkImport = useBulkImport();

  const handleImport = async () => {
    if (!raw.trim()) return;

    const lines = raw.trim().split('\n').filter(Boolean);
    const targets = lines.map((line) => {
      // Format: name, ip, hostname, domain, tags
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0] || 'Unnamed',
        ip_address: parts[1] || undefined,
        hostname: parts[2] || undefined,
        domain: parts[3] || undefined,
        tags: parts[4] ? parts[4].split(' ').filter(Boolean) : [],
      };
    });

    try {
      const result = await bulkImport.mutateAsync({
        targets,
        campaign_id: campaignId || undefined,
      });
      onComplete();
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[10px] text-text-muted leading-relaxed">
        Paste targets below. Each line: <span className="text-text">name, ip_address, hostname, domain, tags</span>
        <br />
        Tags are space-separated.
      </p>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors resize-y"
        placeholder={`Web Server, 10.0.1.10, web-01, example.com, web production\nDB Cluster, 10.0.1.20, db-primary, example.com, database production\nStaging Range, , , , staging`}
      />

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Campaign ID (optional)</label>
        <input
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
          placeholder="campaign-uuid"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          onClick={onCancel}
          className="font-mono text-[10px] tracking-widest text-text-muted hover:text-text px-4 py-2 border border-border transition-colors"
        >
          CANCEL
        </button>
        <button
          onClick={handleImport}
          disabled={!raw.trim() || bulkImport.isPending}
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-6 py-2 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {bulkImport.isPending ? 'IMPORTING...' : `IMPORT ${raw.trim().split('\n').filter(Boolean).length} TARGETS`}
        </button>
      </div>

      {bulkImport.data && (
        <div className="border border-accent/30 bg-accent-bg p-3">
          <div className="font-mono text-[10px] text-accent">
            Imported {bulkImport.data.imported} target(s)
            {bulkImport.data.skipped > 0 && `, ${bulkImport.data.skipped} skipped`}
          </div>
          {bulkImport.data.errors.length > 0 && (
            <div className="mt-2 font-mono text-[10px] text-danger">
              {bulkImport.data.errors.map((e, i) => (<div key={i}>{e}</div>))}
            </div>
          )}
        </div>
      )}

      {bulkImport.isError && (
        <div className="border border-danger/30 bg-danger/10 p-3">
          <div className="font-mono text-[10px] text-danger">Import failed. Check your data format.</div>
        </div>
      )}
    </div>
  );
}
