'use client';

// ── GateWay:Oblivion — Obsidian Vault Page ───────────────────────

import { useState } from 'react';
import {
  useObsidianStatus,
  useObsidianNotes,
  useObsidianNote,
  useObsidianCanvases,
  useGenerateObsidianCanvas,
  useExportObsidianReport,
} from '@/hooks/useObsidian';
import { useReports } from '@/hooks/useIntelligence';
import { StatCard, Badge } from '@/components/ui/primitives';

export default function ObsidianPage() {
  const { data: status } = useObsidianStatus();
  const { data: notes = [] } = useObsidianNotes();
  const { data: canvases = [] } = useObsidianCanvases();
  const { data: reports = [] } = useReports();

  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const { data: noteDetail } = useObsidianNote(selectedNote);

  const generateCanvas = useGenerateObsidianCanvas();
  const exportReport = useExportObsidianReport();

  const vaultLive = status?.exists && status?.writable;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Obsidian</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Vault notes &amp; JSON Canvas — server-side knowledge management
          </p>
        </div>
        <Badge variant={vaultLive ? 'success' : 'danger'}>
          {vaultLive ? 'VAULT ONLINE' : 'VAULT OFFLINE'}
        </Badge>
      </div>

      {/* ── Stat cards ────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Vault" value={vaultLive ? 'READY' : 'DOWN'} accent={vaultLive ? 'accent' : 'danger'} />
        <StatCard label="Notes" value={status?.note_count ?? notes.length} accent="info" />
        <StatCard label="Canvases" value={status?.canvas_count ?? canvases.length} accent="accent" />
        <StatCard label="REST API" value={status?.rest_api_configured ? 'CONFIGURED' : 'FILE MODE'} accent="warning" />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* ── Notes ───────────────────────────── */}
        <div>
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
            Vault Notes
          </h2>
          <div className="flex flex-col gap-2">
            {notes.length === 0 && (
              <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
                NO NOTES IN VAULT
              </div>
            )}
            {notes.map((path) => (
              <button
                key={path}
                onClick={() => setSelectedNote(path)}
                className={`text-left p-3 border transition-colors ${
                  selectedNote === path
                    ? 'border-accent/50 bg-accent-bg'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="font-mono text-[10px] text-text truncate">{path}</div>
              </button>
            ))}
          </div>
          {selectedNote && (
            <div className="mt-3 p-3 border border-border bg-surface max-h-80 overflow-y-auto">
              <pre className="font-mono text-[9px] text-text-dim whitespace-pre-wrap leading-relaxed">
                {noteDetail?.content ?? 'Loading…'}
              </pre>
            </div>
          )}
        </div>

        {/* ── Canvases ────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
              JSON Canvases
            </h2>
            <button
              onClick={() => generateCanvas.mutate()}
              disabled={generateCanvas.isPending}
              className="font-mono text-[9px] tracking-widest text-text-muted border border-border px-3 py-1.5 hover:text-accent hover:border-accent transition-all disabled:opacity-40"
            >
              {generateCanvas.isPending ? 'GENERATING…' : '+ GENERATE PIPELINE MAP'}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {canvases.length === 0 && (
              <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
                NO CANVASES — GENERATE A PIPELINE MAP
              </div>
            )}
            {canvases.map((path) => (
              <div key={path} className="p-3 border border-border bg-surface flex items-center justify-between">
                <span className="font-mono text-[10px] text-text truncate">{path}</span>
                <span className="font-mono text-[8px] text-text-dim tracking-widest uppercase">CANVAS</span>
              </div>
            ))}
          </div>

          {/* ── Report exports ─────────────────── */}
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mt-6 mb-3">
            Export Reports to Vault
          </h2>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {reports.length === 0 && (
              <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
                NO REPORTS TO EXPORT
              </div>
            )}
            {reports.map((r) => (
              <div key={r.id} className="p-3 border border-border bg-surface flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] text-text truncate">{r.title}</span>
                <button
                  onClick={() => exportReport.mutate(r.id)}
                  disabled={exportReport.isPending}
                  className="font-mono text-[9px] tracking-widest text-text-muted border border-border px-2 py-1 hover:text-accent hover:border-accent transition-all disabled:opacity-40 shrink-0"
                >
                  EXPORT
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
