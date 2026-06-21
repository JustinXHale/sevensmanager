import { useMemo } from 'react';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { formatClock } from '@/domain/matchClock';
import {
  aggregatePossessionStats,
  computePossessionStats,
  formatPossessionDuration,
  isInstantGiveawayPossession,
  possessionDurationMs,
  possessionReasonLabel,
  type PossessionSegment,
  type PossessionSideMetrics,
  type PossessionStats,
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
    abbr: 'All',
    full: 'All possessions',
    desc: 'Mean and median match-clock duration across every possession, including instant failed receives (0:00).',
  },
  {
    abbr: 'With ball',
    full: 'With ball',
    desc: 'Excludes instant giveaways (restart receive lost and 0:00 duration). Answers: once we retain the ball, how long do we hold it and how many passes do we log?',
  },
  {
    abbr: 'Giveaways',
    full: 'Instant giveaways',
    desc: 'Failed restart receives and same-timestamp possessions — counted in totals but excluded from the With ball row.',
  },
  {
    abbr: 'Passes / poss',
    full: 'Passes per possession',
    desc: 'Average passes logged per possession spell (attack passes for us; Defense-tab opp passes for them).',
  },
];

export const POSSESSIONS_EXPAND_KEY = 'possessions:segments';

const EMPTY_METRICS: PossessionSideMetrics = {
  count: 0,
  giveawayCount: 0,
  avgDurationMs: null,
  medianDurationMs: null,
  passesPerPossession: null,
  retainedCount: 0,
  avgRetainedDurationMs: null,
  medianRetainedDurationMs: null,
  passesPerRetainedPossession: null,
};

const EMPTY_POSSESSION_STATS: PossessionStats = {
  us: 0,
  opp: 0,
  total: 0,
  segments: [],
  passesPerPossessionUs: null,
  passesPerPossessionOpp: null,
  usMetrics: EMPTY_METRICS,
  oppMetrics: EMPTY_METRICS,
};

function formatDuration(ms: number): string {
  return formatPossessionDuration(ms) === '—' ? '0:00' : formatPossessionDuration(ms)!;
}

function SegmentRow({
  seg,
  index,
  matchLabel,
}: {
  seg: PossessionSegment;
  index: number;
  matchLabel?: string;
}) {
  const durationMs = possessionDurationMs(seg);
  const giveaway = isInstantGiveawayPossession(seg);
  return (
    <li className={`live-stats-expand-row possessions-segment-row${giveaway ? ' possessions-segment-row--giveaway' : ''}`}>
      <span className="live-stats-expand-time tabular-nums">
        #{index + 1} · P{seg.period}{' '}
        <span className="possessions-segment-range">
          {formatClock(seg.startMs)} → {formatClock(seg.endMs)}
        </span>
        <span className="possessions-segment-duration muted"> ({formatDuration(durationMs)})</span>
        {giveaway ? <span className="possessions-giveaway-badge">Giveaway</span> : null}
        {seg.passCount > 0 ? (
          <span className="possessions-pass-badge muted">{seg.passCount} pass{seg.passCount === 1 ? '' : 'es'}</span>
        ) : null}
      </span>
      {matchLabel ? (
        <span className="live-stats-expand-match possessions-segment-match">{matchLabel}</span>
      ) : null}
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
  matchLabelsByMatchId,
}: {
  title: string;
  segments: PossessionSegment[];
  offset: number;
  matchLabelsByMatchId?: Map<string, string>;
}) {
  if (segments.length === 0) return null;
  const showMatch = (matchLabelsByMatchId?.size ?? 0) > 0;
  return (
    <div className="possessions-segment-group">
      <h4 className="possessions-segment-group-title">{title}</h4>
      <ul className="live-stats-expand-list">
        {segments.map((seg, i) => (
          <SegmentRow
            key={`${seg.matchId ?? 'm'}-${seg.side}-${seg.startMs}-${i}`}
            seg={seg}
            index={offset + i}
            matchLabel={
              showMatch && seg.matchId ? matchLabelsByMatchId?.get(seg.matchId) : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}

function TimeMetricsRow({
  label,
  metrics,
  oppLabel = 'opp passes / poss',
}: {
  label: string;
  metrics: PossessionSideMetrics;
  oppLabel?: string;
}) {
  const passLabel = label === 'Opposition' ? oppLabel : 'passes / poss';
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="tabular-nums">
        {metrics.count === 0 ? (
          '—'
        ) : (
          <>
            avg {formatPossessionDuration(metrics.avgDurationMs)} · med{' '}
            {formatPossessionDuration(metrics.medianDurationMs)}
            {metrics.passesPerPossession != null ? (
              <span className="possessions-time-pass muted">
                {' '}
                · {metrics.passesPerPossession} {passLabel}
              </span>
            ) : null}
            {metrics.giveawayCount > 0 ? (
              <span className="possessions-time-giveaway muted"> · {metrics.giveawayCount} giveaway</span>
            ) : null}
          </>
        )}
      </td>
      <td className="tabular-nums">
        {metrics.retainedCount === 0 ? (
          '—'
        ) : (
          <>
            avg {formatPossessionDuration(metrics.avgRetainedDurationMs)} · med{' '}
            {formatPossessionDuration(metrics.medianRetainedDurationMs)}
            {metrics.passesPerRetainedPossession != null ? (
              <span className="possessions-time-pass muted">
                {' '}
                · {metrics.passesPerRetainedPossession} {passLabel}
              </span>
            ) : null}
            <span className="possessions-time-retained muted"> · n={metrics.retainedCount}</span>
          </>
        )}
      </td>
    </tr>
  );
}

type Props = {
  events?: MatchEventRecord[];
  eventBatches?: MatchEventRecord[][];
  matchLabelsByMatchId?: Map<string, string>;
  pooled?: boolean;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  idPrefix: string;
};

export function PossessionsStatsSection({
  events = [],
  eventBatches,
  matchLabelsByMatchId,
  pooled = false,
  expandedKey,
  onToggle,
  idPrefix,
}: Props) {
  const stats = useMemo(() => {
    if (eventBatches?.length) return aggregatePossessionStats(eventBatches);
    if (events.length > 0) return computePossessionStats(events);
    return EMPTY_POSSESSION_STATS;
  }, [events, eventBatches]);

  const open = expandedKey === POSSESSIONS_EXPAND_KEY;
  const panelId = `${idPrefix}-possessions-segments`;
  const usSegments = stats.segments.filter((s) => s.side === 'us');
  const oppSegments = stats.segments.filter((s) => s.side === 'opp');
  const sigma = pooled ? ' (Σ)' : '';

  return (
    <section className={`card tgs-card possessions-card${open ? ' possessions-card--open' : ''}`}>
      <div className="tgs-card-title-row">
        <h3 className="tgs-card-title">Possessions</h3>
        <SectionHelp title="Possessions" entries={POSSESSIONS_GLOSSARY} />
      </div>
      <p className="muted tgs-card-lead">
        {pooled
          ? 'Pooled attack phases — tap counts for the possession list; duration uses match clock.'
          : 'Attack phases per team — tap counts for start/end times. With ball excludes instant failed receives.'}
      </p>
      <div className="team-global-kpi-row possessions-kpi-row">
        <button
          type="button"
          className={`team-global-kpi possessions-kpi-btn${open ? ' possessions-kpi-btn--open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(POSSESSIONS_EXPAND_KEY)}
        >
          <span className="team-global-kpi-label">Us{sigma}</span>
          <span className="team-global-kpi-value tabular-nums">{stats.us}</span>
          {stats.usMetrics.giveawayCount > 0 ? (
            <span className="team-global-kpi-sub muted">{stats.usMetrics.giveawayCount} giveaway</span>
          ) : stats.usMetrics.passesPerPossession != null ? (
            <span className="team-global-kpi-sub muted">{stats.usMetrics.passesPerPossession} passes / poss</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`team-global-kpi possessions-kpi-btn${open ? ' possessions-kpi-btn--open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(POSSESSIONS_EXPAND_KEY)}
        >
          <span className="team-global-kpi-label">Opp{sigma}</span>
          <span className="team-global-kpi-value tabular-nums">{stats.opp}</span>
          {stats.oppMetrics.passesPerPossession != null ? (
            <span className="team-global-kpi-sub muted">{stats.oppMetrics.passesPerPossession} opp passes / poss</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`team-global-kpi possessions-kpi-btn${open ? ' possessions-kpi-btn--open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(POSSESSIONS_EXPAND_KEY)}
        >
          <span className="team-global-kpi-label">Total{sigma}</span>
          <span className="team-global-kpi-value tabular-nums">{stats.total}</span>
          <span className="team-global-kpi-sub muted">
            {stats.us} us · {stats.opp} opp
          </span>
        </button>
      </div>

      {stats.total > 0 ? (
        <div className="possessions-time-table-wrap">
          <table className="possessions-time-table">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">All possessions</th>
                <th scope="col">With ball</th>
              </tr>
            </thead>
            <tbody>
              <TimeMetricsRow label="Attack" metrics={stats.usMetrics} />
              <TimeMetricsRow label="Opposition" metrics={stats.oppMetrics} oppLabel="opp passes / poss" />
            </tbody>
          </table>
        </div>
      ) : null}

      {stats.total === 0 ? (
        <p className="muted possessions-empty-hint">
          No possessions inferred yet. Log restarts (W/L), passes, tries with conversions, turnovers, or set pieces.
        </p>
      ) : null}
      {open && stats.total > 0 ? (
        <div id={panelId} className="possessions-expand-body" role="region" aria-label="Possession segments">
          <SegmentGroup
            title={`Attack (${usSegments.length})`}
            segments={usSegments}
            offset={0}
            matchLabelsByMatchId={matchLabelsByMatchId}
          />
          <SegmentGroup
            title={`Opposition (${oppSegments.length})`}
            segments={oppSegments}
            offset={usSegments.length}
            matchLabelsByMatchId={matchLabelsByMatchId}
          />
        </div>
      ) : null}
    </section>
  );
}
