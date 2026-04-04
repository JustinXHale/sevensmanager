import { describe, expect, it } from 'vitest';
import { pickDefaultMatchId } from '@/domain/lastMatchSelection';
import type { MatchRecord } from '@/domain/match';

function m(id: string): MatchRecord {
  return {
    id,
    title: id,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('pickDefaultMatchId', () => {
  it('returns preferred when present in list', () => {
    const matches = [m('a'), m('b')];
    expect(pickDefaultMatchId(matches, 'b')).toBe('b');
  });

  it('returns first match when preferred missing', () => {
    const matches = [m('a'), m('b')];
    expect(pickDefaultMatchId(matches, 'x')).toBe('a');
  });

  it('returns null for empty list', () => {
    expect(pickDefaultMatchId([], 'a')).toBe(null);
  });
});
