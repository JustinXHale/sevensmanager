/**
 * Rough fluid replacement estimate from body mass change.
 * Mass change is not pure water; this is an educational team guideline, not medical advice.
 */
export const ML_PER_KG_LOST_DEFAULT = 1250;

export type HydrationEstimate = {
  /** Positive kg = mass lost (pre − post when pre > post). */
  deltaKg: number;
  /** Rounded ml using ML_PER_KG_LOST_DEFAULT × |Δkg| when loss > 0. */
  suggestedFluidMl: number;
};

/** preKg − postKg; positive means the athlete lost mass over the interval. */
export function massDeltaKg(preKg: number, postKg: number): number {
  return preKg - postKg;
}

export function hydrationEstimateFromDelta(deltaKg: number): HydrationEstimate {
  const loss = deltaKg > 0 ? deltaKg : 0;
  const suggestedFluidMl = Math.round(loss * ML_PER_KG_LOST_DEFAULT);
  return { deltaKg, suggestedFluidMl };
}

/**
 * Pair pre/post weigh-ins per member by time: each post pairs with the latest unmatched pre before it.
 */
export function pairWeighInsForMember(
  rows: { id: string; recordedAt: number; phase: 'pre' | 'post'; weightKg: number }[],
): { pre: (typeof rows)[0]; post: (typeof rows)[0]; deltaKg: number; estimate: HydrationEstimate }[] {
  const sorted = [...rows].sort((a, b) => a.recordedAt - b.recordedAt);
  const out: {
    pre: (typeof rows)[0];
    post: (typeof rows)[0];
    deltaKg: number;
    estimate: HydrationEstimate;
  }[] = [];
  let pendingPre: (typeof rows)[0] | null = null;
  for (const r of sorted) {
    if (r.phase === 'pre') {
      pendingPre = r;
      continue;
    }
    if (r.phase === 'post') {
      if (!pendingPre) continue;
      const d = massDeltaKg(pendingPre.weightKg, r.weightKg);
      const estimate = hydrationEstimateFromDelta(d);
      out.push({ pre: pendingPre, post: r, deltaKg: d, estimate });
      pendingPre = null;
    }
  }
  return out;
}
