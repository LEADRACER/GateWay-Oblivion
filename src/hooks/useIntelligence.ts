'use client';

// ── GateWay:Oblivion — Intelligence & Reporting Hooks ────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ── Types ─────────────────────────────────────────────────────────

export interface IntelSummary {
  total_vulnerabilities: number;
  severity_breakdown: Record<string, number>;
  critical_exploits: number;
  operations_total: number;
  operations_running: number;
  operations_completed: number;
  operations_success_rate: number;
  risk_score: number;
  netvision_status: { reachable: boolean };
  report_count: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  event_type: string;
  title: string;
  description?: string;
  severity?: string;
  source: string;
  related_id?: string;
}

export interface Threat {
  id: string;
  type: string;
  title: string;
  severity: string;
  source: string;
  affected: string;
  timestamp: string;
  status: string;
}

export interface ReportDef {
  label: string;
  description: string;
  sections: string[];
}

export interface Report {
  id: string;
  title: string;
  report_type: string;
  scope?: string;
  status: string;
  content: Record<string, unknown>;
  summary?: string;
  risk_score?: number;
  generated_at: string;
  created_at: string;
}

// ── Summary ───────────────────────────────────────────────────────

export function useIntelSummary() {
  return useQuery({
    queryKey: ['intel', 'summary'],
    queryFn: async (): Promise<IntelSummary> => {
      const res = await fetch(`${API_BASE}/api/intelligence/summary`);
      if (!res.ok) throw new Error('Failed to fetch intel summary');
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

// ── Timeline ──────────────────────────────────────────────────────

export function useTimeline(hours = 48) {
  return useQuery({
    queryKey: ['intel', 'timeline', hours],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const res = await fetch(`${API_BASE}/api/intelligence/timeline?hours=${hours}`);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

// ── Threats ───────────────────────────────────────────────────────

export function useThreats() {
  return useQuery({
    queryKey: ['intel', 'threats'],
    queryFn: async (): Promise<Threat[]> => {
      const res = await fetch(`${API_BASE}/api/intelligence/threats`);
      if (!res.ok) throw new Error('Failed to fetch threats');
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

// ── Reports ───────────────────────────────────────────────────────

export function useReports(reportType?: string) {
  return useQuery({
    queryKey: ['intel', 'reports', reportType],
    queryFn: async (): Promise<Report[]> => {
      const qs = reportType ? `?report_type=${reportType}` : '';
      const res = await fetch(`${API_BASE}/api/intelligence/reports${qs}`);
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['intel', 'reports', id],
    queryFn: async (): Promise<Report> => {
      const res = await fetch(`${API_BASE}/api/intelligence/reports/${id}`);
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useReportDefinitions() {
  return useQuery({
    queryKey: ['intel', 'report-definitions'],
    queryFn: async (): Promise<Record<string, ReportDef>> => {
      const res = await fetch(`${API_BASE}/api/intelligence/reports/definitions`);
      if (!res.ok) throw new Error('Failed to fetch report definitions');
      return res.json();
    },
    staleTime: 300_000,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; report_type: string; scope?: string }) => {
      const res = await fetch(`${API_BASE}/api/intelligence/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to generate report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intel', 'reports'] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/intelligence/reports/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intel', 'reports'] });
    },
  });
}
