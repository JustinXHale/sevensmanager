import type { MatchTimeBreakdown, PhaseTimeSplit } from '@/domain/matchAnalyticsDeep';

function fmtMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtPct(v: number | null): string {
  return v != null ? `${v}%` : '—';
}

type Props = {
  breakdown: MatchTimeBreakdown;
  phaseTime?: PhaseTimeSplit | null;
  pooled?: boolean;
};

export function MatchTimeBreakdownTable({ breakdown, phaseTime, pooled = false }: Props) {
  const { halves, totals } = breakdown;

  return (
    <div className="tgs-time-breakdown">
      {phaseTime ? (
        <>
          <div className="tgs-phase-bar-wrap">
            <div className="tgs-phase-bar">
              <div className="tgs-phase-seg tgs-phase-seg--off" style={{ flex: phaseTime.offenseMs }} />
              <div className="tgs-phase-seg tgs-phase-seg--def" style={{ flex: phaseTime.defenseMs }} />
            </div>
          </div>
          <div className="tgs-phase-legend">
            <div className="tgs-phase-stat">
              <span className="tgs-phase-dot tgs-phase-dot--off" />
              <span className="tgs-phase-label">Offense</span>
              <span className="tgs-phase-value tabular-nums">{phaseTime.offensePct}%</span>
              <span className="tgs-phase-time muted tabular-nums">{fmtMs(phaseTime.offenseMs)}</span>
            </div>
            <div className="tgs-phase-stat">
              <span className="tgs-phase-dot tgs-phase-dot--def" />
              <span className="tgs-phase-label">Defense</span>
              <span className="tgs-phase-value tabular-nums">{phaseTime.defensePct}%</span>
              <span className="tgs-phase-time muted tabular-nums">{fmtMs(phaseTime.defenseMs)}</span>
            </div>
          </div>
        </>
      ) : null}

      <div className="tgs-time-table-wrap" role="region" aria-label="Time by half">
        <table className="tgs-time-table">
          <thead>
            <tr>
              <th scope="col">Half</th>
              <th scope="col" className="num">
                Clock
              </th>
              <th scope="col" className="num">
                Ball in play
              </th>
              <th scope="col" className="num">
                BIP %
              </th>
              <th scope="col" className="num">
                Dead time
              </th>
              <th scope="col" className="num">
                Stoppage
              </th>
            </tr>
          </thead>
          <tbody>
            {halves.map((h) => (
              <tr key={h.period}>
                <td>{h.label}</td>
                <td className="num tabular-nums">{h.clockMs != null ? fmtMs(h.clockMs) : '—'}</td>
                <td className="num tabular-nums">{h.ballInPlayMs > 0 ? fmtMs(h.ballInPlayMs) : '—'}</td>
                <td className="num tabular-nums">{fmtPct(h.ballInPlayPct)}</td>
                <td className="num tabular-nums">{h.deadTimeMs > 0 ? fmtMs(h.deadTimeMs) : '—'}</td>
                <td className="num tabular-nums">{h.stoppageMs != null ? fmtMs(h.stoppageMs) : '—'}</td>
              </tr>
            ))}
            {halves.length > 1 ? (
              <tr className="tgs-time-table-total">
                <td>Total</td>
                <td className="num tabular-nums">
                  {totals.clockMs != null ? fmtMs(totals.clockMs) : '—'}
                </td>
                <td className="num tabular-nums">
                  {totals.ballInPlayMs > 0 ? fmtMs(totals.ballInPlayMs) : '—'}
                </td>
                <td className="num tabular-nums">{fmtPct(totals.ballInPlayPct)}</td>
                <td className="num tabular-nums">
                  {totals.deadTimeMs > 0 ? fmtMs(totals.deadTimeMs) : '—'}
                </td>
                <td className="num tabular-nums">
                  {totals.stoppageMs != null ? fmtMs(totals.stoppageMs) : '—'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="muted tgs-card-sub mt-xs">
        Clock from match timer{pooled ? ' (summed across selected matches)' : ''}
        {halves.some((h) => h.clockSource === 'event_span') ? '; falls back to last logged event when clock unavailable' : ''}
        . Ball in play = gaps between logged events classified as offense or defense; dead time excludes try→conversion and conversion→restart; stoppage = clock − ball in play − dead time (halftime, penalties, gaps &gt; 90s, time before/after events).
      </p>
    </div>
  );
}
