import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_SESSION_MASS_LOSS_PERCENT,
  formatSessionMassLossPercentDisplay,
  isSessionWeightPairInRange,
  sessionMassLossPercent,
  weighPairRowStatus,
} from './weighInPolicy';

describe('weighInPolicy', () => {
  it('sessionMassLossPercent matches pre-post over pre', () => {
    expect(sessionMassLossPercent(80, 79)).toBeCloseTo(1.25, 5);
  });

  it('in range when loss at threshold', () => {
    const pre = 80;
    const post = 80 * (1 - DEFAULT_MAX_SESSION_MASS_LOSS_PERCENT / 100);
    expect(isSessionWeightPairInRange(pre, post)).toBe(true);
  });

  it('out of range when loss above threshold', () => {
    const pre = 80;
    const post = 80 * (1 - (DEFAULT_MAX_SESSION_MASS_LOSS_PERCENT + 0.5) / 100);
    expect(isSessionWeightPairInRange(pre, post)).toBe(false);
  });

  it('weighPairRowStatus', () => {
    expect(weighPairRowStatus(undefined, 79)).toBe('incomplete');
    expect(weighPairRowStatus(80, undefined)).toBe('incomplete');
    expect(weighPairRowStatus(80, 79)).toBe('in_range');
  });

  it('formatSessionMassLossPercentDisplay', () => {
    expect(formatSessionMassLossPercentDisplay(undefined, 79).text).toBe('—');
    const ok = formatSessionMassLossPercentDisplay(80, 79.2);
    expect(ok.text).toContain('%');
    expect(ok.warn).toBe(false);
    const bad = formatSessionMassLossPercentDisplay(80, 78);
    expect(bad.warn).toBe(true);
  });
});
