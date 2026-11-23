'use client';

// ── GateWay:Oblivion — Unified Red / Blue Operations Centre ──────
// Modular, interactive, responsive command surface.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCentreOverview,
  useCentreTimeline,
  useCentreDetections,
  useCentreMetrics,
  useCentreAssets,
  useAuditStatus,
  useCentreLive,
  type Side,
} from '@/hooks/useCentre';
import { Panel } from '@/components/centre/Panel';
import { KpiStrip } from '@/components/centre/KpiStrip';
import { ActivityCharts } from '@/components/centre/ActivityCharts';
import { PipelineBoard } from '@/components/centre/PipelineBoard';
import { EventTimeline } from '@/components/centre/EventTimeline';
import { DetectionFeed } from '@/components/centre/DetectionFeed';
import { AssetMap } from '@/components/centre/AssetMap';
import { PosturePanel } from '@/components/centre/PosturePanel';
import { Badge } from '@/components/ui/primitives';

export default function CentrePage() {
  const [side, setSide] = useState<Side>('all');
  const [windowHours, setWindowHours] = useState(24);
  const queryClient = useQueryClient();

  const { data: overview } = useCentreOverview();
  const { data: events = [] } = useCentreTimeline(side);
  const { data: detections = [] } = useCentreDetections();
  const { data: metrics } = useCentreMetrics(windowHours);
  const { data: assets } = useCentreAssets();
  const { data: audit } = useAuditStatus();
  const wsStatus = useCentreLive();

  const red = overview?.red;
  const blue = overview?.blue;
  const shared = overview?.shared;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['centre'] });

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <h1 className="font-mono text-lg tracking-[0.2em] text-text uppercase">Operations Centre</h1>
            <Badge variant="accent">RED ⇄ BLUE</Badge>
            <Badge variant={audit?.valid ? 'success' : 'danger'}>
              AUDIT {audit?.valid ? 'VERIFIED' : 'INVALID'} · {audit?.entries ?? 0}
            </Badge>
            <Badge variant={wsStatus === 'connected' ? 'success' : 'warning'}>
              WS {wsStatus.toUpperCase()}
            </Badge>
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            {shared?.tools_online ?? 0}/{shared?.tools_total ?? 0} tools online ·{' '}
            {shared?.events_total ?? 0} normalized events ·{' '}
            {overview?.red?.pipelines_total ?? 0} runbooks
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border border-border p-1 bg-surface">
            {(['all', 'red', 'blue'] as Side[]).map((option) => (
              <button
                key={option}
                onClick={() => setSide(option)}
                className={`px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-all ${
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
          <div className="flex items-center gap-1 border border-border p-1 bg-surface">
            {[6, 24, 72].map((hours) => (
              <button
                key={hours}
                onClick={() => setWindowHours(hours)}
                className={`px-2 py-1.5 font-mono text-[9px] tracking-widest ${
                  windowHours === hours ? 'text-accent' : 'text-text-dim hover:text-text'
                }`}
              >
                {hours}H
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            className="font-mono text-[9px] tracking-widest border border-border px-3 py-2 text-text-muted hover:text-accent hover:border-accent transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <KpiStrip
        kpis={[
          { label: 'Attack Surface', value: red?.attack_surface ?? '…', color: '#5ee28a', sub: 'discovered hosts' },
          { label: 'Critical Vulns', value: blue?.critical_vulns ?? '…', color: '#f87171', sub: `${blue?.high_vulns ?? 0} high` },
          { label: 'Exploits Ready', value: red?.exploits_available ?? '…', color: '#f87171', sub: 'weaponized paths' },
          { label: 'Pipelines', value: red?.pipelines_total ?? '…', color: '#60a5fa', sub: `${red?.gated_runs ?? 0} gated` },
          { label: 'Detections', value: blue?.detections_total ?? '…', color: '#fbbf24', sub: `${blue?.critical_detections ?? 0} critical` },
          { label: 'Posture', value: blue?.posture_score ?? '…', color: (blue?.posture_score ?? 0) >= 70 ? '#5ee28a' : '#fbbf24', sub: '/ 100' },
        ]}
      />

      {/* ── Charts ────────────────────────────────────────────── */}
      <ActivityCharts metrics={metrics} />

      {/* ── Command grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          title="RED / OFFENSIVE"
          subtitle={`${red?.tools_ready?.length ?? 0} tools ready`}
          accent="var(--color-danger)"
          className="xl:col-span-3"
        >
          <PipelineBoard gatedRunIds={red?.gated_run_ids ?? []} />
        </Panel>

        <Panel
          title="LIVE EVENT STREAM"
          subtitle={`${events.length} events · ${side}`}
          className="xl:col-span-6"
        >
          <EventTimeline events={events} />
        </Panel>

        <Panel
          title="BLUE / DEFENSIVE"
          subtitle={`${blue?.detections_total ?? 0} detections`}
          accent="var(--color-info)"
          className="xl:col-span-3"
        >
          <PosturePanel blue={blue} scope={overview?.scope} toolsReady={red?.tools_ready ?? []} />
        </Panel>
      </div>

      {/* ── Assets & detections ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          title="ATTACK SURFACE MAP"
          subtitle={`${assets?.total ?? 0} hosts`}
          className="xl:col-span-7"
        >
          <AssetMap assets={assets} />
        </Panel>
        <Panel
          title="DETECTION FEED"
          subtitle="merged defensive telemetry"
          accent="var(--color-warning)"
          className="xl:col-span-5"
        >
          <DetectionFeed detections={detections} />
        </Panel>
      </div>
    </div>
  );
}
