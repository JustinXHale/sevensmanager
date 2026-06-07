import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from '@/domain/matchEvent';
import {
  countPassesAndOffloads,
  countPenaltiesByDirection,
  filmBookmarkEvents,
  setPieceSplitForPhase,
  sortFilmBookmarksByFilmTime,
} from '@/domain/tallyStats';

function ev(p: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 1,
    ...p,
  };
}

describe('countPassesAndOffloads', () => {
  it('splits standard passes and offloads', () => {
    const events = [
      ev({ id: '1', kind: 'pass', passVariant: 'standard' }),
      ev({ id: '2', kind: 'pass', passVariant: 'offload' }),
      ev({ id: '3', kind: 'pass' }),
    ];
    expect(countPassesAndOffloads(events)).toEqual({ pass: 2, offload: 1 });
  });
});

describe('countPenaltiesByDirection', () => {
  it('counts conceded vs awarded with phase filter', () => {
    const events = [
      ev({ id: '1', kind: 'team_penalty', penaltyDirection: 'conceded', playPhaseContext: 'attack' }),
      ev({ id: '2', kind: 'team_penalty', penaltyDirection: 'awarded', playPhaseContext: 'defense' }),
      ev({ id: '3', kind: 'team_penalty' }),
    ];
    expect(countPenaltiesByDirection(events)).toEqual({ conceded: 2, awarded: 1 });
    expect(countPenaltiesByDirection(events, 'attack')).toEqual({ conceded: 1, awarded: 0 });
  });
});

describe('setPieceSplitForPhase', () => {
  it('aggregates outcomes for kind and phase', () => {
    const events = [
      ev({ id: '1', kind: 'scrum', setPieceOutcome: 'won', playPhaseContext: 'attack' }),
      ev({ id: '2', kind: 'scrum', setPieceOutcome: 'lost', playPhaseContext: 'defense' }),
      ev({ id: '3', kind: 'scrum', setPieceOutcome: 'free_kick', playPhaseContext: 'attack' }),
    ];
    expect(setPieceSplitForPhase(events, 'scrum', 'attack')).toEqual({
      won: 1,
      lost: 0,
      penalized: 0,
      freeKick: 1,
    });
  });
});

describe('film bookmarks', () => {
  it('collects starred and system moments and sorts by film time', () => {
    const events = [
      ev({ id: '1', kind: 'film_star', filmTimeMs: 120_000, matchTimeMs: 60_000 }),
      ev({ id: '2', kind: 'system_moment', filmTimeMs: 45_000, matchTimeMs: 30_000 }),
      ev({ id: '3', kind: 'try' }),
    ];
    expect(filmBookmarkEvents(events).map((e) => e.id)).toEqual(['1', '2']);
    expect(sortFilmBookmarksByFilmTime(events).map((e) => e.id)).toEqual(['2', '1']);
  });
});
