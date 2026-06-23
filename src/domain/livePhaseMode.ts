import type { FreeKickAgainst, PenaltyDirection, PlayPhaseContext } from '@/domain/matchEvent';

/** Attack / Defense / Opp tab on Tally and One Tap live tracking. */
export type LivePhaseMode = 'attack' | 'defense' | 'opponent';

export type SetPieceOutcomeChoice = 'won' | 'lost' | 'free_kick';

/**
 * After a penalty (open play or set-piece P+/P−): switch when possession flips.
 * Awarded on defense → we get the ball. Conceded on attack → they get the ball.
 */
export function suggestPhaseAfterPenalty(
  direction: PenaltyDirection,
  phase: PlayPhaseContext,
): LivePhaseMode | null {
  if (direction === 'awarded' && phase === 'defense') return 'attack';
  if (direction === 'conceded' && phase === 'attack') return 'defense';
  return null;
}

/** Set-piece W/L without penalty — turnover when we lose on attack or win on defense. */
export function suggestPhaseAfterSetPieceOutcome(
  choice: SetPieceOutcomeChoice,
  phase: PlayPhaseContext,
): LivePhaseMode | null {
  if (choice === 'lost' && phase === 'attack') return 'defense';
  if (choice === 'won' && phase === 'defense') return 'attack';
  return null;
}

/** FK to us on defense → attack; FK to them on attack → defense (possession flip). */
export function suggestPhaseAfterFreeKick(
  against: FreeKickAgainst,
  phase: PlayPhaseContext,
): LivePhaseMode | null {
  if (against === 'opponent' && phase === 'defense') return 'attack';
  if (against === 'us' && phase === 'attack') return 'defense';
  return null;
}

export function suggestPhaseAfterForcedTurnover(): LivePhaseMode {
  return 'attack';
}

/** Knock-on ends our attacking spell → defense; opponent knock-on on defense → attack. */
export function suggestPhaseAfterKnockOn(phase: PlayPhaseContext): LivePhaseMode | null {
  if (phase === 'attack') return 'defense';
  if (phase === 'defense') return 'attack';
  return null;
}

/** After our conversion — receive their kickoff (sevens). */
export function suggestPhaseAfterOurConversion(): LivePhaseMode {
  return 'attack';
}

/** After opponent conversion — receive their kickoff. */
export function suggestPhaseAfterOpponentConversion(): LivePhaseMode {
  return 'attack';
}
