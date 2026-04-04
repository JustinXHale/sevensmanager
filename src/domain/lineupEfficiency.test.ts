import { describe, it, expect } from 'vitest';
import {
  computePlayerEfficiency,
  rawScore,
  WEIGHTS,
  type MatchPlayerInput,
} from './lineupEfficiency';
import type { MatchEventRecord } from './matchEvent';

function mkEvent(
  overrides: Partial<MatchEventRecord> & { kind: MatchEventRecord['kind'] },
): MatchEventRecord {
  return {
    id: crypto.randomUUID(),
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('rawScore', () => {
  it('scores a try-scorer with dominant tackles positively', () => {
    const profile = {
      playerId: 'p1',
      passes: 4,
      offloads: 1,
      tackles: { made: 3, missed: 1, dominant: 2, neutral: 1, passive: 0 },
      lineBreaks: 1,
      negatives: 0,
      negativeBreakdown: {},
      penalties: 0,
      cards: { yellow: 0, red: 0 },
      tries: 2,
      conversions: { made: 1, missed: 0 },
    };
    const s = rawScore(profile);
    const expected =
      2 * WEIGHTS.tackleDominant +
      1 * WEIGHTS.tackleNeutral +
      0 * WEIGHTS.tacklePassive +
      1 * WEIGHTS.tackleMissed +
      1 * WEIGHTS.lineBreak +
      2 * WEIGHTS.try +
      1 * WEIGHTS.conversionMade +
      4 * WEIGHTS.pass +
      1 * WEIGHTS.offload;
    expect(s).toBe(expected);
  });

  it('heavily penalises red cards', () => {
    const clean = {
      playerId: 'p1', passes: 0, offloads: 0,
      tackles: { made: 0, missed: 0, dominant: 0, neutral: 0, passive: 0 },
      lineBreaks: 0, negatives: 0, negativeBreakdown: {},
      penalties: 1, cards: { yellow: 0, red: 1 },
      tries: 0, conversions: { made: 0, missed: 0 },
    };
    expect(rawScore(clean)).toBe(WEIGHTS.penalty + WEIGHTS.redCard);
  });
});

describe('computePlayerEfficiency', () => {
  const tenMinMs = 10 * 60 * 1000;

  it('returns empty for no matches', () => {
    expect(computePlayerEfficiency([])).toEqual([]);
  });

  it('qualifies a player with enough minutes and games', () => {
    const events1: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'p1a', matchId: 'm1' }),
      mkEvent({ kind: 'try', playerId: 'p1a', matchId: 'm1' }),
    ];
    const events2: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'p1b', matchId: 'm2' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events: events1, playerMinutesMs: { p1a: tenMinMs }, playerIdToStableKey: { p1a: 'member-1' } },
      { events: events2, playerMinutesMs: { p1b: tenMinMs }, playerIdToStableKey: { p1b: 'member-1' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows.length).toBe(1);
    expect(rows[0]!.qualified).toBe(true);
    expect(rows[0]!.gamesPlayed).toBe(2);
    expect(rows[0]!.globalScore).toBe(100);
    expect(rows[0]!.playerKey).toBe('member-1');
  });

  it('does not qualify a player with only 1 game', () => {
    const events: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'p1' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events, playerMinutesMs: { p1: tenMinMs * 3 }, playerIdToStableKey: { p1: 'member-1' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.qualified).toBe(false);
    expect(rows[0]!.gamesPlayed).toBe(1);
  });

  it('does not qualify a player with insufficient minutes', () => {
    const events1: MatchEventRecord[] = [mkEvent({ kind: 'pass', playerId: 'p1a', matchId: 'm1' })];
    const events2: MatchEventRecord[] = [mkEvent({ kind: 'pass', playerId: 'p1b', matchId: 'm2' })];
    const matches: MatchPlayerInput[] = [
      { events: events1, playerMinutesMs: { p1a: 1000 }, playerIdToStableKey: { p1a: 'member-1' } },
      { events: events2, playerMinutesMs: { p1b: 1000 }, playerIdToStableKey: { p1b: 'member-1' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.qualified).toBe(false);
  });

  it('merges the same teamMemberId across matches (dedup)', () => {
    const events1: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'match1-p1', matchId: 'm1' }),
    ];
    const events2: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'match2-p1', matchId: 'm2' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events: events1, playerMinutesMs: { 'match1-p1': tenMinMs }, playerIdToStableKey: { 'match1-p1': 'member-7' } },
      { events: events2, playerMinutesMs: { 'match2-p1': tenMinMs }, playerIdToStableKey: { 'match2-p1': 'member-7' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows.length).toBe(1);
    expect(rows[0]!.playerKey).toBe('member-7');
    expect(rows[0]!.profile.tries).toBe(2);
    expect(rows[0]!.gamesPlayed).toBe(2);
  });

  it('ranks qualified players above unqualified, then by score', () => {
    const good: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'star', matchId: 'm1' }),
      mkEvent({ kind: 'try', playerId: 'star', matchId: 'm1' }),
      mkEvent({ kind: 'line_break', playerId: 'star', matchId: 'm1' }),
    ];
    const ok: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'bench', matchId: 'm1' }),
    ];
    const game2Good: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'star2', matchId: 'm2' }),
    ];
    const game2Ok: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'bench2', matchId: 'm2' }),
    ];

    const matches: MatchPlayerInput[] = [
      {
        events: [...good, ...ok],
        playerMinutesMs: { star: tenMinMs, bench: tenMinMs },
        playerIdToStableKey: { star: 'member-star', bench: 'member-bench' },
      },
      {
        events: [...game2Good, ...game2Ok],
        playerMinutesMs: { star2: tenMinMs, bench2: tenMinMs },
        playerIdToStableKey: { star2: 'member-star', bench2: 'member-bench' },
      },
    ];

    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.playerKey).toBe('member-star');
    expect(rows[0]!.globalScore).toBe(100);
    expect(rows[1]!.playerKey).toBe('member-bench');
    expect(rows[1]!.globalScore).toBeGreaterThan(0);
    expect(rows[1]!.globalScore).toBeLessThan(100);
  });

  it('tracks per-game scores and consistency', () => {
    const g1: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'p1a', matchId: 'm1' }),
    ];
    const g2: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'p1b', matchId: 'm2' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events: g1, playerMinutesMs: { p1a: tenMinMs }, playerIdToStableKey: { p1a: 'member-1' } },
      { events: g2, playerMinutesMs: { p1b: tenMinMs }, playerIdToStableKey: { p1b: 'member-1' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.perGameScores).toHaveLength(2);
    expect(rows[0]!.perGameScores[0]).toBe(rows[0]!.perGameScores[1]);
    expect(rows[0]!.consistency).toBe('steady');
  });

  it('marks variable consistency when scores differ widely', () => {
    const g1: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'p1a', matchId: 'm1' }),
      mkEvent({ kind: 'try', playerId: 'p1a', matchId: 'm1' }),
      mkEvent({ kind: 'try', playerId: 'p1a', matchId: 'm1' }),
      mkEvent({ kind: 'line_break', playerId: 'p1a', matchId: 'm1' }),
      mkEvent({ kind: 'line_break', playerId: 'p1a', matchId: 'm1' }),
    ];
    const g2: MatchEventRecord[] = [
      mkEvent({ kind: 'negative_action', playerId: 'p1b', matchId: 'm2', negativeActionId: 'knock_on' }),
      mkEvent({ kind: 'negative_action', playerId: 'p1b', matchId: 'm2', negativeActionId: 'knock_on' }),
      mkEvent({ kind: 'negative_action', playerId: 'p1b', matchId: 'm2', negativeActionId: 'knock_on' }),
    ];
    const g3: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'p1c', matchId: 'm3' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events: g1, playerMinutesMs: { p1a: tenMinMs }, playerIdToStableKey: { p1a: 'member-5' } },
      { events: g2, playerMinutesMs: { p1b: tenMinMs }, playerIdToStableKey: { p1b: 'member-5' } },
      { events: g3, playerMinutesMs: { p1c: tenMinMs }, playerIdToStableKey: { p1c: 'member-5' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.consistency).toBe('variable');
  });

  it('aggregates profile stats across games via stable key merge', () => {
    const g1: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'g1-p1', matchId: 'm1' }),
    ];
    const g2: MatchEventRecord[] = [
      mkEvent({ kind: 'try', playerId: 'g2-p1', matchId: 'm2' }),
      mkEvent({ kind: 'pass', playerId: 'g2-p1', matchId: 'm2' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events: g1, playerMinutesMs: { 'g1-p1': tenMinMs }, playerIdToStableKey: { 'g1-p1': 'member-3' } },
      { events: g2, playerMinutesMs: { 'g2-p1': tenMinMs }, playerIdToStableKey: { 'g2-p1': 'member-3' } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.profile.tries).toBe(2);
    expect(rows[0]!.profile.passes).toBe(1);
  });

  it('falls back to playerId when no stable key map is provided', () => {
    const events: MatchEventRecord[] = [
      mkEvent({ kind: 'pass', playerId: 'p1' }),
    ];
    const matches: MatchPlayerInput[] = [
      { events, playerMinutesMs: { p1: tenMinMs * 3 } },
    ];
    const rows = computePlayerEfficiency(matches);
    expect(rows[0]!.playerKey).toBe('p1');
  });
});
