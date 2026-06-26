// ── GateWay:Oblivion — Dashboard Layout ────────────────────────────

import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
