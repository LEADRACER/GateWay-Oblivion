'use client';

// ── GateWay:Oblivion — Obsidian Vault Hooks ──────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface ObsidianStatus {
  vault_path: string;
  exists: boolean;
  writable: boolean;
  note_count: number;
  canvas_count: number;
  notes_folder: string;
  canvases_folder: string;
  rest_api_host: string;
  rest_api_configured: boolean;
}

export function useObsidianStatus() {
  return useQuery({
    queryKey: ['obsidian', 'status'],
    queryFn: async (): Promise<ObsidianStatus> => {
      const res = await fetch(`${API_BASE}/api/obsidian/status`);
      if (!res.ok) throw new Error('Failed to fetch Obsidian status');
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

export function useObsidianNotes(folder?: string) {
  return useQuery({
    queryKey: ['obsidian', 'notes', folder],
    queryFn: async (): Promise<string[]> => {
      const qs = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const res = await fetch(`${API_BASE}/api/obsidian/notes${qs}`);
      if (!res.ok) throw new Error('Failed to list notes');
      const json = await res.json();
      return Array.isArray(json) ? json : json.notes ?? [];
    },
    refetchInterval: 30_000,
  });
}

export function useObsidianNote(path: string | null) {
  return useQuery({
    queryKey: ['obsidian', 'note', path],
    queryFn: async (): Promise<{ path: string; content: string }> => {
      const encoded = (path ?? '').split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`${API_BASE}/api/obsidian/notes/${encoded}`);
      if (!res.ok) throw new Error('Failed to read note');
      return res.json();
    },
    enabled: !!path,
  });
}

export function useObsidianCanvases() {
  return useQuery({
    queryKey: ['obsidian', 'canvases'],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch(`${API_BASE}/api/obsidian/canvases`);
      if (!res.ok) throw new Error('Failed to list canvases');
      const json = await res.json();
      return Array.isArray(json) ? json : json.canvases ?? [];
    },
    refetchInterval: 30_000,
  });
}

export function useGenerateObsidianCanvas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/obsidian/canvases/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to generate canvas');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obsidian'] });
    },
  });
}

export function useExportObsidianReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`${API_BASE}/api/obsidian/reports/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId }),
      });
      if (!res.ok) throw new Error('Failed to export report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obsidian'] });
    },
  });
}
