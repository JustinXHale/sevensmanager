import type { RuckBreakdownByPhase, RuckPhaseDetail } from '@/domain/inferredStats';

function fmtPct(v: number | null): string {
  return v != null ? `${v}%` : '—';
}

function fmtSec(ms: number | null): string {
  return ms != null ? `${(ms / 1000).toFixed(1)}s` : '—';
}

type RowProps = {
  label: string;
  detail: RuckPhaseDetail;
  phaseHint: string;
};

function PhaseTable({ label, detail, phaseHint }: RowProps) {
  if (detail.total === 0) return null;

  return (
    <div className="ruck-phase-block">
      <h4 className="tgs-card-subtitle">{label}</h4>
      <p className="muted tgs-card-sub">{phaseHint}</p>
      <div className="ruck-phase-table" role="table" aria-label={`${label} ruck breakdown`}>
        <div className="ruck-phase-row ruck-phase-row--head" role="row">
          <span role="columnheader" />
          <span className="tabular-nums" role="columnheader">Total</span>
          <span className="tabular-nums" role="columnheader">Con</span>
          <span className="tabular-nums" role="columnheader">Unc</span>
          <span className="tabular-nums" role="columnheader" title="Contest not logged">?</span>
          <span className="tabular-nums" role="columnheader">W</span>
          <span className="tabular-nums" role="columnheader">L</span>
          <span className="tabular-nums" role="columnheader">Won%</span>
          <span className="tabular-nums" role="columnheader">Con spd</span>
          <span className="tabular-nums" role="columnheader">Unc spd</span>
        </div>
        <div className="ruck-phase-row" role="row">
          <span className="ruck-phase-label" role="rowheader">Rucks</span>
          <span className="tabular-nums" role="cell">{detail.total}</span>
          <span className="tabular-nums" role="cell">{detail.contested}</span>
          <span className="tabular-nums" role="cell">{detail.uncontested}</span>
          <span className="tabular-nums muted" role="cell">{detail.unknownContest > 0 ? detail.unknownContest : '—'}</span>
          <span className="tabular-nums" role="cell">{detail.won}</span>
          <span className="tabular-nums" role="cell">{detail.lost}</span>
          <span className="tabular-nums" role="cell">{fmtPct(detail.wonPct)}</span>
          <span className="tabular-nums" role="cell">{fmtSec(detail.contestedMedianMs)}</span>
          <span className="tabular-nums" role="cell">{fmtSec(detail.uncontestedMedianMs)}</span>
        </div>
        {(detail.penalized > 0 || detail.freeKick > 0) && (
          <p className="muted ruck-phase-extra">
            {detail.penalized > 0 ? `${detail.penalized} penalized` : ''}
            {detail.penalized > 0 && detail.freeKick > 0 ? ' · ' : ''}
            {detail.freeKick > 0 ? `${detail.freeKick} FK` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

type Props = {
  breakdown: RuckBreakdownByPhase;
};

export function RuckPhaseBreakdownPanel({ breakdown }: Props) {
  const hasAttack = breakdown.attack.total > 0;
  const hasDefense = breakdown.defense.total > 0;
  if (!hasAttack && !hasDefense) return null;

  return (
    <div className="ruck-phase-breakdown">
      <PhaseTable
        label="Attack rucks"
        detail={breakdown.attack}
        phaseHint="Our ball — contested/uncontested and W/L from the set-piece strip in Attack."
      />
      <PhaseTable
        label="Defense rucks"
        detail={breakdown.defense}
        phaseHint="Breakdowns on defense — rucks logged in Defense tab (contest + W/L)."
      />
    </div>
  );
}
