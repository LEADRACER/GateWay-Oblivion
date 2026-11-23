export function formatTime(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
}

export function stateColor(state: string): string {
  switch (state) {
    case 'active': return '#5ee28a';
    case 'authorized': return '#60a5fa';
    case 'paused': return '#fbbf24';
    case 'aborted': return '#f87171';
    case 'completed': return '#a78bfa';
    case 'cancelled': return '#6b7280';
    default: return '#6b6e74';
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#f87171';
    case 'high': return '#fbbf24';
    case 'medium': return '#60a5fa';
    case 'low': return '#5ee28a';
    default: return '#6b6e74';
  }
}
