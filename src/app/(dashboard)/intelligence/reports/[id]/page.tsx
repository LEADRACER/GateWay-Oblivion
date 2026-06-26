'use client';

// ── GateWay:Oblivion — Report Detail Page ────────────────────────

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useReport, useDeleteReport } from '@/hooks/useIntelligence';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: report, isLoading } = useReport(id);
  const deleteRpt = useDeleteReport();

  const handleDelete = () => {
    if (window.confirm(`Delete report "${report?.title}"?`)) {
      deleteRpt.mutate(id, { onSuccess: () => router.push('/intelligence/reports') });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-border border-t-accent animate-spin rounded-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="font-mono text-sm text-text-dim">Report not found</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">{report.title}</h1>
            <TypeBadge type={report.report_type} />
          </div>
          <div className="font-mono text-[10px] text-text-dim mt-1 flex items-center gap-3">
            {report.scope && <span>Scope: {report.scope}</span>}
            <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
            {report.risk_score && (
              <span>Risk Score: {report.risk_score}/10</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/intelligence/reports')}
            className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2"
          >
            ← BACK
          </button>
          <Link
            href="/intelligence/reports/generate"
            className="font-mono text-[10px] tracking-widest text-accent border border-accent/30 px-4 py-2 hover:bg-accent/10"
          >
            NEW
          </Link>
          <button
            onClick={handleDelete}
            className="font-mono text-[10px] tracking-widest text-danger border border-danger/30 px-4 py-2 hover:bg-danger/10"
          >
            DELETE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Left: Content */}
        <div className="flex flex-col gap-4">
          {/* Summary */}
          {report.summary && (
            <div className="border border-border bg-surface p-4">
              <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">Summary</h2>
              <p className="font-mono text-[10px] text-text leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* Content sections */}
          {Object.entries(report.content ?? {}).map(([section, value]) => (
            <ContentSection key={section} section={section} value={value} />
          ))}
        </div>

        {/* Right: Meta */}
        <div className="flex flex-col gap-4">
          <div className="border border-border bg-surface p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">Report Info</h3>
            <div className="flex flex-col gap-2.5">
              <InfoRow label="Type" value={report.report_type} />
              <InfoRow label="Status" value={report.status} />
              {report.scope && <InfoRow label="Scope" value={report.scope} />}
              {report.risk_score && <InfoRow label="Risk Score" value={`${report.risk_score}/10`} />}
              <InfoRow label="Generated" value={new Date(report.generated_at).toLocaleDateString()} />
              <InfoRow label="Created" value={new Date(report.created_at).toLocaleDateString()} />
            </div>
          </div>

          {report.risk_score && (
            <div className="border border-border bg-surface p-4">
              <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">Risk Score</h3>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-2xl ${
                  report.risk_score >= 7 ? 'text-danger' :
                  report.risk_score >= 4 ? 'text-warning' :
                  'text-accent'
                }`}>
                  {report.risk_score}
                </span>
                <span className="font-mono text-sm text-text-dim">/ 10</span>
              </div>
              <div className="h-2 bg-border rounded overflow-hidden mt-2">
                <div
                  className={`h-full rounded ${
                    report.risk_score >= 7 ? 'bg-danger' :
                    report.risk_score >= 4 ? 'bg-warning' :
                    'bg-accent'
                  }`}
                  style={{ width: `${report.risk_score * 10}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function ContentSection({ section, value }: { section: string; value: unknown }) {
  const label = section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (Array.isArray(value)) {
    return (
      <div className="border border-border bg-surface p-4">
        <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">{label}</h3>
        <div className="flex flex-col gap-2">
          {value.map((item, i) => {
            if (typeof item === 'string') {
              return <div key={i} className="font-mono text-[10px] text-text">{item}</div>;
            }
            return (
              <div key={i} className="border border-border/50 p-2">
                {Object.entries(item).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-text-dim uppercase tracking-wider">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-text">{String(v)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return (
      <div className="border border-border bg-surface p-4">
        <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">{label}</h3>
        <div className="flex flex-col gap-2">
          {Object.entries(obj).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-wider text-text-dim uppercase">{k.replace(/_/g, ' ')}</span>
              <span className="font-mono text-xs text-text">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-surface p-4">
      <h3 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-2">{label}</h3>
      <p className="font-mono text-[10px] text-text leading-relaxed">{String(value)}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] tracking-wider text-text-dim uppercase">{label}</span>
      <span className="font-mono text-xs text-text text-right max-w-[160px] truncate">{value}</span>
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
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${colors[type] || 'text-text-dim border-border/50'}`}>
      {labels[type] || type.toUpperCase()}
    </span>
  );
}
