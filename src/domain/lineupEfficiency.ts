import { buildPlayerProfiles, type PlayerProfile } from '@/domain/matchAnalyticsDeep';
import type { MatchEventRecord } from '@/domain/matchEvent';

// ---------------------------------------------------------------------------
// Weights — tunable constants for the efficiency score
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  tackleDominant: 3,
  tackleNeutral: 2,
  tacklePassive: 1,
  tackleMissed: -2,
  lineBreak: 4,
  try: 5,
  conversionMade: 3,
  conversionMissed: -1,
  pass: 0.5,
  offload: 1.5,
  negative: -2,
  penalty: -3,
  yellowCard: -5,
  redCard: -10,
} as const;

/** Minimum total minutes across all games to qualify for ranking. */
export const MIN_MINUTES_MS = 10 * 60 * 1000;

/** Minimum number of games a player must appear in. */
export const MIN_GAMES = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerEfficiencyRow = {
  /**
   * Stable identity key used for grouping across matches.
   * When `playerIdToStableKey` is provided this is the teamMemberId (or jersey-based key).
   * Otherwise it falls back to the raw playerId.
   */
  playerKey: string;
  /** Composite score scaled 0–100 (based on max in the cohort). */
  globalScore: number;
  /** Raw weighted point total (unscaled). */
  rawPoints: number;
  /** Total ms on field across all games. */
  minutesPlayedMs: number;
  /** Number of games this player had events or minutes in. */
  gamesPlayed: number;
  /** Raw score per game (same index as input order). */
  perGameScores: number[];
  /** Steady = all per-game scores within 1 stddev of mean; variable otherwise. */
  consistency: 'steady' | 'variable';
  /** True when the player meets MIN_MINUTES_MS and MIN_GAMES thresholds. */
  qualified: boolean;
  /** Aggregated profile for chip display. */
  profile: PlayerProfile;
  /** One representative per-match playerId (for name/label lookups via globalPlayers). */
  representativePlayerId: string;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Compute raw weighted score for a single PlayerProfile. */
export function rawScore(p: PlayerProfile): number {
  return (
    p.tackles.dominant * WEIGHTS.tackleDominant +
    p.tackles.neutral * WEIGHTS.tackleNeutral +
    p.tackles.passive * WEIGHTS.tacklePassive +
    p.tackles.missed * WEIGHTS.tackleMissed +
    p.lineBreaks * WEIGHTS.lineBreak +
    p.tries * WEIGHTS.try +
    p.conversions.made * WEIGHTS.conversionMade +
    p.conversions.missed * WEIGHTS.conversionMissed +
    p.passes * WEIGHTS.pass +
    p.offloads * WEIGHTS.offload +
    p.negatives * WEIGHTS.negative +
    p.penalties * WEIGHTS.penalty +
    p.cards.yellow * WEIGHTS.yellowCard +
    p.cards.red * WEIGHTS.redCard
  );
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Per-match input
// ---------------------------------------------------------------------------

export type MatchPlayerInput = {
  events: MatchEventRecord[];
  /** playerMinutesMs from MatchSessionRecord (may be empty/undefined). */
  playerMinutesMs: Record<string, number> | undefined;
  /**
   * Map from per-match playerId to stable identity key.
   * Preferred: teamMemberId (season-level).
   * Fallback: jersey number (tournament-level).
   * When omitted, raw playerIds are used as keys (no cross-match merging).
   */
  playerIdToStableKey?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

type Accumulator = {
  totalRaw: number;
  totalMinutesMs: number;
  gamesPlayed: number;
  perGameScores: number[];
  profile: PlayerProfile;
  representativePlayerId: string;
};

/**
 * Compute efficiency rankings across multiple matches.
 *
 * Players are unified across matches by jersey number when
 * `playerIdToJersey` is provided per match. This prevents the same person
 * from appearing as multiple rows.
 */
export function computePlayerEfficiency(
  matches: MatchPlayerInput[],
): PlayerEfficiencyRow[] {
  const acc = new Map<string, Accumulator>();

  const getAcc = (key: string, representativeId: string) => {
    let a = acc.get(key);
    if (!a) {
      a = {
        totalRaw: 0,
        totalMinutesMs: 0,
        gamesPlayed: 0,
        perGameScores: [],
        representativePlayerId: representativeId,
        profile: {
          playerId: key,
          passes: 0,
          offloads: 0,
          tackles: { made: 0, missed: 0, dominant: 0, neutral: 0, passive: 0 },
          lineBreaks: 0,
          negatives: 0,
          negativeBreakdown: {},
          penalties: 0,
          cards: { yellow: 0, red: 0 },
          tries: 0,
          conversions: { made: 0, missed: 0 },
        },
      };
      acc.set(key, a);
    }
    return a;
  };

  const toKey = (pid: string, stableMap: Record<string, string> | undefined): string => {
    if (stableMap) {
      const key = stableMap[pid];
      if (key) return key;
    }
    return pid;
  };

  for (const match of matches) {
    const profiles = buildPlayerProfiles(match.events);
    const mins = match.playerMinutesMs ?? {};
    const stableMap = match.playerIdToStableKey;

    const playersInMatch = new Set<string>();
    for (const pid of profiles.keys()) playersInMatch.add(pid);
    for (const pid of Object.keys(mins)) playersInMatch.add(pid);

    for (const pid of playersInMatch) {
      const key = toKey(pid, stableMap);
      const p = profiles.get(pid);
      const minsMs = mins[pid] ?? 0;
      const gameRaw = p ? rawScore(p) : 0;

      const a = getAcc(key, pid);
      a.totalRaw += gameRaw;
      a.totalMinutesMs += minsMs;
      a.gamesPlayed += 1;
      a.perGameScores.push(gameRaw);

      if (p) {
        a.profile.passes += p.passes;
        a.profile.offloads += p.offloads;
        a.profile.tackles.made += p.tackles.made;
        a.profile.tackles.missed += p.tackles.missed;
        a.profile.tackles.dominant += p.tackles.dominant;
        a.profile.tackles.neutral += p.tackles.neutral;
        a.profile.tackles.passive += p.tackles.passive;
        a.profile.lineBreaks += p.lineBreaks;
        a.profile.negatives += p.negatives;
        a.profile.penalties += p.penalties;
        a.profile.cards.yellow += p.cards.yellow;
        a.profile.cards.red += p.cards.red;
        a.profile.tries += p.tries;
        a.profile.conversions.made += p.conversions.made;
        a.profile.conversions.missed += p.conversions.missed;
      }
    }
  }

  const rows: PlayerEfficiencyRow[] = [];
  let maxRate = 0;

  for (const [key, a] of acc) {
    const qualified = a.totalMinutesMs >= MIN_MINUTES_MS && a.gamesPlayed >= MIN_GAMES;
    const minutesPlayed = a.totalMinutesMs / 60_000;
    const rate = minutesPlayed > 0 ? a.totalRaw / minutesPlayed : 0;

    const sd = stddev(a.perGameScores);
    const mean = a.perGameScores.length > 0 ? a.perGameScores.reduce((s, v) => s + v, 0) / a.perGameScores.length : 0;
    const allWithin = a.perGameScores.every((v) => Math.abs(v - mean) <= sd);
    const consistency: 'steady' | 'variable' = a.perGameScores.length < 2 ? 'steady' : allWithin ? 'steady' : 'variable';

    if (qualified && rate > maxRate) maxRate = rate;

    rows.push({
      playerKey: key,
      globalScore: 0,
      rawPoints: a.totalRaw,
      minutesPlayedMs: a.totalMinutesMs,
      gamesPlayed: a.gamesPlayed,
      perGameScores: a.perGameScores,
      consistency,
      qualified,
      profile: a.profile,
      representativePlayerId: a.representativePlayerId,
    });
  }

  for (const r of rows) {
    const minutesPlayed = r.minutesPlayedMs / 60_000;
    const rate = minutesPlayed > 0 ? r.rawPoints / minutesPlayed : 0;
    r.globalScore = maxRate > 0 ? Math.round(Math.max(0, (rate / maxRate) * 100)) : 0;
  }

  rows.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    return b.globalScore - a.globalScore;
  });

  return rows;
}
