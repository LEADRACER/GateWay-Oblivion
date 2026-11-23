'use client';

// ── GateWay:Oblivion — Engagement Management Hooks ───────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface Engagement {
  id: string;
  code: string;
  name: string;
  objective: string;
  engagement_type: string;
  state: string;
  priority: string;
  lead_operator: string;
  team: string[];
  client?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  scope_id?: string | null;
  roe_id?: string | null;
  risk_score: number;
  findings_count: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Scope {
  id: string;
  engagement_id: string;
  include: string[];
  exclude: string[];
  allowed_tools: string[];
  allowed_actions: string[];
  forbidden_actions: string[];
  time_windows: Array<Record<string, unknown>>;
  max_rate?: number | null;
  data_handling: string;
  updated_at: string;
}

export interface RoE {
  id: string;
  engagement_id: string;
  version: number;
  authorized_by: string;
  authorized_at: string;
  document_ref?: string | null;
  stop_conditions: string[];
  legal_notes?: string | null;
  signed: boolean;
}

export interface EngagementTask {
  id: string;
  engagement_id: string;
  title: string;
  technique?: string | null;
  tool?: string | null;
  action?: string | null;
  params: Record<string, unknown>;
  depends_on: string[];
  status: string;
  gate: boolean;
  owner?: string | null;
  pipeline_run_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: string;
  engagement_id: string;
  title: string;
  task_id?: string | null;
  severity: string;
  cvss_score?: number | null;
  cve_id?: string | null;
  status: string;
  owner?: string | null;
  evidence_ids: string[];
  source_tool: string;
  discovered_at: string;
}

export interface Evidence {
  id: string;
  engagement_id: string;
  finding_id?: string | null;
  kind: string;
  source_tool: string;
  sha256: string;
  path_or_hash: string;
  captured_at: string;
  captured_by: string;
}

export interface EngagementEvent {
  id: string;
  timestamp: string;
  source_tool: string;
  event_type: string;
  title: string;
  severity: string | null;
  engagement_id?: string | null;
  task_id?: string | null;
  payload: Record<string, unknown>;
}

export interface EngagementReport {
  id: string;
  engagement_id: string;
  kind: string;
  path: string;
  content: string;
  generated_at: string;
}

export interface EngagementMetrics {
  engagement_id: string;
  code: string;
  state: string;
  progress: number;
  tasks_total: number;
  task_status: Record<string, number>;
  findings_total: number;
  findings_by_severity: Record<string, number>;
  risk_score: number;
  evidence_count: number;
  events_count: number;
}

const OPERATOR = 'operator';
const headers = (engagementId?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-Operator': OPERATOR,
  ...(engagementId ? { 'X-Engagement': engagementId } : {}),
});

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useEngagements() {
  return useQuery({
    queryKey: ['engagements'],
    queryFn: () => api<{ engagements: Engagement[] }>('/api/engagements')
      .then((data) => data.engagements ?? []),
    refetchInterval: 15_000,
  });
}

export function useEngagement(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id],
    queryFn: () => api<Engagement>(`/api/engagements/${id}`),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useEngagementScope(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'scope'],
    queryFn: () => api<Scope>(`/api/engagements/${id}/scope`),
    enabled: !!id,
  });
}

export function useEngagementRoe(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'roe'],
    queryFn: () => api<RoE>(`/api/engagements/${id}/roe`),
    enabled: !!id,
  });
}

export function useEngagementTasks(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'tasks'],
    queryFn: () => api<{ tasks: EngagementTask[] }>(`/api/engagements/${id}/tasks`)
      .then((data) => data.tasks ?? []),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useEngagementFindings(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'findings'],
    queryFn: () => api<{ findings: Finding[] }>(`/api/engagements/${id}/findings`)
      .then((data) => data.findings ?? []),
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useEngagementEvidence(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'evidence'],
    queryFn: () => api<{ evidence: Evidence[] }>(`/api/engagements/${id}/evidence`)
      .then((data) => data.evidence ?? []),
    enabled: !!id,
  });
}

export function useEngagementEvents(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'events'],
    queryFn: () => api<{ events: EngagementEvent[] }>(`/api/engagements/${id}/events`)
      .then((data) => data.events ?? []),
    enabled: !!id,
    refetchInterval: 8_000,
  });
}

export function useEngagementMetrics(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'metrics'],
    queryFn: () => api<EngagementMetrics>(`/api/engagements/${id}/metrics`),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useEngagementReport(id: string | null, kind: string) {
  return useQuery({
    queryKey: ['engagements', id, 'report', kind],
    queryFn: () => api<EngagementReport>(`/api/engagements/${id}/report?kind=${kind}`),
    enabled: !!id,
    retry: false,
  });
}

export function useEngagementReports(id: string | null) {
  return useQuery({
    queryKey: ['engagements', id, 'reports'],
    queryFn: () => api<{ reports: EngagementReport[] }>(`/api/engagements/${id}/reports`)
      .then((data) => data.reports ?? []),
    enabled: !!id,
  });
}

export function useEngagementActions() {
  const queryClient = useQueryClient();
  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['engagements'] });
    if (id) queryClient.invalidateQueries({ queryKey: ['engagements', id] });
  };

  const post = useMutation({
    mutationFn: async ({ path, body, engagementId }: {
      path: string; body?: Record<string, unknown>; engagementId?: string;
    }) => api<Record<string, unknown>>(`${path}`, {
      method: 'POST', headers: headers(engagementId), body: JSON.stringify(body ?? {}),
    }),
    onSuccess: (_data, variables) => invalidate(variables.engagementId),
  });

  const put = useMutation({
    mutationFn: async ({ path, body, engagementId }: {
      path: string; body: Record<string, unknown>; engagementId?: string;
    }) => api<Record<string, unknown>>(path, {
      method: 'PUT', headers: headers(engagementId), body: JSON.stringify(body),
    }),
    onSuccess: (_data, variables) => invalidate(variables.engagementId),
  });

  const patch = useMutation({
    mutationFn: async ({ path, body, engagementId }: {
      path: string; body: Record<string, unknown>; engagementId?: string;
    }) => api<Record<string, unknown>>(path, {
      method: 'PATCH', headers: headers(engagementId), body: JSON.stringify(body),
    }),
    onSuccess: (_data, variables) => invalidate(variables.engagementId),
  });

  return { post, put, patch, invalidate };
}
