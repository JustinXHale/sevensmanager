import { describe, expect, it } from 'vitest';
import {
  bandIndexFromPointerSemicircle4,
  fieldLengthBandIdFromIndex,
  semicirclePillOffset,
  zoneIdFromIndex,
  zoneIndexFromPointerSemicircle6,
} from './zoneFlowerGeometry';

describe('zoneIndexFromPointerSemicircle6 (upper half)', () => {
  it('maps left side of top semicircle to index 0 (P1 / Z1)', () => {
    const cx = 200;
    const cy = 200;
    const idx = zoneIndexFromPointerSemicircle6(cx - 90, cy - 50, cx, cy);
    expect(idx).toBe(0);
  });

  it('returns null near center', () => {
    expect(zoneIndexFromPointerSemicircle6(200, 200, 200, 200, 28)).toBeNull();
  });

  it('returns null below center (lower half-plane)', () => {
    const cx = 200;
    const cy = 200;
    expect(zoneIndexFromPointerSemicircle6(cx, cy + 80, cx, cy)).toBeNull();
  });
});

describe('bandIndexFromPointerSemicircle4', () => {
  it('maps four bands along same upper semicircle', () => {
    const cx = 200;
    const cy = 200;
    expect(bandIndexFromPointerSemicircle4(cx - 80, cy - 40, cx, cy)).toBe(0);
    expect(fieldLengthBandIdFromIndex(0)).toBe('own_22');
    expect(fieldLengthBandIdFromIndex(3)).toBe('opp_22');
  });
});

describe('helpers', () => {
  it('zoneIdFromIndex', () => {
    expect(zoneIdFromIndex(0)).toBe('Z1');
    expect(zoneIdFromIndex(5)).toBe('Z6');
  });

  it('semicirclePillOffset returns upward offsets (negative y)', () => {
    const p = semicirclePillOffset(0, 6, 78);
    expect(p.y).toBeLessThan(0);
    expect(Number.isFinite(p.x)).toBe(true);
  });
});
