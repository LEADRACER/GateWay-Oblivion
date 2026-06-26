'use client';

// ── GateWay:Oblivion — Campaigns Data Hooks ────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  targets: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${API_BASE}/api/campaigns`);
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
    refetchInterval: 30_000,
  });
}

async function createCampaign(data: { name: string; description?: string }): Promise<Campaign> {
  const res = await fetch(`${API_BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create campaign');
  return res.json();
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/campaigns/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete campaign');
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });
}
