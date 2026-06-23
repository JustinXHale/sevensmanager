import { describe, expect, it } from 'vitest';
import {
  suggestPhaseAfterFreeKick,
  suggestPhaseAfterForcedTurnover,
  suggestPhaseAfterKnockOn,
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

  it('free kick does not switch via W/L helper', () => {
    expect(suggestPhaseAfterSetPieceOutcome('free_kick', 'attack')).toBeNull();
  });
});

describe('suggestPhaseAfterFreeKick', () => {
  it('their error on defense switches to attack', () => {
    expect(suggestPhaseAfterFreeKick('opponent', 'defense')).toBe('attack');
  });

  it('our error on attack switches to defense', () => {
    expect(suggestPhaseAfterFreeKick('us', 'attack')).toBe('defense');
  });

  it('their error while receiving restart stays on attack', () => {
    expect(suggestPhaseAfterFreeKick('opponent', 'attack')).toBeNull();
  });
});

describe('turnover and scoring follow-ups', () => {
  it('forced turnover goes to attack', () => {
    expect(suggestPhaseAfterForcedTurnover()).toBe('attack');
  });

  it('knock-on on attack switches to defense', () => {
    expect(suggestPhaseAfterKnockOn('attack')).toBe('defense');
  });

  it('knock-on on defense switches to attack', () => {
    expect(suggestPhaseAfterKnockOn('defense')).toBe('attack');
  });

  it('conversions go to attack for kickoff receive', () => {
    expect(suggestPhaseAfterOurConversion()).toBe('attack');
    expect(suggestPhaseAfterOpponentConversion()).toBe('attack');
  });
});
