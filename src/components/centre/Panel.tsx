'use client';

import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  accent = 'var(--color-accent)',
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-border bg-bg/60 p-4 relative min-w-0 ${className}`}
      style={{ boxShadow: `inset 0 2px 0 ${accent}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="font-mono text-[10px] tracking-[0.2em] uppercase truncate" style={{ color: accent }}>
            {title}
          </h2>
          {subtitle && (
            <p className="font-mono text-[8px] text-text-dim tracking-widest mt-0.5 uppercase truncate">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
