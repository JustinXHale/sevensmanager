import type { InferredMatchStats } from '@/domain/inferredStats';

function fmtPct(v: number | null): string {
  return v != null ? `${v}%` : '—';
}

function fmtSec(ms: number | null): string {
  return ms != null ? `${(ms / 1000).toFixed(1)}s` : '—';
}

function fmtMin(ms: number | null): string {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type KpiProps = { label: string; value: string; sub?: string };

function Kpi({ label, value, sub }: KpiProps) {
  return (
    <div className="team-global-kpi inferred-kpi">
      <span className="team-global-kpi-label">{label}</span>
      <span className="team-global-kpi-value tabular-nums">{value}</span>
      {sub ? <span className="team-global-kpi-sub muted">{sub}</span> : null}
    </div>
  );
}

type Props = {
  stats: InferredMatchStats;
};

export function InferredStatsSection({ stats }: Props) {
  const rc = stats.ruckContest;
  const ruckTotal = rc.contested + rc.uncontested + rc.unknown;

  return (
    <div className="inferred-stats-grid">
      <h4 className="tgs-card-subtitle">Ball speed & retention</h4>
      <div className="team-global-kpi-row inferred-kpi-row">
        {ruckTotal > 0 && (
          <>
            <Kpi
              label="Ruck contested"
              value={`${rc.contested}`}
              sub={ruckTotal > 0 ? `${Math.round((rc.contested / ruckTotal) * 100)}% of rucks` : undefined}
            />
            <Kpi
              label="Con speed (median)"
              value={fmtSec(rc.contestedMedianMs)}
              sub={rc.contested > 0 ? `${rc.contested} pairs` : 'no pairs'}
            />
            <Kpi
              label="Unc speed (median)"
              value={fmtSec(rc.uncontestedMedianMs)}
              sub={rc.uncontested > 0 ? `${rc.uncontested} pairs` : 'no pairs'}
            />
            <Kpi label="Attack ruck won %" value={fmtPct(stats.attackRuckWonPct)} />
          </>
        )}
        <Kpi label="LB → try %" value={fmtPct(stats.lineBreakToTryPct)} />
        <Kpi
          label="Avg pass chain"
          value={stats.avgPassChainLength != null ? String(stats.avgPassChainLength) : '—'}
          sub={stats.maxPassChainLength > 0 ? `max ${stats.maxPassChainLength}` : undefined}
        />
      </div>

      <h4 className="tgs-card-subtitle">Structure & pressure</h4>
      <div className="team-global-kpi-row inferred-kpi-row">
        <Kpi
          label="System moments"
          value={String(stats.systemMoments)}
          sub={
            stats.systemMomentsPerOffenseMin != null
              ? `${stats.systemMomentsPerOffenseMin} / off min`
              : undefined
          }
        />
        <Kpi
          label="Opp passes"
          value={stats.oppPassesPerDefenseMin != null ? `${stats.oppPassesPerDefenseMin}/min` : '—'}
          sub="defense playing time"
        />
        <Kpi
          label="Possession swings"
          value={String(stats.possessionSwings)}
          sub={fmtPct(stats.possessionSwingPct) + ' of def ruck wins'}
        />
        <Kpi
          label="Restart receive won %"
          value={fmtPct(stats.attackRestartWonPct)}
          sub={stats.attackRestarts > 0 ? `${stats.attackRestarts} restarts` : undefined}
        />
      </div>

      <h4 className="tgs-card-subtitle">Discipline & momentum</h4>
      <div className="team-global-kpi-row inferred-kpi-row">
        <Kpi
          label="Turnover balance"
          value={String(stats.turnoverBalance)}
          sub={`+${stats.forcedTurnovers} FT −${stats.negatives} neg −${stats.penaltiesConceded} pen`}
        />
        <Kpi
          label="Pen net (attack)"
          value={stats.penaltyNetAttack >= 0 ? `+${stats.penaltyNetAttack}` : String(stats.penaltyNetAttack)}
        />
        <Kpi
          label="Pen net (defense)"
          value={stats.penaltyNetDefense >= 0 ? `+${stats.penaltyNetDefense}` : String(stats.penaltyNetDefense)}
        />
        <Kpi
          label="Error clusters"
          value={String(stats.errorClusters)}
          sub={stats.knockOns > 0 ? `${stats.errorClusters} / ${stats.knockOns} knock-ons` : undefined}
        />
        <Kpi label="Longest try drought" value={fmtMin(stats.longestTryDroughtMs)} />
        <Kpi label="Avg try gap" value={fmtMin(stats.avgTryGapMs)} />
        <Kpi label="Max pts / 2 min" value={String(stats.maxPointsIn2Min)} />
      </div>
    </div>
  );
}
