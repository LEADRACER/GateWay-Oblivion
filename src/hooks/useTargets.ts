'use client';

// ── GateWay:Oblivion — Targets Data Hooks ─────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Target } from '@/lib/types/database';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Fetch Targets ───────────────────────────────────────────────

async function fetchTargets(): Promise<Target[]> {
  const res = await fetch(`${API_BASE}/api/targets`);
  if (!res.ok) throw new Error('Failed to fetch targets');
  return res.json();
}

export function useTargets() {
  return useQuery({
    queryKey: ['targets'],
    queryFn: fetchTargets,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

// ── Fetch Single Target ─────────────────────────────────────────

async function fetchTarget(id: string): Promise<Target> {
  const res = await fetch(`${API_BASE}/api/targets/${id}`);
  if (!res.ok) throw new Error('Failed to fetch target');
  return res.json();
}

export function useTarget(id: string) {
  return useQuery({
    queryKey: ['targets', id],
    queryFn: () => fetchTarget(id),
    enabled: !!id,
  });
}

// ── Create Target ───────────────────────────────────────────────

async function createTarget(data: Partial<Target>): Promise<Target> {
  const res = await fetch(`${API_BASE}/api/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create target');
  return res.json();
}

export function useCreateTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

// ── Update Target ───────────────────────────────────────────────

async function updateTarget({ id, data }: { id: string; data: Partial<Target> }): Promise<Target> {
  const res = await fetch(`${API_BASE}/api/targets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update target');
  return res.json();
}

export function useUpdateTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

// ── Patch Target ────────────────────────────────────────────────

async function patchTarget({ id, updates }: { id: string; updates: Partial<Target> }): Promise<Target> {
  const res = await fetch(`${API_BASE}/api/targets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update target');
  return res.json();
}

export function usePatchTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchTarget,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['targets', data.id] });
    },
  });
}

// ── Delete Target ───────────────────────────────────────────────

async function deleteTarget(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/targets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete target');
}

export function useDeleteTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

// ── Bulk Import ─────────────────────────────────────────────────

async function bulkImport(data: { targets: Partial<Target>[]; campaign_id?: string }): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const res = await fetch(`${API_BASE}/api/targets/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to bulk import');
  return res.json();
}

export function useBulkImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}

// ── Target Stats ────────────────────────────────────────────────

async function fetchTargetStats(): Promise<{
  total: number;
  active: number;
  archived: number;
  compromised: number;
  pending: number;
}> {
  const res = await fetch(`${API_BASE}/api/targets/stats`);
  if (!res.ok) throw new Error('Failed to fetch target stats');
  return res.json();
}

export function useTargetStats() {
  return useQuery({
    queryKey: ['targets', 'stats'],
    queryFn: fetchTargetStats,
    refetchInterval: 30_000,
  });
}
