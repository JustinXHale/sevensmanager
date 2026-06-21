import type { MatchEventRecord } from '@/domain/matchEvent';
import { resolvePenaltyDirection } from '@/domain/matchEvent';
import { isOurPassEvent, sortMatchEventsByTime } from '@/domain/matchStats';

export type PossessionSide = 'us' | 'opp';

export type PossessionSegment = {
  side: PossessionSide;
  startMs: number;
  endMs: number;
  period: number;
  startReason: string;
  endReason: string;
  eventCount: number;
  /** Passes logged during this possession spell. */
  passCount: number;
  matchId?: string;
};

export type PossessionSideMetrics = {
  count: number;
  /** Instant failed receives / same-timestamp possessions (excluded from "with ball" row). */
  giveawayCount: number;
  avgDurationMs: number | null;
  medianDurationMs: number | null;
  passesPerPossession: number | null;
  retainedCount: number;
  avgRetainedDurationMs: number | null;
  medianRetainedDurationMs: number | null;
  passesPerRetainedPossession: number | null;
};

export type PossessionStats = {
  us: number;
  opp: number;
  total: number;
  segments: PossessionSegment[];
  /** @deprecated Prefer `usMetrics.passesPerPossession`. */
  passesPerPossessionUs: number | null;
  /** @deprecated Prefer `oppMetrics.passesPerPossession`. */
  passesPerPossessionOpp: number | null;
  usMetrics: PossessionSideMetrics;
  oppMetrics: PossessionSideMetrics;
};

const SET_PIECE_KINDS = new Set<MatchEventRecord['kind']>(['scrum', 'lineout', 'ruck', 'restart']);

/** Match-clock length of a completed possession spell. */
export function possessionDurationMs(seg: PossessionSegment): number {
  return Math.max(0, seg.endMs - seg.startMs);
}

/**
 * Instant giveaways — e.g. restart receive lost at 0:00. Excluded from "with ball" duration stats.
 */
export function isInstantGiveawayPossession(seg: PossessionSegment): boolean {
  return seg.endReason === 'restart_receive_lost' || possessionDurationMs(seg) === 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function medianMs(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function meanMs(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function computeSideMetrics(segments: PossessionSegment[], side: PossessionSide): PossessionSideMetrics {
  const sideSegs = segments.filter((s) => s.side === side);
  const count = sideSegs.length;
  const durations = sideSegs.map(possessionDurationMs);
  const totalPasses = sideSegs.reduce((n, s) => n + s.passCount, 0);
  const giveaways = sideSegs.filter(isInstantGiveawayPossession);
  const retained = sideSegs.filter((s) => !isInstantGiveawayPossession(s));
  const retainedDurations = retained.map(possessionDurationMs);
  const retainedPasses = retained.reduce((n, s) => n + s.passCount, 0);

  return {
    count,
    giveawayCount: giveaways.length,
    avgDurationMs: meanMs(durations),
    medianDurationMs: medianMs(durations),
    passesPerPossession: count > 0 ? round1(totalPasses / count) : null,
    retainedCount: retained.length,
    avgRetainedDurationMs: meanMs(retainedDurations),
    medianRetainedDurationMs: medianMs(retainedDurations),
    passesPerRetainedPossession:
      retained.length > 0 ? round1(retainedPasses / retained.length) : null,
  };
}

function buildPossessionStats(segments: PossessionSegment[]): PossessionStats {
  const usMetrics = computeSideMetrics(segments, 'us');
  const oppMetrics = computeSideMetrics(segments, 'opp');
  return {
    us: usMetrics.count,
    opp: oppMetrics.count,
    total: segments.length,
    segments,
    passesPerPossessionUs: usMetrics.passesPerPossession,
    passesPerPossessionOpp: oppMetrics.passesPerPossession,
    usMetrics,
    oppMetrics,
  };
}

function isTurnoverNegative(e: MatchEventRecord): boolean {
  return e.kind === 'negative_action';
}

function setPieceOutcome(e: MatchEventRecord): 'won' | 'lost' | 'other' {
  if (!SET_PIECE_KINDS.has(e.kind)) return 'other';
  if (e.setPieceOutcome === 'won' || e.setPieceOutcome === 'lost') return e.setPieceOutcome;
  return 'other';
}

function inferHolderFromEvent(e: MatchEventRecord): PossessionSide | null {
  if (e.kind === 'forced_turnover') return 'us';
  if (isOurPassEvent(e) || e.kind === 'line_break' || e.kind === 'try') return 'us';
  if (e.kind === 'pass' && e.playPhaseContext === 'defense') return 'opp';
  if (e.kind === 'opponent_try') return 'opp';
  return null;
}

/**
 * Count attacking possessions per team from the event log.
 *
 * A possession runs from gaining the ball through open play until a turnover or
 * until the conversion after a try. Restart receive lost counts as a brief our
 * possession (giveaway) before opponent ball.
 */
export function computePossessionStats(events: MatchEventRecord[]): PossessionStats {
  const sorted = sortMatchEventsByTime(events).filter((e) => e.deletedAt == null);
  const segments: PossessionSegment[] = [];

  let holder: PossessionSide | null = null;
  let pendingScore: PossessionSide | null = null;
  let segStartMs = 0;
  let segPeriod = 1;
  let segStartReason = 'open_play';
  let segEvents = 0;
  let usPassesInSeg = 0;
  let oppPassesInSeg = 0;
  let segMatchId: string | undefined = sorted[0]?.matchId;

  const closePossession = (side: PossessionSide, endMs: number, reason: string) => {
    segments.push({
      side,
      startMs: segStartMs,
      endMs,
      period: segPeriod,
      startReason: segStartReason,
      endReason: reason,
      eventCount: segEvents,
      passCount: side === 'us' ? usPassesInSeg : oppPassesInSeg,
      matchId: segMatchId,
    });
    holder = null;
    pendingScore = null;
    segEvents = 0;
    usPassesInSeg = 0;
    oppPassesInSeg = 0;
  };

  const openPossession = (
    side: PossessionSide,
    ms: number,
    period: number,
    startReason: string,
    matchId?: string,
  ) => {
    holder = side;
    pendingScore = null;
    segStartMs = ms;
    segPeriod = period;
    segStartReason = startReason;
    segMatchId = matchId ?? segMatchId;
    segEvents = 0;
    usPassesInSeg = 0;
    oppPassesInSeg = 0;
  };

  const closePendingScore = (e: MatchEventRecord) => {
    if (pendingScore != null) {
      closePossession(pendingScore, e.matchTimeMs, 'score_before_restart');
    }
  };

  /** End the other side (if any) and open `side` unless we already hold the ball in open play. */
  const gainPossession = (side: PossessionSide, e: MatchEventRecord, startReason: string, closeReason: string) => {
    closePendingScore(e);
    if (holder === side && pendingScore == null) return;
    if (holder != null && holder !== side) {
      closePossession(holder, e.matchTimeMs, closeReason);
    }
    openPossession(side, e.matchTimeMs, e.period, startReason, e.matchId);
  };

  const handleRestart = (e: MatchEventRecord, outcome: 'won' | 'lost') => {
    closePendingScore(e);
    const phase = e.playPhaseContext ?? 'attack';

    if (phase === 'attack') {
      if (outcome === 'won') {
        gainPossession('us', e, 'restart_receive_won', 'restart');
        return;
      }
      // Receiving kick and losing it: our brief possession, then opponent ball.
      if (holder === 'opp') closePossession('opp', e.matchTimeMs, 'restart');
      if (holder !== 'us') openPossession('us', e.matchTimeMs, e.period, 'restart_receive', e.matchId);
      closePossession('us', e.matchTimeMs, 'restart_receive_lost');
      openPossession('opp', e.matchTimeMs, e.period, 'restart_receive_lost', e.matchId);
      return;
    }

    // Kicking off: opponent receives when we lose the contest on our kick.
    if (outcome === 'lost') {
      if (holder === 'us') closePossession('us', e.matchTimeMs, 'restart_kickoff');
      gainPossession('opp', e, 'restart_kickoff_received', 'restart');
      return;
    }
    if (holder === 'opp') closePossession('opp', e.matchTimeMs, 'restart');
    gainPossession('us', e, 'restart_kickoff_won', 'restart');
  };

  const sideHolding = (): PossessionSide | null => pendingScore ?? holder;

  for (const e of sorted) {
    segEvents += 1;

    if (isOurPassEvent(e)) usPassesInSeg += 1;
    if (e.kind === 'pass' && e.playPhaseContext === 'defense') oppPassesInSeg += 1;

    if (e.kind === 'try') {
      if (holder === 'us' || holder == null) {
        if (holder == null) openPossession('us', e.matchTimeMs, e.period, 'try', e.matchId);
        pendingScore = 'us';
      }
      continue;
    }

    if (e.kind === 'opponent_try') {
      if (holder !== 'us') {
        if (holder == null) openPossession('opp', e.matchTimeMs, e.period, 'opponent_try', e.matchId);
        pendingScore = 'opp';
      }
      continue;
    }

    if (e.kind === 'conversion') {
      if (pendingScore === 'us' || (pendingScore == null && holder === 'us')) {
        closePossession('us', e.matchTimeMs, 'conversion');
      }
      continue;
    }

    if (e.kind === 'opponent_conversion') {
      if (sideHolding() === 'opp') {
        closePossession('opp', e.matchTimeMs, 'opponent_conversion');
      }
      continue;
    }

    if (e.kind === 'forced_turnover') {
      gainPossession('us', e, 'forced_turnover', 'forced_turnover');
      continue;
    }

    if (e.kind === 'team_penalty') {
      const dir = resolvePenaltyDirection(e);
      const phase = e.playPhaseContext ?? 'attack';
      if (dir === 'conceded' && phase === 'attack') {
        if (holder === 'us' || pendingScore === 'us') closePossession('us', e.matchTimeMs, 'penalty_conceded');
        gainPossession('opp', e, 'penalty_conceded', 'penalty_conceded');
      } else if (dir === 'awarded' && phase === 'defense') {
        gainPossession('us', e, 'penalty_awarded', 'penalty_awarded');
      } else if (dir === 'conceded' && phase === 'defense') {
        if (sideHolding() === 'opp') {
          closePossession('opp', e.matchTimeMs, 'penalty_conceded');
        }
      }
      continue;
    }

    if (isTurnoverNegative(e)) {
      if (holder === 'us' || pendingScore === 'us') {
        closePossession('us', e.matchTimeMs, 'turnover_negative');
      } else if (holder === 'opp' || pendingScore === 'opp') {
        closePossession('opp', e.matchTimeMs, 'turnover_negative');
      }
      continue;
    }

    if (SET_PIECE_KINDS.has(e.kind)) {
      const outcome = setPieceOutcome(e);
      if (outcome === 'other') continue;

      if (e.kind === 'restart') {
        handleRestart(e, outcome);
        continue;
      }

      const phase = e.playPhaseContext;
      if (phase === 'attack' && outcome === 'lost') {
        if (holder === 'us' || pendingScore === 'us') closePossession('us', e.matchTimeMs, 'set_piece_lost');
        gainPossession('opp', e, 'set_piece_lost', 'set_piece_lost');
      } else if (phase === 'defense' && outcome === 'won') {
        gainPossession('us', e, 'set_piece_won', 'set_piece_won');
      } else if (phase === 'attack' && outcome === 'won') {
        gainPossession('us', e, 'set_piece_won', 'set_piece_won');
      } else if (phase === 'defense' && outcome === 'lost') {
        if (sideHolding() === 'opp') {
          closePossession('opp', e.matchTimeMs, 'set_piece_lost');
        } else if (holder == null && pendingScore == null) {
          openPossession('opp', e.matchTimeMs, e.period, 'set_piece_lost', e.matchId);
        }
      }
      continue;
    }

    if (holder == null && pendingScore == null) {
      const inferred = inferHolderFromEvent(e);
      if (inferred != null) openPossession(inferred, e.matchTimeMs, e.period, 'inferred', e.matchId);
    }
  }

  if (pendingScore != null) {
    const last = sorted[sorted.length - 1];
    closePossession(pendingScore, last?.matchTimeMs ?? segStartMs, 'open_at_end');
  } else if (holder != null) {
    const last = sorted[sorted.length - 1];
    closePossession(holder, last?.matchTimeMs ?? segStartMs, 'open_at_end');
  }

  return buildPossessionStats(segments);
}

export function aggregatePossessionStats(batches: MatchEventRecord[][]): PossessionStats {
  const segments: PossessionSegment[] = [];
  for (const batch of batches) {
    const s = computePossessionStats(batch);
    segments.push(...s.segments);
  }
  return buildPossessionStats(segments);
}

/** Human-readable labels for possession segment reasons (UI + export). */
export function possessionReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    conversion: 'Conversion',
    opponent_conversion: 'Opp conversion',
    forced_turnover: 'Forced turnover',
    penalty_conceded: 'Penalty conceded',
    penalty_awarded: 'Penalty awarded',
    turnover_negative: 'Turnover (knock-on / neg)',
    set_piece_lost: 'Set piece lost',
    set_piece_won: 'Set piece won',
    restart: 'Restart',
    restart_receive_won: 'Restart receive won',
    restart_receive: 'Restart receive',
    restart_receive_lost: 'Restart receive lost',
    restart_kickoff_received: 'Opp received kickoff',
    restart_kickoff_won: 'Kickoff retained',
    restart_kickoff: 'Kickoff',
    score_before_restart: 'Try (before restart)',
    open_at_end: 'Still in play at end of log',
    open_play: 'Open play',
    inferred: 'Inferred from event',
    try: 'Try scored',
    opponent_try: 'Opp try scored',
  };
  return labels[reason] ?? reason.replace(/_/g, ' ');
}

/** Format ms as m:ss for possession duration KPIs. */
export function formatPossessionDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
