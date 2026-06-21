import type { MatchEventRecord } from '@/domain/matchEvent';
import { resolvePenaltyDirection } from '@/domain/matchEvent';
import { isOurPassEvent, sortMatchEventsByTime } from '@/domain/matchStats';

export type PossessionSide = 'us' | 'opp';

export type PossessionSegment = {
  side: PossessionSide;
  startMs: number;
  endMs: number;
  period: number;
  endReason: string;
  eventCount: number;
};

export type PossessionStats = {
  us: number;
  opp: number;
  total: number;
  segments: PossessionSegment[];
  /** Our passes logged during our completed possessions. */
  passesPerPossessionUs: number | null;
  /** Opp passes logged during their completed possessions. */
  passesPerPossessionOpp: number | null;
};

const SET_PIECE_KINDS = new Set<MatchEventRecord['kind']>(['scrum', 'lineout', 'ruck', 'restart']);

function isTurnoverNegative(e: MatchEventRecord): boolean {
  return e.kind === 'negative_action';
}

function setPieceOutcome(e: MatchEventRecord): 'won' | 'lost' | 'other' {
  if (!SET_PIECE_KINDS.has(e.kind)) return 'other';
  if (e.setPieceOutcome === 'won' || e.setPieceOutcome === 'lost') return e.setPieceOutcome;
  return 'other';
}

function possessionFromSetPiece(e: MatchEventRecord): PossessionSide | null {
  const phase = e.playPhaseContext;
  const outcome = setPieceOutcome(e);
  if (outcome === 'other') return null;
  if (phase === 'attack') return outcome === 'won' ? 'us' : 'opp';
  return outcome === 'won' ? 'us' : 'opp';
}

function inferHolderFromEvent(e: MatchEventRecord): PossessionSide | null {
  if (e.kind === 'forced_turnover') return 'us';
  if (isOurPassEvent(e) || e.kind === 'line_break' || e.kind === 'try') return 'us';
  if (e.kind === 'pass' && e.playPhaseContext === 'defense') return 'opp';
  if (e.kind === 'opponent_try') return 'opp';
  if (e.kind === 'tackle') return 'opp';
  return null;
}

/**
 * Count attacking possessions per team from the event log.
 *
 * A possession runs from gaining the ball through open play (passes, rucks, etc.)
 * until a turnover or until the conversion after a try. The next possession begins
 * on restart won/lost (or other clear gain/loss events).
 */
export function computePossessionStats(events: MatchEventRecord[]): PossessionStats {
  const sorted = sortMatchEventsByTime(events).filter((e) => e.deletedAt == null);
  const segments: PossessionSegment[] = [];

  let holder: PossessionSide | null = null;
  let pendingScore: PossessionSide | null = null;
  let segStartMs = 0;
  let segPeriod = 1;
  let segEvents = 0;
  let usPassesInSeg = 0;
  let oppPassesInSeg = 0;
  let totalUsPasses = 0;
  let totalOppPasses = 0;

  const closePossession = (side: PossessionSide, endMs: number, reason: string) => {
    segments.push({
      side,
      startMs: segStartMs,
      endMs,
      period: segPeriod,
      endReason: reason,
      eventCount: segEvents,
    });
    if (side === 'us') totalUsPasses += usPassesInSeg;
    else totalOppPasses += oppPassesInSeg;
    holder = null;
    pendingScore = null;
    segEvents = 0;
    usPassesInSeg = 0;
    oppPassesInSeg = 0;
  };

  const openPossession = (side: PossessionSide, ms: number, period: number) => {
    holder = side;
    pendingScore = null;
    segStartMs = ms;
    segPeriod = period;
    segEvents = 0;
    usPassesInSeg = 0;
    oppPassesInSeg = 0;
  };

  const flipTo = (side: PossessionSide, e: MatchEventRecord, reason: string) => {
    if (pendingScore != null) {
      closePossession(pendingScore, e.matchTimeMs, 'score_before_restart');
    } else if (holder != null && holder !== side) {
      closePossession(holder, e.matchTimeMs, reason);
    }
    openPossession(side, e.matchTimeMs, e.period);
  };

  const sideHolding = (): PossessionSide | null => pendingScore ?? holder;

  for (const e of sorted) {
    segEvents += 1;

    if (isOurPassEvent(e)) usPassesInSeg += 1;
    if (e.kind === 'pass' && e.playPhaseContext === 'defense') oppPassesInSeg += 1;

    if (e.kind === 'try') {
      if (holder === 'us' || holder == null) {
        if (holder == null) openPossession('us', e.matchTimeMs, e.period);
        pendingScore = 'us';
      }
      continue;
    }

    if (e.kind === 'opponent_try') {
      if (holder !== 'us') {
        if (holder == null) openPossession('opp', e.matchTimeMs, e.period);
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
      flipTo('us', e, 'forced_turnover');
      continue;
    }

    if (e.kind === 'team_penalty') {
      const dir = resolvePenaltyDirection(e);
      const phase = e.playPhaseContext ?? 'attack';
      if (dir === 'conceded' && phase === 'attack') {
        if (holder === 'us' || pendingScore === 'us') closePossession('us', e.matchTimeMs, 'penalty_conceded');
        else flipTo('opp', e, 'penalty_conceded');
      } else if (dir === 'awarded' && phase === 'defense') {
        flipTo('us', e, 'penalty_awarded');
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
      }
      continue;
    }

    if (SET_PIECE_KINDS.has(e.kind)) {
      const next = possessionFromSetPiece(e);
      if (next == null) continue;
      if (e.kind === 'restart') {
        flipTo(next, e, 'restart');
        continue;
      }
      const phase = e.playPhaseContext;
      const outcome = setPieceOutcome(e);
      if (phase === 'attack' && outcome === 'lost') {
        if (holder === 'us' || pendingScore === 'us') closePossession('us', e.matchTimeMs, 'set_piece_lost');
        flipTo('opp', e, 'set_piece_lost');
      } else if (phase === 'defense' && outcome === 'won') {
        flipTo('us', e, 'set_piece_won');
      } else if (phase === 'attack' && outcome === 'won') {
        if (holder == null) openPossession('us', e.matchTimeMs, e.period);
        else holder = 'us';
      } else if (phase === 'defense' && outcome === 'lost') {
        if (sideHolding() === 'opp') {
          closePossession('opp', e.matchTimeMs, 'set_piece_lost');
        } else if (holder == null && pendingScore == null) {
          openPossession('opp', e.matchTimeMs, e.period);
        }
      }
      continue;
    }

    if (holder == null) {
      const inferred = inferHolderFromEvent(e);
      if (inferred != null) openPossession(inferred, e.matchTimeMs, e.period);
    }
  }

  if (pendingScore != null) {
    const last = sorted[sorted.length - 1];
    closePossession(pendingScore, last?.matchTimeMs ?? segStartMs, 'open_at_end');
  } else if (holder != null) {
    const last = sorted[sorted.length - 1];
    closePossession(holder, last?.matchTimeMs ?? segStartMs, 'open_at_end');
  }

  const us = segments.filter((s) => s.side === 'us').length;
  const opp = segments.filter((s) => s.side === 'opp').length;

  return {
    us,
    opp,
    total: us + opp,
    segments,
    passesPerPossessionUs: us > 0 ? Math.round((totalUsPasses / us) * 10) / 10 : null,
    passesPerPossessionOpp: opp > 0 ? Math.round((totalOppPasses / opp) * 10) / 10 : null,
  };
}

export function aggregatePossessionStats(batches: MatchEventRecord[][]): PossessionStats {
  let us = 0;
  let opp = 0;
  let totalUsPasses = 0;
  let totalOppPasses = 0;
  const segments: PossessionSegment[] = [];
  for (const batch of batches) {
    const s = computePossessionStats(batch);
    us += s.us;
    opp += s.opp;
    segments.push(...s.segments);
    if (s.passesPerPossessionUs != null) totalUsPasses += s.passesPerPossessionUs * s.us;
    if (s.passesPerPossessionOpp != null) totalOppPasses += s.passesPerPossessionOpp * s.opp;
  }
  return {
    us,
    opp,
    total: us + opp,
    segments,
    passesPerPossessionUs: us > 0 ? Math.round((totalUsPasses / us) * 10) / 10 : null,
    passesPerPossessionOpp: opp > 0 ? Math.round((totalOppPasses / opp) * 10) / 10 : null,
  };
}
