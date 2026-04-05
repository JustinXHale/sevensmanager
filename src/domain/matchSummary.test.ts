import { describe, expect, it } from 'vitest';
import type { MatchRecord } from '@/domain/match';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { buildMatchSummaryText } from '@/domain/matchSummary';

describe('buildMatchSummaryText', () => {
  it('includes fixture header and empty log line', () => {
    const match: MatchRecord = {
      id: 'm1',
      title: 'Cup semi',
      ourTeamName: 'Reds',
      opponentName: 'Eagles',
      competition: 'Regional',
      kickoffDate: '2026-04-01',
      createdAt: 1,
      updatedAt: 1,
    };
    const text = buildMatchSummaryText(match, [], [], new Map());
    expect(text).toContain('Cup semi');
    expect(text).toContain('Reds vs Eagles');
    expect(text).toContain('Competition: Regional');
    expect(text).toContain('(no events)');
  });

  it('lists events oldest first by match time', () => {
    const match: MatchRecord = {
      id: 'm1',
      title: 'T',
      createdAt: 1,
      updatedAt: 1,
    };
    const a: MatchEventRecord = {
      id: 'e1',
      matchId: 'm1',
      kind: 'try',
      matchTimeMs: 60_000,
      period: 1,
      createdAt: 2,
      zoneId: 'Z3',
    };
    const b: MatchEventRecord = {
      id: 'e2',
      matchId: 'm1',
      kind: 'pass',
      matchTimeMs: 0,
      period: 1,
      createdAt: 3,
    };
    const text = buildMatchSummaryText(match, [a, b], [], new Map());
    const idxPass = text.indexOf('P1 0:00');
    const idxTry = text.indexOf('P1 1:00');
    expect(idxPass).toBeGreaterThan(-1);
    expect(idxTry).toBeGreaterThan(-1);
    expect(idxPass).toBeLessThan(idxTry);
  });
});
