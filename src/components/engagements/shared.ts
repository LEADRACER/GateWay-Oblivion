export function formatTime(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
}

export function stateColor(state: string): string {
  switch (state) {
    case 'active': return 'var(--color-accent)';
    case 'authorized': return 'var(--color-info)';
    case 'paused': return 'var(--color-warning)';
    case 'aborted': return 'var(--color-danger)';
    case 'completed': return 'var(--color-text-muted)';
    case 'cancelled': return 'var(--color-text-dim)';
    default: return 'var(--color-text-dim)';
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--color-sev-critical)';
    case 'high': return 'var(--color-sev-high)';
    case 'medium': return 'var(--color-sev-medium)';
    case 'low': return 'var(--color-sev-low)';
    default: return 'var(--color-sev-info)';
  }
}
