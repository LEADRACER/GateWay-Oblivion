'use client';

// ── GateWay:Oblivion — Tool Registry Hooks ───────────────────────

import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface ToolInfo {
  name: string;
  status: string;
  available?: boolean;
  connected?: boolean;
  actions: string[];
}

export function useTools() {
  return useQuery({
    queryKey: ['tools'],
    queryFn: async (): Promise<ToolInfo[]> => {
      const res = await fetch(`${API_BASE}/api/tools`);
      if (!res.ok) throw new Error('Failed to fetch tools');
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: 30_000,
  });
}
