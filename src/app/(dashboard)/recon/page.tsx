'use client';

// ── GateWay:Oblivion — Recon Dashboard Page ───────────────────────

import { useState, useMemo } from 'react';
import {
  useReconSummary,
  useReconDevices,
  useReconScans,
  useReconVulns,
  useTriggerScan,
  useStopScan,
} from '@/hooks/useRecon';
import { StatCard, Badge } from '@/components/ui/primitives';

export default function ReconPage() {
  const { data: summary, isLoading: summaryLoading } = useReconSummary();
  const { data: devicesData, isLoading: devicesLoading } = useReconDevices();
  const { data: scansData, isLoading: scansLoading } = useReconScans();
  const { data: vulnsData } = useReconVulns();
  const triggerScan = useTriggerScan();
  const stopScan = useStopScan();

  const [scanTarget, setScanTarget] = useState('');
  const [scanProfile, setScanProfile] = useState('quick');
  const [searchQuery, setSearchQuery] = useState('');

  const netvisionOnline = summary?.netvision_reachable ?? false;

  const devices = devicesData?.devices ?? [];

  // Filtered devices
  const filteredDevices = useMemo(() => {
    if (!searchQuery) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter(
      (d) =>
        d.ip.includes(q) ||
        (d.hostname && d.hostname.toLowerCase().includes(q)) ||
        (d.vendor && d.vendor.toLowerCase().includes(q)) ||
        (d.os && d.os.toLowerCase().includes(q))
    );
  }, [devices, searchQuery]);

  // Top services by port count
  const topServices = useMemo(() => {
    if (!summary?.services) return [];
    return Object.entries(summary.services)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [summary]);

  const handleTriggerScan = () => {
    triggerScan.mutate({ target: scanTarget || undefined, profile: scanProfile });
  };

  const handleStopScan = () => {
    stopScan.mutate();
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg text-text tracking-tight">Recon Dashboard</h1>
            <NetVisionStatus online={netvisionOnline} />
          </div>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Live network reconnaissance feed from NetVision
          </p>
        </div>

        {/* Scan controls */}
        <div className="flex items-center gap-2">
          <input
            value={scanTarget}
            onChange={(e) => setScanTarget(e.target.value)}
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-44"
            placeholder="Target IP / CIDR…"
          />
          <select
            value={scanProfile}
            onChange={(e) => setScanProfile(e.target.value)}
            className="bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none"
          >
            <option value="quick">Quick</option>
            <option value="deep">Deep</option>
            <option value="full">Full</option>
          </select>
          {summary?.is_scanning ? (
            <button
              onClick={handleStopScan}
              className="font-mono text-[10px] tracking-widest text-danger border border-danger/50 px-4 py-2 hover:bg-danger/10 transition-colors"
            >
              STOP SCAN
            </button>
          ) : (
            <button
              onClick={handleTriggerScan}
              disabled={triggerScan.isPending}
              className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {triggerScan.isPending ? 'TRIGGERING…' : 'SCAN'}
            </button>
          )}
        </div>
      </div>

      {/* ── Scan status bar ─────────────────────── */}
      {summary?.is_scanning && (
        <div className="border border-accent/30 bg-accent/5 p-3 mb-6 flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
          <span className="font-mono text-[10px] text-accent tracking-wider">
            ACTIVE SCAN
          </span>
          {summary.active_task && (
            <>
              <span className="font-mono text-[10px] text-text-dim">→</span>
              <span className="font-mono text-[10px] text-text">{summary.active_task.target}</span>
              <Badge variant="warning">{summary.active_task.profile}</Badge>
            </>
          )}
        </div>
      )}

      {/* ── Stat cards ──────────────────────────── */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard label="Devices" value={summary?.total_devices ?? '…'} accent="accent" />
        <StatCard label="Open Ports" value={summary?.total_ports ?? '…'} />
        <StatCard label="Vulnerabilities" value={summary?.total_vulnerabilities ?? '…'} accent="danger" />
        <StatCard label="Critical Vulns" value={summary?.critical_vulns ?? '…'} accent="danger" />
        <StatCard label="Health Up" value={summary?.health_up ?? '…'} accent="accent" />
        <StatCard label="Health Down" value={summary?.health_down ?? '…'} accent="warning" />
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* ── Device table ──────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
              Discovered Devices ({filteredDevices.length})
            </h2>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-bg border border-border px-3 py-1.5 font-mono text-[10px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-48"
              placeholder="Filter devices…"
            />
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 px-3 py-2 border-b border-border">
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">IP / Hostname</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">MAC / Vendor</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">OS</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Ports</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Health</span>
            <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">Vulns</span>
          </div>

          {/* Device rows */}
          {devicesLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin rounded-full" />
            </div>
          )}

          {!devicesLoading && filteredDevices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border">
              <span className="font-mono text-xs text-text-dim">
                {!netvisionOnline
                  ? 'NetVision offline — no device data available'
                  : 'No devices discovered yet'}
              </span>
            </div>
          )}

          {!devicesLoading && filteredDevices.map((device) => (
            <DeviceRow key={device.ip} device={device} />
          ))}
        </div>

        {/* ── Sidebar ──────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Services distribution */}
          <div className="border border-border bg-surface p-4">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
              Top Services
            </h2>
            {topServices.length === 0 ? (
              <span className="font-mono text-[10px] text-text-dim">No services detected</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {topServices.map(([service, count]) => (
                  <div key={service} className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-text truncate mr-2">{service}</span>
                    <span className="font-mono text-[10px] text-text-dim shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent scans */}
          <div className="border border-border bg-surface p-4">
            <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
              Recent Scans
            </h2>
            {scansLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-border border-t-accent animate-spin rounded-full" />
              </div>
            )}
            {!scansLoading && (!scansData?.scans || scansData.scans.length === 0) && (
              <span className="font-mono text-[10px] text-text-dim">No scans recorded</span>
            )}
            {scansData?.scans?.slice(0, 5).map((scan) => (
              <div
                key={scan.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] text-text truncate">
                    {scan.target || 'auto'}
                  </div>
                  <div className="font-mono text-[9px] text-text-dim">
                    {scan.profile} · {scan.total_devices ?? '?'} devices
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  <ScanStatusBadge status={scan.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function NetVisionStatus({ online }: { online: boolean }) {
  if (!online) {
    return (
      <span className="font-mono text-[9px] tracking-widest text-warning border border-warning/30 px-2 py-0.5">
        NETVISION OFFLINE
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] tracking-widest text-accent border border-accent/30 px-2 py-0.5">
      NETVISION CONNECTED
    </span>
  );
}

function ScanStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    running: 'text-accent border-accent/30',
    completed: 'text-text-muted border-border',
    failed: 'text-danger border-danger/30',
  };
  return (
    <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${colorMap[status] || 'text-text-dim border-border'}`}>
      {status}
    </span>
  );
}

function DeviceRow({ device }: { device: any }) {
  const portCount = device.ports?.length ?? 0;
  const healthStatus = device.health?.status ?? 'unknown';
  const hasVulns = device.vulns_detected;

  const healthColor: Record<string, string> = {
    up: 'text-accent',
    down: 'text-danger',
    unknown: 'text-text-dim',
  };

  return (
    <div className="grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 px-3 py-2.5 border-b border-border hover:bg-surface-2 transition-colors">
      <div>
        <div className="font-mono text-xs text-text">{device.ip}</div>
        {device.hostname && (
          <div className="font-mono text-[9px] text-text-dim truncate">{device.hostname}</div>
        )}
      </div>
      <div className="font-mono text-[10px] text-text-muted">
        <div>{device.vendor || '—'}</div>
        {device.mac && <div className="text-[9px] text-text-dim">{device.mac}</div>}
      </div>
      <div className="font-mono text-[10px] text-text-muted">{device.os || '—'}</div>
      <div className="font-mono text-[10px] text-text">{portCount > 0 ? portCount : '—'}</div>
      <div className={`font-mono text-[10px] ${healthColor[healthStatus] || 'text-text-dim'}`}>
        {healthStatus.toUpperCase()}
      </div>
      <div className="font-mono text-[10px]">
        {hasVulns ? (
          <span className="text-danger">YES</span>
        ) : (
          <span className="text-text-dim">—</span>
        )}
      </div>
    </div>
  );
}
