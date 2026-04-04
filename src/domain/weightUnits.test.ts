import { describe, expect, it } from 'vitest';
import {
  formatLbStringFromKg,
  formatWeightLbFromKg,
  kgToLb,
  lbToKg,
  parseWeightLbToKg,
  roundLb,
} from '@/domain/weightUnits';

describe('weightUnits', () => {
  it('round-trips lb via kg', () => {
    const kg = lbToKg(175);
    expect(kgToLb(kg)).toBeCloseTo(175, 2);
  });

  it('formats kg as lb label with at most two decimal places', () => {
    expect(formatWeightLbFromKg(lbToKg(175))).toContain('175');
    expect(formatWeightLbFromKg(lbToKg(175))).toContain('lb');
    const kg = lbToKg(175.123);
    const s = formatWeightLbFromKg(kg);
    const m = s.match(/^([\d.]+) lb$/);
    expect(m).not.toBeNull();
    const dec = m![1]!.split('.')[1];
    expect(dec == null || dec.length <= 2).toBe(true);
  });

  it('formatLbStringFromKg never exceeds two decimal places', () => {
    const kg = lbToKg(180.123456);
    const parts = formatLbStringFromKg(kg).split('.');
    if (parts[1]) expect(parts[1]!.length).toBeLessThanOrEqual(2);
  });

  it('parses lb string to kg and rounds input to two lb decimals', () => {
    const kg = parseWeightLbToKg('175.4');
    expect(kg).not.toBeNull();
    expect(kgToLb(kg!)).toBeCloseTo(175.4, 2);
    const kg2 = parseWeightLbToKg('175.129');
    expect(kg2).not.toBeNull();
    expect(kgToLb(kg2!)).toBeCloseTo(roundLb(175.129), 5);
  });

  it('roundLb limits to two decimals', () => {
    expect(roundLb(175.129)).toBe(175.13);
    expect(roundLb(175.121)).toBe(175.12);
  });
});
