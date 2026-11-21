'use client';

// ── GateWay:Oblivion — OSINT Dashboard Page ───────────────────────

import {
  useIntelSummary,
  useOsint,
  useThreats,
} from '@/hooks/useIntelligence';
import { StatCard, Badge } from '@/components/ui/primitives';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-text-dim',
  low: 'text-info',
};

export default function OSINTPage() {
  const { data: overview } = useOsint();
  const { data: threats = [] } = useThreats();
  const { data: summary } = useIntelSummary();

  const sources = overview?.sources ?? [];
  const liveSources = sources.filter((s) => s.status === 'live').length;
  const criticalCount = threats.filter((t) => t.severity === 'critical').length;
  const riskScore = summary?.risk_score ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">OSINT</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Cross-source intelligence feeds · God&apos;s Eye View · threat intel · exposure intel
          </p>
        </div>
        <Badge variant={liveSources > 0 ? 'success' : 'danger'}>
          {liveSources}/{sources.length || 0} SOURCES LIVE
        </Badge>
      </div>

      {/* ── Stat cards ────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Risk Score"
          value={riskScore}
          accent={riskScore >= 7 ? 'danger' : riskScore >= 4 ? 'warning' : 'accent'}
        />
        <StatCard label="Threats" value={threats.length} accent="accent" />
        <StatCard label="Critical" value={criticalCount} accent="danger" />
        <StatCard label="Live Sources" value={`${liveSources}/${sources.length || 0}`} accent="info" />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* ── Live sources ───────────────────── */}
        <div>
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
            Live Intelligence Sources
          </h2>
          {sources.length === 0 ? (
            <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
              NO LIVE OSINT SOURCES — GOD&apos;S EYE VIEW OFFLINE OR NO ACTIONS REGISTERED
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sources.map((s) => (
                <div
                  key={s.source}
                  className="flex items-center justify-between p-3 border border-border bg-surface"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        s.status === 'live' ? 'bg-accent glow-accent' : 'bg-danger'
                      }`}
                    />
                    <span className="font-mono text-[10px] text-text-dim tracking-wide truncate">
                      {s.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[8px] tracking-widest text-text-dim uppercase">
                      {s.action}
                    </span>
                    <Badge variant={s.status === 'live' ? 'success' : 'danger'}>
                      {s.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Threat feed ────────────────────── */}
        <div>
          <h2 className="font-mono text-[10px] tracking-widest text-text-dim uppercase mb-3">
            Threat Feed
          </h2>
          {threats.length === 0 ? (
            <div className="p-4 border border-border bg-surface font-mono text-[10px] text-text-dim tracking-wide">
              NO THREATS — ALL SOURCES CLEAR
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
              {threats.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 p-3 border border-border bg-surface"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-text leading-snug">{t.title}</div>
                    <div className="font-mono text-[8px] text-text-dim mt-1 tracking-wide">
                      SRC: {t.source} · AFFECTED: {t.affected}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono text-[9px] tracking-wider ${SEVERITY_COLORS[t.severity] || 'text-text-dim'}`}
                    >
                      {t.severity.toUpperCase()}
                    </span>
                    <span className="font-mono text-[8px] tracking-widest text-text-dim uppercase">
                      {t.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
