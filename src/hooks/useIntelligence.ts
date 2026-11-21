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

// ── OSINT Overview ─────────────────────────────────────────────────

export interface OsintSource {
  source: string;
  status: string;
  action: string;
}

export interface OsintOverview {
  sources: OsintSource[];
  threats: Threat[];
  summary: IntelSummary;
}

export function useOsint() {
  return useQuery({
    queryKey: ['intel', 'osint'],
    queryFn: async (): Promise<OsintOverview> => {
      const res = await fetch(`${API_BASE}/api/osint`);
      if (!res.ok) throw new Error('Failed to fetch osint overview');
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

// ── Pipelines ──────────────────────────────────────────────────────

export interface PipelineStep {
  id: string;
  name: string;
  tool: string;
  action: string;
  params: Record<string, unknown>;
  depends_on: string[];
  condition: string | null;
  gate: boolean;
  status: string;
  result: unknown;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  status: string;
  current_step: string | null;
  step_results: Record<string, unknown>;
  logs: unknown[];
  approved: boolean;
  target_ref: string | null;
  correlation_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async (): Promise<Pipeline[]> => {
      const res = await fetch(`${API_BASE}/api/pipelines`);
      if (!res.ok) throw new Error('Failed to fetch pipelines');
      const json = await res.json();
      return Array.isArray(json) ? json : json.pipelines ?? [];
    },
    refetchInterval: 30_000,
  });
}

export function usePipelineRuns(pipelineId?: string) {
  return useQuery({
    queryKey: ['pipelines', 'runs', pipelineId],
    queryFn: async (): Promise<PipelineRun[]> => {
      const url = pipelineId ? `${API_BASE}/api/pipelines?pipeline_id=${pipelineId}` : `${API_BASE}/api/pipelines/runs`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch pipeline runs');
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.runs ?? [];
      return Array.isArray(list) ? list : [];
    },
    enabled: !pipelineId,
  });
}

export function useRunPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const res = await fetch(`${API_BASE}/api/pipelines/${pipelineId}/run`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start pipeline');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines', 'runs'] });
    },
  });
}

export function useApprovePipelineRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`${API_BASE}/api/pipelines/runs/${runId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve run');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', 'runs'] });
    },
  });
}

export function useCancelPipelineRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`${API_BASE}/api/pipelines/runs/${runId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to cancel run');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', 'runs'] });
    },
  });
}
