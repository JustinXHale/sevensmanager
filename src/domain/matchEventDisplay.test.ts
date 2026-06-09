import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { timelinePhaseForEvent, timelineRowClassName } from '@/domain/matchEventDisplay';

function ev(over: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    ...over,
  };
}

describe('timelinePhaseForEvent', () => {
  it('uses playPhaseContext for set pieces', () => {
    expect(timelinePhaseForEvent(ev({ id: '1', kind: 'scrum', playPhaseContext: 'defense' }))).toBe('defense');
    expect(timelinePhaseForEvent(ev({ id: '2', kind: 'ruck', playPhaseContext: 'attack' }))).toBe('attack');
  });

  it('infers attack and defense from kind when phase not stored', () => {
    expect(timelinePhaseForEvent(ev({ id: '3', kind: 'try' }))).toBe('attack');
    expect(timelinePhaseForEvent(ev({ id: '4', kind: 'tackle' }))).toBe('defense');
    expect(timelinePhaseForEvent(ev({ id: '5', kind: 'system_moment' }))).toBe('attack');
    expect(timelinePhaseForEvent(ev({ id: '6', kind: 'forced_turnover' }))).toBe('defense');
  });

  it('returns null for neutral bookmarks', () => {
    expect(timelinePhaseForEvent(ev({ id: '7', kind: 'film_star' }))).toBeNull();
  });
});

describe('timelineRowClassName', () => {
  it('adds phase and film-star modifiers', () => {
    expect(timelineRowClassName(ev({ id: '1', kind: 'try' }))).toContain('live-timeline-row--attack');
    expect(timelineRowClassName(ev({ id: '2', kind: 'tackle' }))).toContain('live-timeline-row--defense');
    expect(timelineRowClassName(ev({ id: '3', kind: 'film_star' }))).toContain('live-timeline-row--film-star');
    expect(timelineRowClassName(ev({ id: '3', kind: 'film_star' }))).not.toContain('live-timeline-row--attack');
  });
});
