'use client';

// ── GateWay:Oblivion — UI Primitives ───────────────────────────────

import type { ReactNode } from 'react';

// ── StatCard ───────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: 'accent' | 'danger' | 'warning' | 'info' | 'default';
  children?: ReactNode;
}

export function StatCard({ label, value, accent = 'accent', children }: StatCardProps) {
  const borderColors = {
    accent: 'border-accent',
    danger: 'border-danger',
    warning: 'border-warning',
    info: 'border-info',
    default: 'border-border',
  };

  return (
    <div className={`border-l-2 ${borderColors[accent]} bg-surface border border-border border-l-2 p-4`}>
      <div className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-1">{label}</div>
      <div className="font-mono text-2xl text-text tracking-tight">{value}</div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'border-border text-text-muted',
  success: 'border-accent/30 text-accent bg-accent-bg',
  warning: 'border-warning/30 text-warning bg-warning/10',
  danger: 'border-danger/30 text-danger bg-danger/10',
  info: 'border-info/30 text-info bg-info/10',
  accent: 'border-accent/30 text-accent bg-accent-bg',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${badgeVariants[variant]}`}>
      {children}
    </span>
  );
}

// ── DataTable ──────────────────────────────────────────────────────

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({ columns, data, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="data-grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={item.id as string || i}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'cursor-pointer hover:bg-surface-2 transition-colors' : ''}
            >
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ProgressBar ────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'accent' | 'danger' | 'warning' | 'info';
  label?: string;
}

export function ProgressBar({ value, variant = 'accent', label }: ProgressBarProps) {
  const colors = {
    accent: 'bg-accent',
    danger: 'bg-danger',
    warning: 'bg-warning',
    info: 'bg-info',
  };

  return (
    <div className="flex items-center gap-3">
      {label && <span className="font-mono text-[10px] text-text-muted w-16 shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-surface-3">
        <div
          className={`h-full transition-all duration-500 ${colors[variant]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-text-muted w-8 text-right">{value}%</span>
    </div>
  );
}
