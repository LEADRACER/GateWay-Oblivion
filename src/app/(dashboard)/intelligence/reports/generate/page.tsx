'use client';

// ── GateWay:Oblivion — Report Generator Page ──────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGenerateReport, useReportDefinitions } from '@/hooks/useIntelligence';

export default function GenerateReportPage() {
  const router = useRouter();
  const { data: definitions } = useReportDefinitions();
  const generate = useGenerateReport();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('executive');
  const [scope, setScope] = useState('');

  const defEntries = Object.entries(definitions ?? {});

  const handleGenerate = () => {
    generate.mutate(
      {
        title: title || `${definitions?.[type]?.label ?? 'Report'} — ${new Date().toLocaleDateString()}`,
        report_type: type,
        scope: scope || undefined,
      },
      {
        onSuccess: (report) => {
          router.push(`/intelligence/reports/${report.id}`);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-mono text-lg text-text tracking-tight">Generate Report</h1>
      </div>

      <div className="border border-border bg-surface p-6">
        <div className="flex flex-col gap-5">
          {/* Report Type */}
          <div>
            <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-2 block">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {defEntries.map(([key, def]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`p-4 border text-left transition-colors ${
                    type === key
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-text-dim'
                  }`}
                >
                  <div className={`font-mono text-xs ${type === key ? 'text-accent' : 'text-text'}`}>
                    {def.label}
                  </div>
                  <div className="font-mono text-[9px] text-text-dim mt-1.5 leading-relaxed">
                    {def.description}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {def.sections.map((s) => (
                      <span key={s} className="font-mono text-[7px] tracking-wider text-text-dim border border-border/50 px-1 py-0.5">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">
              Report Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              placeholder="Auto-generated if empty"
            />
          </div>

          {/* Scope */}
          <div>
            <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">
              Scope (optional)
            </label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              placeholder="e.g., 10.0.0.0/16 infrastructure"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2 transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {generate.isPending ? 'GENERATING…' : 'GENERATE REPORT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
