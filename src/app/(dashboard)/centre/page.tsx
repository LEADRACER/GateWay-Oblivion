'use client';

// ── GateWay:Oblivion — Unified Red / Blue Operations Centre ──────

import { useState } from 'react';
import {
  useCentreOverview,
  useCentreTimeline,
  useCentreDetections,
  type Side,
  type CentreEvent,
  type CentreDetection,
} from '@/hooks/useCentre';
import {
  usePipelines,
  useRunPipeline,
  useApprovePipelineRun,
} from '@/hooks/useIntelligence';
import { Badge } from '@/components/ui/primitives';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  warning: 'text-warning',
  medium: 'text-text-dim',
  low: 'text-info',
  info: 'text-text-dim',
};

function time(timestamp: string) {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString();
}

export default function CentrePage() {
  const [side, setSide] = useState<Side>('all');
  const { data: overview } = useCentreOverview();
  const { data: events = [] } = useCentreTimeline(side);
  const { data: detections = [] } = useCentreDetections();
  const { data: pipelines = [] } = usePipelines();
  const runPipeline = useRunPipeline();
  const approveRun = useApprovePipelineRun();

  const red = overview?.red;
  const blue = overview?.blue;
  const shared = overview?.shared;
  const gatedIds = new Set(red?.gated_run_ids ?? []);

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <h1 className="font-mono text-lg tracking-[0.2em] text-text uppercase">
              Operations Centre
            </h1>
            <Badge variant="accent">RED ⇄ BLUE</Badge>
          </div>
          <p className="font-mono text-[10px] tracking-widest text-text-dim mt-1">
            Unified offensive &amp; defensive command surface ·{' '}
            {shared?.tools_online ?? 0}/{shared?.tools_total ?? 0} tools online ·{' '}
            {shared?.events_total ?? 0} normalized events
          </p>
        </div>
        <div className="flex items-center gap-1 border border-border p-1 bg-surface">
          {(['all', 'red', 'blue'] as Side[]).map((option) => (
            <button
              key={option}
              onClick={() => setSide(option)}
              className={`px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-all ${
                side === option
                  ? option === 'red'
                    ? 'bg-danger/20 text-danger'
                    : option === 'blue'
                      ? 'bg-info/20 text-info'
                      : 'bg-accent/20 text-accent'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Attack Surface" value={red?.attack_surface ?? '…'} color="var(--color-accent)" sub="discovered hosts" />
        <Kpi label="Critical Vulns" value={blue?.critical_vulns ?? '…'} color="var(--color-danger)" sub={`${blue?.high_vulns ?? 0} high`} />
        <Kpi label="Exploits Ready" value={red?.exploits_available ?? '…'} color="var(--color-danger)" sub="weaponized paths" />
        <Kpi label="Pipelines" value={red?.pipelines_total ?? '…'} color="var(--color-info)" sub={`${red?.gated_runs ?? 0} gated`} />
        <Kpi label="Detections" value={blue?.detections_total ?? '…'} color="var(--color-warning)" sub={`${blue?.critical_detections ?? 0} critical`} />
        <Kpi label="Posture" value={`${blue?.posture_score ?? '…'}`} color={Number(blue?.posture_score ?? 0) >= 70 ? 'var(--color-accent)' : 'var(--color-warning)'} sub="/ 100" />
      </div>

      {/* ── Main command grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.25fr_1fr] gap-4">
        {/* RED */}
        <Panel accent="var(--color-danger)" title="RED / OFFENSIVE" subtitle={`${red?.tools_ready?.length ?? 0} tools ready`}>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(red?.tools_ready ?? []).map((tool) => (
              <span key={tool} className="font-mono text-[8px] tracking-widest uppercase border border-border px-2 py-0.5 text-text-dim">
                {tool}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {pipelines.length === 0 && (
              <div className="p-3 border border-border font-mono text-[9px] text-text-dim">NO RUNBOOKS REGISTERED</div>
            )}
            {pipelines.map((pipeline) => {
              const hasGate = pipeline.steps.some((step) => step.gate);
              return (
                <div key={pipeline.id} className="p-3 border border-border bg-surface hover:border-danger/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-text truncate">{pipeline.name}</span>
                    <button
                      onClick={() => runPipeline.mutate(pipeline.id)}
                      disabled={runPipeline.isPending}
                      className="font-mono text-[8px] tracking-widest text-danger border border-danger/40 px-2 py-1 hover:bg-danger/10 disabled:opacity-40 shrink-0"
                    >
                      RUN
                    </button>
                  </div>
                  <div className="font-mono text-[8px] text-text-dim mt-1 tracking-wide">
                    {pipeline.steps.length} STEPS {hasGate ? '· ⚠ HUMAN GATE' : ''}
                  </div>
                </div>
              );
            })}
          </div>
          {red?.gated_runs ? (
            <div className="mt-3 p-2 border border-warning/40 bg-warning/10">
              <div className="font-mono text-[9px] text-warning tracking-wider">
                ⚠ {red.gated_runs} RUN(S) AWAITING APPROVAL
              </div>
              {Array.from(gatedIds).map((id) => (
                <button
                  key={id}
                  onClick={() => approveRun.mutate(id)}
                  className="mt-2 font-mono text-[8px] tracking-widest text-bg bg-warning px-2 py-1 hover:brightness-110"
                >
                  APPROVE {id.slice(0, 8).toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 font-mono text-[8px] text-text-dim tracking-wider">
            SCOPE: {overview?.scope?.enforced ? overview.scope.allowlist.join(', ') : 'ADVISORY / NO ALLOWLIST'}
          </div>
        </Panel>

        {/* TIMELINE */}
        <Panel accent="var(--color-accent)" title="LIVE EVENT STREAM" subtitle={`${events.length} events`}>
          <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
            {events.length === 0 && (
              <div className="p-3 border border-border font-mono text-[9px] text-text-dim">NO EVENTS FOR THIS VIEW</div>
            )}
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </Panel>

        {/* BLUE */}
        <Panel accent="var(--color-info)" title="BLUE / DEFENSIVE" subtitle={`${blue?.detections_total ?? 0} detections`}>
          {/* posture bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between font-mono text-[9px] tracking-widest text-text-dim uppercase">
              <span>Posture Score</span>
              <span className="text-text">{blue?.posture_score ?? '…'}/100</span>
            </div>
            <div className="h-1.5 bg-surface-3 mt-1.5 overflow-hidden">
              <div
                className="h-full bg-info transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, blue?.posture_score ?? 0))}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <MiniStat label="Ops Success" value={`${blue?.operations_success_rate ?? 0}%`} />
            <MiniStat label="Critical Alerts" value={String(blue?.critical_detections ?? 0)} />
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {detections.length === 0 && (
              <div className="p-3 border border-border font-mono text-[9px] text-text-dim">NO ACTIVE DETECTIONS</div>
            )}
            {detections.map((detection) => (
              <DetectionRow key={detection.id} detection={detection} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ── UI helpers ─────────────────────────────────────────────────── */

function Panel({
  accent,
  title,
  subtitle,
  children,
}: {
  accent: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-bg/60 p-4 relative" style={{ boxShadow: `inset 0 2px 0 ${accent}` }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: accent }}>
          {title}
        </h2>
        <span className="font-mono text-[8px] tracking-widest text-text-dim uppercase">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string | number; color: string; sub: string }) {
  return (
    <div className="border border-border bg-surface p-3 border-l-2" style={{ borderLeftColor: color }}>
      <div className="font-mono text-[8px] tracking-widest text-text-dim uppercase">{label}</div>
      <div className="font-mono text-2xl mt-1" style={{ color }}>{value}</div>
      <div className="font-mono text-[8px] text-text-dim mt-1">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 border border-border bg-surface">
      <div className="font-mono text-[8px] tracking-widest text-text-dim uppercase">{label}</div>
      <div className="font-mono text-sm text-text mt-0.5">{value}</div>
    </div>
  );
}

function EventRow({ event }: { event: CentreEvent }) {
  const sideColor = event.side === 'red' ? 'text-danger' : event.side === 'blue' ? 'text-info' : 'text-text-dim';
  const sideLabel = event.side === 'red' ? 'R' : event.side === 'blue' ? 'B' : '·';
  return (
    <div className="flex items-start gap-2 p-2 border border-border bg-surface hover:bg-surface-2 transition-colors">
      <span className={`font-mono text-[10px] font-bold ${sideColor} w-3 shrink-0`}>{sideLabel}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-text truncate">{event.title}</span>
          <span className={`font-mono text-[8px] shrink-0 ${SEVERITY_COLOR[event.severity ?? 'info'] || 'text-text-dim'}`}>
            {event.severity?.toUpperCase() ?? 'INFO'}
          </span>
        </div>
        <div className="font-mono text-[8px] text-text-dim mt-0.5 truncate">
          {event.source} · {event.event_type}
          {event.target_ref ? ` · ${event.target_ref}` : ''}
        </div>
      </div>
      <span className="font-mono text-[8px] text-text-dim/60 shrink-0">{time(event.timestamp)}</span>
    </div>
  );
}

function DetectionRow({ detection }: { detection: CentreDetection }) {
  return (
    <div className="p-2 border border-border bg-surface hover:bg-surface-2 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-text truncate">{detection.title}</span>
        <span className={`font-mono text-[8px] shrink-0 ${SEVERITY_COLOR[detection.severity] || 'text-text-dim'}`}>
          {detection.severity.toUpperCase()}
        </span>
      </div>
      <div className="font-mono text-[8px] text-text-dim mt-0.5">
        {detection.source} · {detection.detail} · {time(detection.timestamp)}
      </div>
    </div>
  );
}
