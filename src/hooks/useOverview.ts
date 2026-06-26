'use client';

// ── GateWay:Oblivion — Overview Dashboard Hook ───────────────────

import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ── Types ─────────────────────────────────────────────────────────

export interface ServiceStatus {
  name: string;
  status: string;
  type: string;
  version?: string;
}

export interface DashboardStats {
  total_targets: number;
  total_vulnerabilities: number;
  critical_vulnerabilities: number;
  high_vulnerabilities: number;
  operations_total: number;
  operations_running: number;
  reports_count: number;
  risk_score: number;
}

export interface RecentOperation {
  id: string;
  title: string;
  type: string;
  status: string;
  progress: number;
  created_at: string;
}

export interface RecentTarget {
  id: string;
  target: string;
  type: string;
}

export interface VulnItem {
  id: string;
  cve_id: string;
  title: string;
  severity: string;
  cvss_score: number;
  has_exploit: boolean;
  affected_device: string;
  exploitability?: string;
}

export interface OverviewData {
  services: ServiceStatus[];
  stats: DashboardStats;
  recent_operations: RecentOperation[];
  recent_targets: RecentTarget[];
  critical_vulnerabilities: VulnItem[];
  high_vulnerabilities: VulnItem[];
}

// ── Hook ──────────────────────────────────────────────────────────

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: async (): Promise<OverviewData> => {
      const res = await fetch(`${API_BASE}/api/overview`);
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    },
    refetchInterval: 30_000,
    // standalone fallback — return demo data if API is unreachable
    retry: 1,
    retryDelay: 1000,
  });
}
