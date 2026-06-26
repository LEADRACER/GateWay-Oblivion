'use client';

// ── GateWay:Oblivion — Operations Store (Zustand) ──────────────────

import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (collapsed) => set({ collapsed }),
}));

// ── Scan Progress Store ─────────────────────────────────────────────

interface ScanProgress {
  scanId: string;
  targetName: string;
  progress: number; // 0-100
  status: string;
}

interface ScanState {
  activeScans: ScanProgress[];
  upsertScan: (scan: ScanProgress) => void;
  removeScan: (scanId: string) => void;
  clearCompleted: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  activeScans: [],
  upsertScan: (scan) =>
    set((s) => {
      const existing = s.activeScans.findIndex((x) => x.scanId === scan.scanId);
      if (existing >= 0) {
        const updated = [...s.activeScans];
        updated[existing] = scan;
        return { activeScans: updated };
      }
      return { activeScans: [...s.activeScans, scan] };
    }),
  removeScan: (scanId) =>
    set((s) => ({
      activeScans: s.activeScans.filter((x) => x.scanId !== scanId),
    })),
  clearCompleted: () =>
    set((s) => ({
      activeScans: s.activeScans.filter((x) => x.progress < 100),
    })),
}));
