'use client';

// ── GateWay:Oblivion — Native NetVision Control Hooks ────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface NetVisionMetricSummary {
  metric_families: number;
  http_requests_total: number;
  http_requests_by_path: Record<string, number>;
  http_errors: number;
  scans_total: number;
  scans_in_progress: number | null;
  devices_up: number | null;
  devices_down: number | null;
  process_cpu_seconds: number | null;
  process_resident_memory_bytes: number | null;
  process_open_fds: number | null;
  capture_packets: number;
  alerts_sent: number;
}

export interface NetVisionMetrics {
  reachable: boolean;
  summary: NetVisionMetricSummary;
}

export interface NetVisionCapabilities {
  reachable: boolean;
  adapter_actions: string[];
  health: { status: string; available?: boolean; base_url?: string };
  health_ready: { status: string; checks?: Record<string, boolean> };
  config: { local_subnet?: string };
  sonar_sensors: { sensors?: Array<{ name: string; available: boolean; usable: boolean }> };
  sonar_status: { modes?: string[]; sensors?: number };
  bettercap_status: { running?: boolean; api_up?: boolean; root_process?: boolean };
  capture_status: Record<string, unknown>;
  scan_queue: Record<string, unknown>;
}

export interface NetVisionEvent {
  id: string;
  event_type: string;
  timestamp: string;
  severity?: string;
  title?: string;
  payload: Record<string, unknown>;
}

export function useNetVisionMetrics(raw = false) {
  return useQuery({
    queryKey: ['netvision', 'metrics', raw],
    queryFn: async (): Promise<NetVisionMetrics> => {
      const res = await fetch(`${API_BASE}/api/netvision/metrics?raw=${raw}`);
      if (!res.ok) throw new Error('Failed to fetch NetVision metrics');
      return res.json();
    },
    refetchInterval: 15_000,
  });
}

export function useNetVisionCapabilities() {
  return useQuery({
    queryKey: ['netvision', 'capabilities'],
    queryFn: async (): Promise<NetVisionCapabilities> => {
      const res = await fetch(`${API_BASE}/api/netvision/capabilities`);
      if (!res.ok) throw new Error('Failed to fetch NetVision capabilities');
      return res.json();
    },
    refetchInterval: 15_000,
  });
}

export function useNetVisionEvents(limit = 50) {
  return useQuery({
    queryKey: ['netvision', 'events', limit],
    queryFn: async (): Promise<{ events: NetVisionEvent[]; last_websocket_event: Record<string, unknown> | null }> => {
      const res = await fetch(`${API_BASE}/api/netvision/events?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch NetVision events');
      return res.json();
    },
    refetchInterval: 10_000,
  });
}

export function useNetVisionControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, params }: { action: string; params?: Record<string, unknown> }) => {
      const res = await fetch(`${API_BASE}/api/netvision/control/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
      });
      if (!res.ok) throw new Error(`Control ${action} failed`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['netvision'] });
      queryClient.invalidateQueries({ queryKey: ['recon'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
