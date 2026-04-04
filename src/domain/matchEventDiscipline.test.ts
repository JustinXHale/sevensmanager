import { describe, expect, it } from 'vitest';
import { accumulateDisciplineBadgesFromEvents } from '@/domain/matchEvent';
import type { MatchEventRecord } from '@/domain/matchEvent';

function ev(partial: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'playerId'>): MatchEventRecord {
  return {
    matchId: 'm',
    kind: 'team_penalty',
    matchTimeMs: 0,
    period: 1,
    createdAt: 0,
    penaltyType: 'offside',
    ...partial,
  } as MatchEventRecord;
}

describe('accumulateDisciplineBadgesFromEvents', () => {
  it('aggregates yellow and red per player', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', playerId: 'a', penaltyCard: 'yellow' }),
      ev({ id: '2', playerId: 'b', penaltyCard: 'red' }),
      ev({ id: '3', playerId: 'a', penaltyCard: 'red' }),
    ];
    const m = accumulateDisciplineBadgesFromEvents(events);
    expect(m.a).toEqual({ yellow: true, red: true });
    expect(m.b).toEqual({ yellow: false, red: true });
  });

  it('ignores soft-deleted and non-card penalties', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', playerId: 'a', penaltyCard: 'yellow', deletedAt: 1 }),
      ev({ id: '2', playerId: 'a', penaltyType: 'offside' }),
    ];
    expect(accumulateDisciplineBadgesFromEvents(events)).toEqual({});
  });
});
