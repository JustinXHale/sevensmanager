import { describe, expect, it } from 'vitest';
import { isZoneId, ZONE_IDS } from './zone';

describe('zone', () => {
  it('has six team-relative zone ids', () => {
    expect(ZONE_IDS).toHaveLength(6);
  });

  it('isZoneId narrows strings', () => {
    expect(isZoneId('Z1')).toBe(true);
    expect(isZoneId('Z7')).toBe(false);
  });
});
