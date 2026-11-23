'use client';

import { useState } from 'react';
// ── GateWay:Oblivion — Engagement Management Console ────────────

import {
  useEngagements, useEngagement, useEngagementMetrics,
} from '@/hooks/useEngagements';
import { EngagementList } from '@/components/engagements/EngagementList';
import { EngagementHeader } from '@/components/engagements/EngagementHeader';
import { OverviewTab } from '@/components/engagements/OverviewTab';
import { ScopeTab } from '@/components/engagements/ScopeTab';
import { TasksTab } from '@/components/engagements/TasksTab';
import { FindingsTab } from '@/components/engagements/FindingsTab';
import { TimelineTab } from '@/components/engagements/TimelineTab';
import { EvidenceTab } from '@/components/engagements/EvidenceTab';
import { PipelinesTab } from '@/components/engagements/PipelinesTab';
import { ReportsTab } from '@/components/engagements/ReportsTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'scope', label: 'Scope & RoE' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'findings', label: 'Findings' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'pipelines', label: 'Pipelines' },
  { key: 'reports', label: 'Reports' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function EngagementsPage() {
  const { data: engagements = [] } = useEngagements();
  const [selection, setSelection] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const selected = selection ?? engagements[0]?.id ?? null;

  const { data: engagement } = useEngagement(selected);
  const { data: metrics } = useEngagementMetrics(selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div>
          <h1 className="font-mono text-lg text-text tracking-[0.2em] uppercase">Engagement Console</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Authorized assessments — scope, tasks, findings, evidence and audit in one place
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 border border-border bg-surface p-3 min-w-0">
          <EngagementList selected={selected} onSelect={setSelection} />
        </div>

        <div className="lg:col-span-9 min-w-0 space-y-4">
          {!engagement ? (
            <div className="p-8 border border-border bg-surface text-center font-mono text-[10px] text-text-dim">
              SELECT OR CREATE AN ENGAGEMENT
            </div>
          ) : (
            <>
              <EngagementHeader engagement={engagement} metrics={metrics} />

              <div className="flex flex-wrap gap-1 border-b border-border pb-1">
                {TABS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors ${
                      tab === item.key
                        ? 'text-accent border-b border-accent'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="p-4 border border-border bg-bg/60 min-w-0">
                {tab === 'overview' && <OverviewTab engagement={engagement} />}
                {tab === 'scope' && <ScopeTab engagement={engagement} />}
                {tab === 'tasks' && <TasksTab engagement={engagement} />}
                {tab === 'findings' && <FindingsTab engagement={engagement} />}
                {tab === 'timeline' && <TimelineTab engagement={engagement} />}
                {tab === 'evidence' && <EvidenceTab engagement={engagement} />}
                {tab === 'pipelines' && <PipelinesTab engagement={engagement} />}
                {tab === 'reports' && <ReportsTab engagement={engagement} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
