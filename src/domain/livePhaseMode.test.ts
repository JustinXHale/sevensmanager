import { describe, expect, it } from 'vitest';
import {
  suggestPhaseAfterForcedTurnover,
  suggestPhaseAfterOpponentConversion,
  suggestPhaseAfterOurConversion,
  suggestPhaseAfterPenalty,
  suggestPhaseAfterSetPieceOutcome,
} from '@/domain/livePhaseMode';

describe('suggestPhaseAfterPenalty', () => {
  it('awarded on defense switches to attack', () => {
    expect(suggestPhaseAfterPenalty('awarded', 'defense')).toBe('attack');
  });

  it('conceded on attack switches to defense', () => {
    expect(suggestPhaseAfterPenalty('conceded', 'attack')).toBe('defense');
  });

  it('awarded on attack stays', () => {
    expect(suggestPhaseAfterPenalty('awarded', 'attack')).toBeNull();
  });

  it('conceded on defense stays', () => {
    expect(suggestPhaseAfterPenalty('conceded', 'defense')).toBeNull();
  });
});

describe('suggestPhaseAfterSetPieceOutcome', () => {
  it('lost on attack switches to defense', () => {
    expect(suggestPhaseAfterSetPieceOutcome('lost', 'attack')).toBe('defense');
  });

  it('won on defense switches to attack', () => {
    expect(suggestPhaseAfterSetPieceOutcome('won', 'defense')).toBe('attack');
  });

  it('won on attack stays', () => {
    expect(suggestPhaseAfterSetPieceOutcome('won', 'attack')).toBeNull();
  });

  it('free kick does not switch', () => {
    expect(suggestPhaseAfterSetPieceOutcome('free_kick', 'attack')).toBeNull();
  });
});

describe('turnover and scoring follow-ups', () => {
  it('forced turnover goes to attack', () => {
    expect(suggestPhaseAfterForcedTurnover()).toBe('attack');
  });

  it('conversions go to attack for kickoff receive', () => {
    expect(suggestPhaseAfterOurConversion()).toBe('attack');
    expect(suggestPhaseAfterOpponentConversion()).toBe('attack');
  });
});
