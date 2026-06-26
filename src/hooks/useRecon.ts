'use client';

// ── GateWay:Oblivion — Recon Dashboard Hooks ──────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ── Types ─────────────────────────────────────────────────────────

export interface ReconSummary {
  is_scanning: boolean;
  active_task: { target: string; profile: string; priority: string } | null;
  queue_depth: number;
  devices_found: number;
  total_devices: number;
  total_ports: number;
  total_vulnerabilities: number;
  services: Record<string, number>;
  critical_vulns: number;
  high_vulns: number;
  health_up: number;
  health_down: number;
  last_scan: Record<string, unknown> | null;
  netvision_reachable: boolean;
  error?: string;
}

export interface NetVisionDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  os?: string;
  latency_ms?: number;
  distance?: number;
  hop_count?: number;
  strength?: number;
  vulns_detected?: boolean;
  first_seen?: string;
  last_seen?: string;
  health?: {
    latency_ms?: number;
    status: string;
    packet_loss?: number;
    last_check?: string;
  };
  ports?: Array<{
    port: number;
    protocol: string;
    state: string;
    service_name?: string;
    service_version?: string;
    banner?: string;
  }>;
}

export interface NetVisionScan {
  id: number;
  started_at: string;
  completed_at?: string;
  target: string;
  profile: string;
  duration?: number;
  status: string;
  total_devices?: number;
  subnets_scanned?: number;
}

export interface NetVisionVuln {
  id: number;
  device_ip: string;
  port_id: number;
  cve_id: string;
  severity: string;
  cvss_score: number;
  description: string;
  service: string;
  first_seen: string;
}

// ── Recon Summary ─────────────────────────────────────────────────

async function fetchReconSummary(): Promise<ReconSummary> {
  const res = await fetch(`${API_BASE}/api/recon/summary`);
  if (!res.ok) throw new Error('Failed to fetch recon summary');
  return res.json();
}

export function useReconSummary() {
  return useQuery({
    queryKey: ['recon', 'summary'],
    queryFn: fetchReconSummary,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

// ── Recon Devices ─────────────────────────────────────────────────

async function fetchReconDevices(): Promise<{ devices: NetVisionDevice[] }> {
  const res = await fetch(`${API_BASE}/api/recon/devices`);
  if (!res.ok) throw new Error('Failed to fetch recon devices');
  return res.json();
}

export function useReconDevices() {
  return useQuery({
    queryKey: ['recon', 'devices'],
    queryFn: fetchReconDevices,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

// ── Recon Scans ──────────────────────────────────────────────────

async function fetchReconScans(): Promise<{ scans: NetVisionScan[] }> {
  const res = await fetch(`${API_BASE}/api/recon/scans`);
  if (!res.ok) throw new Error('Failed to fetch recon scans');
  return res.json();
}

export function useReconScans() {
  return useQuery({
    queryKey: ['recon', 'scans'],
    queryFn: fetchReconScans,
    refetchInterval: 30_000,
  });
}

// ── Recon Vulnerabilities ────────────────────────────────────────

async function fetchReconVulns(): Promise<{ vulnerabilities: NetVisionVuln[] }> {
  const res = await fetch(`${API_BASE}/api/recon/vulnerabilities`);
  if (!res.ok) throw new Error('Failed to fetch vulnerabilities');
  return res.json();
}

export function useReconVulns() {
  return useQuery({
    queryKey: ['recon', 'vulnerabilities'],
    queryFn: fetchReconVulns,
    refetchInterval: 60_000,
  });
}

// ── Trigger Scan ─────────────────────────────────────────────────

async function triggerScan(params: { target?: string; profile?: string }) {
  const searchParams = new URLSearchParams();
  if (params.target) searchParams.set('target', params.target);
  searchParams.set('profile', params.profile || 'quick');
  const res = await fetch(`${API_BASE}/api/recon/scan?${searchParams}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger scan');
  return res.json();
}

export function useTriggerScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recon'] });
    },
  });
}

// ── Stop Scan ────────────────────────────────────────────────────

async function stopScan() {
  const res = await fetch(`${API_BASE}/api/recon/scan/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to stop scan');
  return res.json();
}

export function useStopScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: stopScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recon'] });
    },
  });
}
