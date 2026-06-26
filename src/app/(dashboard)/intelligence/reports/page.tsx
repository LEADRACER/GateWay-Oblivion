'use client';

// ── GateWay:Oblivion — Reports List Page ─────────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { useReports, useDeleteReport } from '@/hooks/useIntelligence';

const REPORT_TYPES = [
  { value: '', label: 'All Reports' },
  { value: 'executive', label: 'Executive' },
  { value: 'technical', label: 'Technical' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'recon', label: 'Recon' },
  { value: 'operations', label: 'Operations' },
];

export default function ReportsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const { data: reports = [], isLoading } = useReports(typeFilter || undefined);
  const deleteReport = useDeleteReport();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Reports</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Generated security reports and assessments
          </p>
        </div>
        <Link
          href="/intelligence/reports/generate"
          className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all"
        >
          + GENERATE REPORT
        </Link>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.value}
            onClick={() => setTypeFilter(rt.value)}
            className={`font-mono text-[10px] tracking-wider px-3 py-1.5 border transition-colors ${
              typeFilter === rt.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-dim hover:text-text'
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="grid grid-cols-[3fr_1fr_1fr_1.5fr_1fr] gap-3 px-3 py-2 border-b border-border font-mono text-[9px] tracking-widest text-text-dim uppercase">
        <span>Title</span>
        <span>Type</span>
        <span>Risk Score</span>
        <span>Generated</span>
        <span>Actions</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <span className="font-mono text-xs text-text-dim">No reports generated yet</span>
          <Link
            href="/intelligence/reports/generate"
            className="font-mono text-[10px] text-accent hover:underline mt-2"
          >
            Generate your first report →
          </Link>
        </div>
      )}

      {reports.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[3fr_1fr_1fr_1.5fr_1fr] gap-3 px-3 py-2.5 border-b border-border hover:bg-surface-2 transition-colors items-center"
        >
          <div className="min-w-0">
            <Link
              href={`/intelligence/reports/${r.id}`}
              className="font-mono text-xs text-accent hover:underline truncate block"
            >
              {r.title}
            </Link>
          </div>
          <TypeBadge type={r.report_type} />
          <span className="font-mono text-[10px] text-text-dim">
            {r.risk_score ? `${r.risk_score}/10` : '—'}
          </span>
          <span className="font-mono text-[10px] text-text-dim">
            {new Date(r.generated_at).toLocaleDateString()}
          </span>
          <div className="flex gap-1">
            <Link
              href={`/intelligence/reports/${r.id}`}
              className="font-mono text-[9px] tracking-wider text-text border border-border px-1.5 py-0.5 hover:bg-surface-2"
            >
              View
            </Link>
            <button
              onClick={() => {
                if (window.confirm(`Delete report "${r.title}"?`))
                  deleteReport.mutate(r.id);
              }}
              className="font-mono text-[9px] tracking-wider text-danger border border-danger/30 px-1.5 py-0.5 hover:bg-danger/10"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    executive: 'EXECUTIVE',
    technical: 'TECHNICAL',
    compliance: 'COMPLIANCE',
    recon: 'RECON',
    operations: 'OPS',
  };
  const colors: Record<string, string> = {
    executive: 'text-accent border-accent/30',
    technical: 'text-info border-info/30',
    compliance: 'text-warning border-warning/30',
    recon: 'text-text-dim border-border/50',
    operations: 'text-text border-border',
  };
  return (
    <span className={`font-mono text-[8px] tracking-widest border px-1 py-0.5 ${colors[type] || 'text-text-dim border-border/50'}`}>
      {labels[type] || type.toUpperCase()}
    </span>
  );
}
