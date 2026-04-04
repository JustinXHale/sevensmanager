import { describe, expect, it } from 'vitest';
import {
  hydrationEstimateFromDelta,
  massDeltaKg,
  ML_PER_KG_LOST_DEFAULT,
  pairWeighInsForMember,
} from '@/domain/hydration';

describe('hydration', () => {
  it('massDeltaKg is pre minus post', () => {
    expect(massDeltaKg(80, 79.2)).toBeCloseTo(0.8, 5);
  });

  it('suggests ml proportional to kg lost', () => {
    const e = hydrationEstimateFromDelta(0.8);
    expect(e.deltaKg).toBeCloseTo(0.8, 5);
    expect(e.suggestedFluidMl).toBe(Math.round(0.8 * ML_PER_KG_LOST_DEFAULT));
  });

  it('no loss → zero suggestion', () => {
    const e = hydrationEstimateFromDelta(-0.1);
    expect(e.suggestedFluidMl).toBe(0);
  });

  it('pairs pre then post in time order', () => {
    const pairs = pairWeighInsForMember([
      { id: '1', recordedAt: 100, phase: 'pre', weightKg: 80 },
      { id: '2', recordedAt: 200, phase: 'post', weightKg: 79 },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.deltaKg).toBeCloseTo(1, 5);
  });
});
