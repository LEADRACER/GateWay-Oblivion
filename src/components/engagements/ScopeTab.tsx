'use client';

import { useState } from 'react';
import {
  useEngagementScope, useEngagementRoe, useEngagementActions,
  type Engagement,
} from '@/hooks/useEngagements';

function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

type FieldKey = 'include' | 'exclude' | 'tools' | 'actions' | 'forbidden';

export function ScopeTab({ engagement }: { engagement: Engagement }) {
  const { data: scope } = useEngagementScope(engagement.id);
  const { data: roe } = useEngagementRoe(engagement.id);
  const actions = useEngagementActions();
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});

  const value = (key: FieldKey, fallback: string[]): string => draft[key] ?? fallback.join('\n');
  const change = (key: FieldKey, next: string) => setDraft((prev) => ({ ...prev, [key]: next }));

  const save = () => actions.put.mutate({
    path: `/api/engagements/${engagement.id}/scope`,
    engagementId: engagement.id,
    body: {
      include: lines(value('include', scope?.include ?? [])),
      exclude: lines(value('exclude', scope?.exclude ?? [])),
      allowed_tools: lines(value('tools', scope?.allowed_tools ?? [])),
      allowed_actions: lines(value('actions', scope?.allowed_actions ?? [])),
      forbidden_actions: lines(value('forbidden', scope?.forbidden_actions ?? [])),
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Include (CIDR / domain / host)" value={value('include', scope?.include ?? [])} onChange={(v) => change('include', v)} />
        <Field label="Exclude" value={value('exclude', scope?.exclude ?? [])} onChange={(v) => change('exclude', v)} />
        <Field label="Allowed tools" value={value('tools', scope?.allowed_tools ?? [])} onChange={(v) => change('tools', v)} />
        <Field label="Allowed actions" value={value('actions', scope?.allowed_actions ?? [])} onChange={(v) => change('actions', v)} />
        <Field label="Forbidden actions" value={value('forbidden', scope?.forbidden_actions ?? [])} onChange={(v) => change('forbidden', v)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={actions.put.isPending}
          className="font-mono text-[9px] tracking-widest text-bg bg-accent px-3 py-2 disabled:opacity-40"
        >
          SAVE SCOPE
        </button>
        <button
          onClick={() => actions.post.mutate({
            path: `/api/engagements/${engagement.id}/roe/sign`,
            engagementId: engagement.id,
          })}
          disabled={actions.post.isPending || !!roe?.signed}
          className="font-mono text-[9px] tracking-widest text-info border border-info/40 px-3 py-2 disabled:opacity-40"
        >
          {roe?.signed ? 'ROE SIGNED' : 'SIGN ROE'}
        </button>
        <button
          onClick={() => actions.post.mutate({
            path: `/api/engagements/${engagement.id}/transition`,
            body: { to: 'authorized' },
            engagementId: engagement.id,
          })}
          disabled={actions.post.isPending || !roe?.signed || engagement.state !== 'draft'}
          className="font-mono text-[9px] tracking-widest text-warning border border-warning/40 px-3 py-2 disabled:opacity-40"
        >
          AUTHORIZE
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full mt-1 bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text outline-none focus:border-accent resize-y"
      />
    </label>
  );
}
