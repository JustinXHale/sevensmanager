import type { MatchAnalyticsSnapshot, SetPieceSplit } from '@/domain/matchAnalytics';
import { kickDecidedSuccessPct } from '@/domain/matchAnalytics';

type Props = {
  snapshot: MatchAnalyticsSnapshot;
};

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="live-analytics-kpi">
      <span className="live-analytics-kpi-label">{label}</span>
      <span className="live-analytics-kpi-value">{value}</span>
      {sub ? <span className="live-analytics-kpi-sub muted">{sub}</span> : null}
    </div>
  );
}

function SetPieceRow({ title, split }: { title: string; split: SetPieceSplit }) {
  const n = split.won + split.lost + split.penalized;
  return (
    <div className="live-analytics-setpiece-row">
      <div className="live-analytics-setpiece-top">
        <span className="live-analytics-setpiece-name">{title}</span>
        {n === 0 ? (
          <span className="live-analytics-setpiece-empty muted">—</span>
        ) : (
          <span className="live-analytics-setpiece-nums tabular-nums">
            W {split.won} · L {split.lost} · Pen {split.penalized}
          </span>
        )}
      </div>
      {n > 0 ? (
        <div
          className="live-analytics-setpiece-bar"
          role="img"
          aria-label={`${title}: ${split.won} won, ${split.lost} lost, ${split.penalized} penalized`}
        >
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--won" style={{ flex: Math.max(0, split.won) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--lost" style={{ flex: Math.max(0, split.lost) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--pen" style={{ flex: Math.max(0, split.penalized) }} />
        </div>
      ) : null}
    </div>
  );
}

export function MatchAnalyticsOverview({ snapshot: s }: Props) {
  const ownKickPct = kickDecidedSuccessPct(s.ownKick.made, s.ownKick.missed);
  const oppKickPct = kickDecidedSuccessPct(s.oppKick.made, s.oppKick.missed);
  const tt = s.tackles.made + s.tackles.missed;
  const tacklePct = tt > 0 ? Math.round((s.tackles.made / tt) * 1000) / 10 : null;

  return (
    <div className="live-analytics-overview" aria-label="Match analytics summary">
      <div className="live-analytics-kpi-row">
        <Kpi
          label="Points (logged)"
          value={`${s.ownPoints} – ${s.oppPoints}`}
          sub={s.ownPoints !== s.oppPoints ? `Δ ${s.ownPoints - s.oppPoints > 0 ? '+' : ''}${s.ownPoints - s.oppPoints}` : 'Level'}
        />
        <Kpi label="Tries" value={`${s.ownTries} – ${s.oppTries}`} />
        <Kpi
          label="Conv. kick %"
          value={
            ownKickPct != null && oppKickPct != null
              ? `${ownKickPct}% / ${oppKickPct}%`
              : ownKickPct != null
                ? `${ownKickPct}% / —`
                : oppKickPct != null
                  ? `— / ${oppKickPct}%`
                  : '—'
          }
          sub="Us / Opp (made÷(made+missed))"
        />
        <Kpi
          label="Tackle %"
          value={tacklePct != null ? `${tacklePct}%` : '—'}
          sub={tt > 0 ? `${s.tackles.made}M · ${s.tackles.missed}X` : 'No tackles logged'}
        />
      </div>

      <div className="live-analytics-compare" aria-label="Subs and discipline comparison">
        <div className="live-analytics-compare-row">
          <span className="live-analytics-compare-label">Subs</span>
          <CompareBar left={s.subsOurs} right={s.subsOpp} leftLabel="Us" rightLabel="Opp" />
        </div>
        <div className="live-analytics-compare-row">
          <span className="live-analytics-compare-label">YC</span>
          <CompareBar left={s.cardsOurs.yc} right={s.cardsOpp.yc} leftLabel="Us" rightLabel="Opp" tone="yc" />
        </div>
        <div className="live-analytics-compare-row">
          <span className="live-analytics-compare-label">RC</span>
          <CompareBar left={s.cardsOurs.rc} right={s.cardsOpp.rc} leftLabel="Us" rightLabel="Opp" tone="rc" />
        </div>
      </div>

      <div className="live-analytics-setpiece" aria-label="Set piece outcomes">
        <h3 className="live-analytics-setpiece-heading">Set pieces</h3>
        <p className="muted live-analytics-setpiece-lead">Won / lost / penalized (from restart chips).</p>
        <SetPieceRow title="Scrums" split={s.scrums} />
        <SetPieceRow title="Lineouts" split={s.lineouts} />
        <SetPieceRow title="Rucks" split={s.rucks} />
      </div>
    </div>
  );
}

function CompareBar({
  left,
  right,
  leftLabel,
  rightLabel,
  tone = 'default',
}: {
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
  tone?: 'default' | 'yc' | 'rc';
}) {
  const max = Math.max(1, left, right);
  const lw = Math.round((left / max) * 100);
  const rw = Math.round((right / max) * 100);
  const toneClass = tone === 'yc' ? 'live-analytics-cmp--yc' : tone === 'rc' ? 'live-analytics-cmp--rc' : '';
  return (
    <div className={`live-analytics-cmp ${toneClass}`}>
      <div className="live-analytics-cmp-side">
        <span className="live-analytics-cmp-num tabular-nums">{left}</span>
        <div className="live-analytics-cmp-track" aria-hidden>
          <div className="live-analytics-cmp-fill live-analytics-cmp-fill--left" style={{ width: `${lw}%` }} />
        </div>
        <span className="live-analytics-cmp-tag">{leftLabel}</span>
      </div>
      <div className="live-analytics-cmp-side live-analytics-cmp-side--right">
        <span className="live-analytics-cmp-num tabular-nums">{right}</span>
        <div className="live-analytics-cmp-track" aria-hidden>
          <div className="live-analytics-cmp-fill live-analytics-cmp-fill--right" style={{ width: `${rw}%` }} />
        </div>
        <span className="live-analytics-cmp-tag">{rightLabel}</span>
      </div>
    </div>
  );
}
