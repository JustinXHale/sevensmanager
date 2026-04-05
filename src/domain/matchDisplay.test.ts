import { describe, expect, it } from 'vitest';
import type { MatchRecord } from './match';
import { derivedFixtureLabel } from './matchDisplay';

function m(p: Partial<MatchRecord>): MatchRecord {
  return {
    id: '1',
    title: 'T',
    createdAt: 0,
    updatedAt: 0,
    ...p,
  };
}

describe('derivedFixtureLabel', () => {
  it('prefers us vs them when both set', () => {
    expect(derivedFixtureLabel(m({ ourTeamName: 'Reds', opponentName: 'Eagles', title: 'Pool A' }))).toBe(
      'Reds vs Eagles',
    );
  });

  it('falls back to title', () => {
    expect(derivedFixtureLabel(m({ title: 'Training', opponentName: undefined, ourTeamName: undefined }))).toBe(
      'Training',
    );
  });
});
