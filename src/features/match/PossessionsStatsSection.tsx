import { useMemo } from 'react';
import type { MatchSessionRecord } from '@/domain/match';
import { formatClock } from '@/domain/matchClock';
import type { MatchEventRecord } from '@/domain/matchEvent';
import {
  computePossessionStats,
  possessionReasonLabel,
  type PossessionSegment,
} from '@/domain/possessions';
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
    desc: 'Opponent attack spells from receiving the ball through their conversion or a turnover.',
  },
  {
    abbr: 'Receive lost',
    full: 'Restart receive lost',
    desc: 'When you log Restart (Receiving kick) as L, that counts as a brief our possession ending in a giveaway before opponent ball.',
  },
  {
    abbr: 'Passes / poss',
    full: 'Passes per possession',
    desc: 'Average passes logged during each completed possession spell (attack passes for us; Defense-tab opp passes for them).',
  },
];

const STAT_KEY = 'possessions:segments';

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SegmentRow({ seg, index }: { seg: PossessionSegment; index: number }) {
  const durationMs = Math.max(0, seg.endMs - seg.startMs);
  return (
    <li className="live-stats-expand-row possessions-segment-row">
      <span className="live-stats-expand-time tabular-nums">
        #{index + 1} · P{seg.period}{' '}
        <span className="possessions-segment-range">
          {formatClock(seg.startMs)} → {formatClock(seg.endMs)}
        </span>
        <span className="possessions-segment-duration muted"> ({formatDuration(durationMs)})</span>
      </span>
      <span className="live-stats-expand-label">
        <span className={`possessions-segment-side possessions-segment-side--${seg.side}`}>
          {seg.side === 'us' ? 'Attack' : 'Opposition'}
        </span>
      </span>
      <span className="possessions-segment-reasons muted">
        Started: {possessionReasonLabel(seg.startReason)} · Ended: {possessionReasonLabel(seg.endReason)}
      </span>
    </li>
  );
}

function SegmentGroup({
  title,
  segments,
  offset,
}: {
  title: string;
  segments: PossessionSegment[];
  offset: number;
}) {
  if (segments.length === 0) return null;
  return (
    <div className="possessions-segment-group">
      <h4 className="possessions-segment-group-title">{title}</h4>
      <ul className="live-stats-expand-list">
        {segments.map((seg, i) => (
          <SegmentRow key={`${seg.side}-${seg.startMs}-${i}`} seg={seg} index={offset + i} />
        ))}
      </ul>
    </div>
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
  const usSegments = stats.segments.filter((s) => s.side === 'us');
  const oppSegments = stats.segments.filter((s) => s.side === 'opp');

  return (
    <section className={`card tgs-card possessions-card${open ? ' possessions-card--open' : ''}`}>
      <div className="tgs-card-title-row">
        <h3 className="tgs-card-title">Possessions</h3>
        <SectionHelp title="Possessions" entries={POSSESSIONS_GLOSSARY} />
      </div>
      <p className="muted tgs-card-lead">
        Attack phases per team — tap the counts to see when each possession started and ended.
      </p>
      <div className="team-global-kpi-row possessions-kpi-row">
        <button
          type="button"
          className={`team-global-kpi possessions-kpi-btn${open ? ' possessions-kpi-btn--open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(STAT_KEY)}
        >
          <span className="team-global-kpi-label">Us</span>
          <span className="team-global-kpi-value tabular-nums">{stats.us}</span>
          {stats.passesPerPossessionUs != null ? (
            <span className="team-global-kpi-sub muted">{stats.passesPerPossessionUs} passes / poss</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`team-global-kpi possessions-kpi-btn${open ? ' possessions-kpi-btn--open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(STAT_KEY)}
        >
          <span className="team-global-kpi-label">Opp</span>
          <span className="team-global-kpi-value tabular-nums">{stats.opp}</span>
          {stats.passesPerPossessionOpp != null ? (
            <span className="team-global-kpi-sub muted">{stats.passesPerPossessionOpp} opp passes / poss</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`team-global-kpi possessions-kpi-btn${open ? ' possessions-kpi-btn--open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(STAT_KEY)}
        >
          <span className="team-global-kpi-label">Total</span>
          <span className="team-global-kpi-value tabular-nums">{stats.total}</span>
          <span className="team-global-kpi-sub muted">
            {stats.us} us · {stats.opp} opp
          </span>
        </button>
      </div>
      {stats.total === 0 ? (
        <p className="muted possessions-empty-hint">
          No possessions inferred yet. Log restarts (W/L), passes, tries with conversions, turnovers, or set pieces.
        </p>
      ) : null}
      {open && stats.total > 0 ? (
        <div id={panelId} className="possessions-expand-body" role="region" aria-label="Possession segments">
          <SegmentGroup title={`Attack (${usSegments.length})`} segments={usSegments} offset={0} />
          <SegmentGroup
            title={`Opposition (${oppSegments.length})`}
            segments={oppSegments}
            offset={usSegments.length}
          />
        </div>
      ) : null}
    </section>
  );
}
