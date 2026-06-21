import { useMemo } from 'react';
import type { MatchSessionRecord } from '@/domain/match';
import { formatClock } from '@/domain/matchClock';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { computePossessionStats, type PossessionSegment } from '@/domain/possessions';
import { SectionHelp, type GlossaryEntry } from '@/components/SectionHelp';

const POSSESSIONS_GLOSSARY: GlossaryEntry[] = [
  {
    abbr: 'Us',
    full: 'Our possessions',
    desc: 'Attack spells from gaining the ball (restart won, steal, penalty) through conversion, turnover, or set-piece lost.',
  },
  {
    abbr: 'Opp',
    full: 'Opponent possessions',
    desc: 'Inferred from opp tries/conversions, opp passes logged, and restart/set-piece outcomes against us.',
  },
  {
    abbr: 'Total',
    full: 'Total possessions',
    desc: 'Combined attack possessions for both teams. Ends after conversion (not at try alone), knock-on, penalty conceded, or set-piece lost.',
  },
  {
    abbr: 'Passes / poss',
    full: 'Passes per possession',
    desc: 'Average passes logged during each completed possession spell (attack passes for us; Defense-tab opp passes for them).',
  },
];

const STAT_KEY = 'possessions:segments';

function formatEndReason(reason: string): string {
  const labels: Record<string, string> = {
    conversion: 'Conversion',
    opponent_conversion: 'Opp conversion',
    forced_turnover: 'Forced turnover',
    penalty_conceded: 'Penalty conceded',
    penalty_awarded: 'Penalty awarded',
    turnover_negative: 'Turnover',
    set_piece_lost: 'Set piece lost',
    set_piece_won: 'Set piece won',
    restart: 'Restart',
    score_before_restart: 'Try before restart',
    open_at_end: 'Open at end of log',
  };
  return labels[reason] ?? reason.replace(/_/g, ' ');
}

function SegmentRow({ seg, index }: { seg: PossessionSegment; index: number }) {
  return (
    <li className="live-stats-expand-row possessions-segment-row">
      <span className="live-stats-expand-time tabular-nums">
        #{index + 1} · P{seg.period} {formatClock(seg.startMs)}–{formatClock(seg.endMs)}
      </span>
      <span className="live-stats-expand-label">
        <span className={`possessions-segment-side possessions-segment-side--${seg.side}`}>
          {seg.side === 'us' ? 'Us' : 'Opp'}
        </span>
        {' · '}
        {formatEndReason(seg.endReason)}
      </span>
    </li>
  );
}

type Props = {
  events: MatchEventRecord[];
  filmSession?: MatchSessionRecord | null;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  idPrefix: string;
};

export function PossessionsStatsSection({
  events,
  expandedKey,
  onToggle,
  idPrefix,
}: Props) {
  const stats = useMemo(() => computePossessionStats(events), [events]);
  const open = expandedKey === STAT_KEY;
  const panelId = `${idPrefix}-possessions-segments`;

  return (
    <section className="card tgs-card">
      <div className="tgs-card-title-row">
        <h3 className="tgs-card-title">Possessions</h3>
        <SectionHelp title="Possessions" entries={POSSESSIONS_GLOSSARY} />
      </div>
      <p className="muted tgs-card-lead">
        Attack phases per team — from gaining the ball through conversion or turnover.
      </p>
      <div className="team-global-kpi-row">
        <div className="team-global-kpi">
          <span className="team-global-kpi-label">Us</span>
          <span className="team-global-kpi-value tabular-nums">{stats.us}</span>
          {stats.passesPerPossessionUs != null ? (
            <span className="team-global-kpi-sub muted">{stats.passesPerPossessionUs} passes / poss</span>
          ) : null}
        </div>
        <div className="team-global-kpi">
          <span className="team-global-kpi-label">Opp</span>
          <span className="team-global-kpi-value tabular-nums">{stats.opp}</span>
          {stats.passesPerPossessionOpp != null ? (
            <span className="team-global-kpi-sub muted">{stats.passesPerPossessionOpp} opp passes / poss</span>
          ) : null}
        </div>
        <div className="team-global-kpi">
          <span className="team-global-kpi-label">Total</span>
          <span className="team-global-kpi-value tabular-nums">{stats.total}</span>
          <span className="team-global-kpi-sub muted">
            {stats.us} us · {stats.opp} opp
          </span>
        </div>
      </div>
      {stats.total === 0 ? (
        <p className="muted possessions-empty-hint">
          No possessions inferred yet. Log restarts (W/L), passes, tries with conversions, turnovers, or set pieces.
        </p>
      ) : (
        <div className={`possessions-expand-wrap${open ? ' possessions-expand-wrap--open' : ''}`}>
          <button
            type="button"
            className="btn btn-secondary btn-sm possessions-expand-btn"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => onToggle(STAT_KEY)}
          >
            {open ? 'Hide possession list' : 'Show possession list'}
          </button>
          {open ? (
            <div id={panelId} className="possessions-expand-body" role="region" aria-label="Possession segments">
              <ul className="live-stats-expand-list">
                {stats.segments.map((seg, i) => (
                  <SegmentRow key={`${seg.side}-${seg.startMs}-${i}`} seg={seg} index={i} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
