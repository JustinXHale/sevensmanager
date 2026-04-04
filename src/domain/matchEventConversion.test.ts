import { describe, expect, it } from 'vitest';
import type { MatchEventRecord } from './matchEvent';
import { pendingConversionKickFromEvents } from './matchEvent';

let id = 0;
function row(
  partial: Omit<Partial<MatchEventRecord>, 'kind' | 'matchTimeMs' | 'createdAt'> &
    Pick<MatchEventRecord, 'kind' | 'matchTimeMs' | 'createdAt'>,
): MatchEventRecord {
  id += 1;
  return {
    id: `e-${id}`,
    matchId: 'm1',
    period: 1,
    ...partial,
  } as MatchEventRecord;
}

describe('pendingConversionKickFromEvents', () => {
  it('returns the first unpaired try location (FIFO)', () => {
    const events = [
      row({ kind: 'try', matchTimeMs: 1000, createdAt: 1, zoneId: 'Z2' }),
      row({ kind: 'try', matchTimeMs: 2000, createdAt: 2, zoneId: 'Z5' }),
    ];
    expect(pendingConversionKickFromEvents(events)).toEqual({ zoneId: 'Z2' });
  });

  it('consumes a conversion and advances to the next try', () => {
    const events = [
      row({ kind: 'try', matchTimeMs: 1000, createdAt: 1, zoneId: 'Z2', fieldLengthBand: 'opp_half' }),
      row({ kind: 'conversion', matchTimeMs: 1500, createdAt: 2 }),
      row({ kind: 'try', matchTimeMs: 2000, createdAt: 3, zoneId: 'Z5' }),
    ];
    expect(pendingConversionKickFromEvents(events)).toEqual({ zoneId: 'Z5' });
  });

  it('copies fieldLengthBand from the paired try when present', () => {
    const events = [
      row({ kind: 'try', matchTimeMs: 1000, createdAt: 1, zoneId: 'Z3', fieldLengthBand: 'opp_22' }),
    ];
    expect(pendingConversionKickFromEvents(events)).toEqual({
      zoneId: 'Z3',
      fieldLengthBand: 'opp_22',
    });
  });

  it('returns null when tries and conversions balance', () => {
    const events = [
      row({ kind: 'try', matchTimeMs: 1000, createdAt: 1, zoneId: 'Z2' }),
      row({ kind: 'conversion', matchTimeMs: 2000, createdAt: 2 }),
    ];
    expect(pendingConversionKickFromEvents(events)).toBeNull();
  });
});
