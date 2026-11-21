'use client';

// ── GateWay:Oblivion — Native NetVision Control Center ───────────

import { useState } from 'react';
import {
  useNetVisionMetrics,
  useNetVisionCapabilities,
  useNetVisionEvents,
  useNetVisionControl,
  type NetVisionCapabilities,
} from '@/hooks/useNetVision';
import { StatCard, Badge } from '@/components/ui/primitives';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const SUBSYSTEMS: Array<{
  label: string;
  key: keyof NetVisionCapabilities;
  ok: (value: unknown) => boolean;
}> = [
  { label: 'Health', key: 'health_ready', ok: (v) => asRecord(v).status === 'ready' },
  { label: 'Sonar Sensors', key: 'sonar_sensors', ok: (v) => Array.isArray(asRecord(v).sensors) },
  { label: 'Bettercap Bridge', key: 'bettercap_status', ok: (v) => asRecord(v).running === true && asRecord(v).api_up === true },
  { label: 'Packet Capture', key: 'capture_status', ok: (v) => Object.keys(asRecord(v)).length > 0 },
  { label: 'Scan Queue', key: 'scan_queue', ok: (v) => Object.keys(asRecord(v)).length > 0 },
  { label: 'Config', key: 'config', ok: (v) => !!asRecord(v).local_subnet },
];

export default function NetVisionPage() {
  const { data: metrics } = useNetVisionMetrics();
  const { data: capabilities } = useNetVisionCapabilities();
  const { data: events } = useNetVisionEvents();
  const control = useNetVisionControl();

  const [target, setTarget] = useState('');
  const [mode, setMode] = useState('sonar');

  const summary = metrics?.summary;
  const online = capabilities?.reachable ?? false;
  const bc = capabilities?.bettercap_status;

  const run = (action: string, params?: Record<string, unknown>) =>
    control.mutate({ action, params });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">NetVision Control</h1>
            <Badge variant={online ? 'success' : 'danger'}>{online ? 'ONLINE' : 'OFFLINE'}</Badge>
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Native sensor fabric — sonar discovery, bettercap bridge, capture and live metrics
          </p>
        </div>
        <span className="font-mono text-[9px] text-text-dim tracking-widest uppercase">
          {capabilities?.config?.local_subnet || 'SUBNET UNKNOWN'}
        </span>
      </div>

      {/* ── Metric cards ───────────────────────── */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard label="HTTP Requests" value={summary?.http_requests_total ?? '…'} accent="accent" />
        <StatCard label="Scans Running" value={summary?.scans_in_progress ?? '…'} accent="info" />
        <StatCard label="Devices Up" value={summary?.devices_up ?? '…'} accent="accent" />
        <StatCard label="Devices Down" value={summary?.devices_down ?? '…'} accent="danger" />
        <StatCard label="Bettercap" value={bc?.api_up ? 'LIVE' : 'IDLE'} accent={bc?.api_up ? 'accent' : 'warning'} />
        <StatCard label="Metric Families" value={summary?.metric_families ?? '…'} accent="info" />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* ── Control panel ─────────────────────── */}
        <div>
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
            Subsystem Status
          </h2>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {SUBSYSTEMS.map((s) => {
              const value = capabilities?.[s.key];
              const ok = s.ok(value);
              return (
                <div key={s.key} className="p-3 border border-border bg-surface flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text">{s.label}</span>
                  <span className={`font-mono text-[9px] tracking-widest ${ok ? 'text-accent' : 'text-danger'}`}>
                    {ok ? 'READY' : 'DOWN'}
                  </span>
                </div>
              );
            })}
          </div>

          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
            Sonar &amp; Bridge Controls
          </h2>
          <div className="flex flex-col gap-2 p-4 border border-border bg-surface">
            <div className="flex gap-2">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="target CIDR (blank = local subnet)"
                className="flex-1 bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text outline-none focus:border-accent"
              />
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="bg-bg border border-border px-2 py-1.5 font-mono text-[10px] text-text outline-none focus:border-accent"
              >
                <option value="passive">passive</option>
                <option value="active">active</option>
                <option value="sonar">sonar</option>
                <option value="full">full</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ControlButton label="RUN SONAR" onClick={() => run('sonar_scan', { target: target || undefined, mode, duration: 5 })} pending={control.isPending} />
              <ControlButton label="STOP SCAN" onClick={() => run('stop_scan')} pending={control.isPending} />
              <ControlButton label={bc?.api_up ? 'BETTERCAP STOP' : 'BETTERCAP START'} onClick={() => run(bc?.api_up ? 'bettercap_stop' : 'bettercap_start')} pending={control.isPending} />
              <ControlButton label="CAPTURE START" onClick={() => run('capture_start', { duration: 30 })} pending={control.isPending} />
              <ControlButton label="CAPTURE STOP" onClick={() => run('capture_stop')} pending={control.isPending} />
              <ControlButton label="CORRELATE VULNS" onClick={() => run('correlate_vulns')} pending={control.isPending} />
            </div>
            {control.isError && (
              <div className="font-mono text-[9px] text-danger">{(control.error as Error).message}</div>
            )}
          </div>
        </div>

        {/* ── Events & metrics detail ──────────── */}
        <div>
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
            Live NetVision Events
          </h2>
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {(events?.events ?? []).length === 0 && (
              <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
                NO NETVISION EVENTS YET
              </div>
            )}
            {(events?.events ?? []).map((evt) => (
              <div key={evt.id} className="p-2 border border-border bg-surface">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text">{evt.title || evt.event_type}</span>
                  <span className={`font-mono text-[8px] tracking-wider ${evt.severity === 'warning' ? 'text-warning' : evt.severity === 'high' ? 'text-danger' : 'text-text-dim'}`}>
                    {evt.severity?.toUpperCase()}
                  </span>
                </div>
                <div className="font-mono text-[8px] text-text-dim mt-0.5">
                  {new Date(evt.timestamp).toLocaleTimeString()} · {evt.event_type}
                </div>
              </div>
            ))}
          </div>

          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mt-6 mb-3">
            HTTP Traffic by Path
          </h2>
          <div className="flex flex-col gap-1">
            {Object.entries(summary?.http_requests_by_path ?? {}).map(([path, count]) => (
              <div key={path} className="flex items-center justify-between p-2 border border-border bg-surface">
                <span className="font-mono text-[9px] text-text-dim truncate">{path}</span>
                <span className="font-mono text-[10px] text-accent">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, pending }: { label: string; onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="font-mono text-[9px] tracking-widest text-text-muted border border-border px-2 py-2 hover:text-accent hover:border-accent transition-all disabled:opacity-40"
    >
      {label}
    </button>
  );
}
