'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  useEngagementFindings, useEngagementActions,
  type Engagement,
} from '@/hooks/useEngagements';
import { severityColor, formatTime } from './shared';

const STATUSES = ['new', 'triaged', 'confirmed', 'remediated', 'accepted-risk', 'closed'];

export function FindingsTab({ engagement }: { engagement: Engagement }) {
  const { data: findings = [] } = useEngagementFindings(engagement.id);
  const actions = useEngagementActions();
  const chartData = ['critical', 'high', 'medium', 'low', 'info'].map((severity) => ({
    severity,
    count: findings.filter((finding) => finding.severity === severity).length,
  }));

  return (
    <div className="space-y-4">
      <div className="h-40 border border-border bg-surface p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="#1e2024" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="severity" stroke="#4a4d54" tick={{ fontSize: 9 }} />
            <YAxis stroke="#4a4d54" tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#0d0e10', border: '1px solid #1e2024', fontSize: 10 }} />
            <Bar dataKey="count" fill="#f87171" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {findings.length === 0 && (
          <div className="p-3 border border-border font-mono text-[9px] text-text-dim">NO FINDINGS RECORDED</div>
        )}
        {findings.map((finding) => (
          <div key={finding.id} className="p-3 border border-border bg-surface">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-text truncate">{finding.title}</span>
              <span className="font-mono text-[9px] uppercase" style={{ color: severityColor(finding.severity) }}>
                {finding.severity}
              </span>
            </div>
            <div className="font-mono text-[8px] text-text-dim mt-1">
              {finding.source_tool} · {finding.cve_id || 'no CVE'} · {formatTime(finding.discovered_at)}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => actions.patch.mutate({
                    path: `/api/engagements/${engagement.id}/findings/${finding.id}`,
                    body: { status },
                    engagementId: engagement.id,
                  })}
                  className={`font-mono text-[7px] tracking-wide border px-1.5 py-0.5 ${
                    finding.status === status ? 'border-accent text-accent' : 'border-border text-text-dim'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
