'use client';

// ── GateWay:Oblivion — Vulnerability Data Hooks ───────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ── Types ─────────────────────────────────────────────────────────

export interface Vulnerability {
  id: string;
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  cvss_score: number;
  cvss_vector: string;
  affected_device: string;
  affected_port: number;
  affected_service: string;
  exploitability: string;
  has_exploit: boolean;
  exploit_source: string;
  status: string;
  notes: string;
  remediation: string;
  references: string[];
  discovered_by: string;
  first_seen: string;
  last_seen: string;
  updated_at: string;
}

export interface VulnStats {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_exploitability: Record<string, number>;
  exploits_available: number;
  critical_exploits: number;
  avg_cvss: number;
  top_services: Record<string, number>;
  affected_devices: number;
}

// ── List Vulns ────────────────────────────────────────────────────

async function fetchVulns(params: Record<string, string> = {}): Promise<Vulnerability[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) searchParams.set(k, v);
  });
  const qs = searchParams.toString();
  const res = await fetch(`${API_BASE}/api/vulnerabilities${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error('Failed to fetch vulnerabilities');
  return res.json();
}

export function useVulnerabilities(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['vulnerabilities', 'list', filters],
    queryFn: () => fetchVulns(filters),
    refetchInterval: 30_000,
  });
}

// ── Single Vuln ───────────────────────────────────────────────────

async function fetchVuln(id: string): Promise<Vulnerability> {
  const res = await fetch(`${API_BASE}/api/vulnerabilities/${id}`);
  if (!res.ok) throw new Error('Failed to fetch vulnerability');
  return res.json();
}

export function useVulnerability(id: string) {
  return useQuery({
    queryKey: ['vulnerabilities', id],
    queryFn: () => fetchVuln(id),
    enabled: !!id,
  });
}

// ── Stats ─────────────────────────────────────────────────────────

async function fetchVulnStats(): Promise<VulnStats> {
  const res = await fetch(`${API_BASE}/api/vulnerabilities/stats`);
  if (!res.ok) throw new Error('Failed to fetch vuln stats');
  return res.json();
}

export function useVulnStats() {
  return useQuery({
    queryKey: ['vulnerabilities', 'stats'],
    queryFn: fetchVulnStats,
    refetchInterval: 30_000,
  });
}

// ── Patch Vuln ────────────────────────────────────────────────────

async function patchVulnRequest({ id, ...patch }: { id: string; [key: string]: unknown }) {
  const res = await fetch(`${API_BASE}/api/vulnerabilities/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update vulnerability');
  return res.json();
}

export function usePatchVuln() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchVulnRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    },
  });
}

// ── Create Vuln ───────────────────────────────────────────────────

async function createVuln(vuln: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/vulnerabilities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vuln),
  });
  if (!res.ok) throw new Error('Failed to create vulnerability');
  return res.json();
}

export function useCreateVuln() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVuln,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    },
  });
}

// ── Delete Vuln ───────────────────────────────────────────────────

async function deleteVuln(id: string) {
  const res = await fetch(`${API_BASE}/api/vulnerabilities/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete vulnerability');
  return res.json();
}

export function useDeleteVuln() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVuln,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    },
  });
}

// ── Sync from NetVision ───────────────────────────────────────────

async function syncVulns() {
  const res = await fetch(`${API_BASE}/api/vulnerabilities/sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to sync vulnerabilities');
  return res.json();
}

export function useSyncVulns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncVulns,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    },
  });
}
