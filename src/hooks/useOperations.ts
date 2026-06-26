'use client';

// ── GateWay:Oblivion — Operations Data Hooks ──────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ── Types ─────────────────────────────────────────────────────────

export interface OperationLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  data: Record<string, unknown>;
}

export interface Operation {
  id: string;
  name: string;
  title?: string;
  operation_type: string;
  target_id?: string;
  target_ref?: string;
  target?: string;
  parameters: Record<string, unknown>;
  status: string;
  progress: number;
  started_by: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  result_summary?: string;
  logs: OperationLog[];
  created_at: string;
  updated_at: string;
}

export interface Runbook {
  name: string;
  description: string;
  steps: RunbookStep[];
}

export interface RunbookStep {
  name: string;
  operation_type: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface OpsStats {
  total: number;
  running: number;
  pending: number;
  completed: number;
  failed: number;
  cancelled: number;
  by_type: Record<string, number>;
  recent_completed: number;
}

// ── List Operations ───────────────────────────────────────────────

async function fetchOperations(params: Record<string, string> = {}): Promise<Operation[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) searchParams.set(k, v); });
  const qs = searchParams.toString();
  const res = await fetch(`${API_BASE}/api/operations${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error('Failed to fetch operations');
  return res.json();
}

export function useOperations(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['operations', 'list', filters],
    queryFn: () => fetchOperations(filters),
    refetchInterval: 10_000,
  });
}

// ── Single Operation ──────────────────────────────────────────────

async function fetchOperation(id: string): Promise<Operation> {
  const res = await fetch(`${API_BASE}/api/operations/${id}`);
  if (!res.ok) throw new Error('Failed to fetch operation');
  return res.json();
}

export function useOperation(id: string) {
  return useQuery({
    queryKey: ['operations', id],
    queryFn: () => fetchOperation(id),
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

// ── Statistics ────────────────────────────────────────────────────

async function fetchOpsStats(): Promise<OpsStats> {
  const res = await fetch(`${API_BASE}/api/operations/stats`);
  if (!res.ok) throw new Error('Failed to fetch ops stats');
  return res.json();
}

export function useOpsStats() {
  return useQuery({
    queryKey: ['operations', 'stats'],
    queryFn: fetchOpsStats,
    refetchInterval: 15_000,
  });
}

// ── Runbooks ─────────────────────────────────────────────────────

async function fetchRunbooks(): Promise<Runbook[]> {
  const res = await fetch(`${API_BASE}/api/operations/runbooks`);
  if (!res.ok) throw new Error('Failed to fetch runbooks');
  return res.json();
}

export function useRunbooks() {
  return useQuery({
    queryKey: ['operations', 'runbooks'],
    queryFn: fetchRunbooks,
    staleTime: 300_000,
  });
}

// ── Create Operation ─────────────────────────────────────────────

async function createOperation(data: Record<string, unknown>): Promise<Operation> {
  const res = await fetch(`${API_BASE}/api/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create operation');
  return res.json();
}

export function useCreateOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOperation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    },
  });
}

// ── Cancel Operation ─────────────────────────────────────────────

async function cancelOperation(id: string): Promise<Operation> {
  const res = await fetch(`${API_BASE}/api/operations/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel operation');
  return res.json();
}

export function useCancelOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelOperation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    },
  });
}

// ── Delete Operation ─────────────────────────────────────────────

async function deleteOperation(id: string) {
  const res = await fetch(`${API_BASE}/api/operations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete operation');
  return res.json();
}

export function useDeleteOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOperation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    },
  });
}
