'use client';

// ── GateWay:Oblivion — Unified Centre Hooks ───────────────────────

import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export type Side = 'all' | 'red' | 'blue';

export interface CentreOverview {
  generated_at: string;
  mode: string;
  scope: { enforced: boolean; allowlist: string[]; description: string };
  red: {
    tools_ready: string[];
    pipelines_total: number;
    pipelines_running: number;
    runs_total: number;
    gated_runs: number;
    gated_run_ids: string[];
    attack_surface: number;
    exploits_available: number;
    last_run: Record<string, unknown> | null;
  };
  blue: {
    detections_total: number;
    critical_detections: number;
    posture_score: number;
    critical_vulns: number;
    high_vulns: number;
    operations_success_rate: number;
    capture_available: boolean;
    blue_sources: Record<string, boolean>;
  };
  shared: {
    events_total: number;
    red_events: number;
    blue_events: number;
    tools_total: number;
    tools_online: number;
  };
}

export interface CentreEvent {
  id: string;
  timestamp: string;
  side: 'red' | 'blue' | 'shared';
  source: string;
  event_type: string;
  title: string;
  severity: string | null;
  target_ref: string | null;
  payload: Record<string, unknown>;
}

export interface CentreDetection {
  id: string;
  title: string;
  severity: string;
  source: string;
  event_type: string;
  timestamp: string;
  detail: string;
}

export function useCentreOverview() {
  return useQuery({
    queryKey: ['centre', 'overview'],
    queryFn: async (): Promise<CentreOverview> => {
      const res = await fetch(`${API_BASE}/api/centre/overview`);
      if (!res.ok) throw new Error('Failed to fetch centre overview');
      return res.json();
    },
    refetchInterval: 8_000,
  });
}

export function useCentreTimeline(side: Side, limit = 60) {
  return useQuery({
    queryKey: ['centre', 'timeline', side, limit],
    queryFn: async (): Promise<CentreEvent[]> => {
      const res = await fetch(`${API_BASE}/api/centre/timeline?side=${side}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch centre timeline');
      const json = await res.json();
      return Array.isArray(json) ? json : json.events ?? [];
    },
    refetchInterval: 5_000,
  });
}

export function useCentreDetections(limit = 40) {
  return useQuery({
    queryKey: ['centre', 'detections', limit],
    queryFn: async (): Promise<CentreDetection[]> => {
      const res = await fetch(`${API_BASE}/api/centre/detections?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch detections');
      const json = await res.json();
      return Array.isArray(json) ? json : json.detections ?? [];
    },
    refetchInterval: 10_000,
  });
}

export interface AuditStatus {
  valid: boolean;
  entries: number;
  broken_at: number | null;
  reason: string | null;
}

export function useAuditStatus() {
  return useQuery({
    queryKey: ['audit', 'verify'],
    queryFn: async (): Promise<AuditStatus> => {
      const res = await fetch(`${API_BASE}/api/audit/verify`);
      if (!res.ok) throw new Error('Failed to verify audit chain');
      return res.json();
    },
    refetchInterval: 15_000,
  });
}
