/**
 * Session weight policy for pre/post pair checks (guideline, not medical advice).
 * Coaches often flag excessive fluid loss from pre to post weigh-in.
 */

/** Max recommended body mass loss from pre to post (percent of pre weight). Above = flagged. */
export const DEFAULT_MAX_SESSION_MASS_LOSS_PERCENT = 2;

export function sessionMassLossPercent(preKg: number, postKg: number): number {
  if (preKg <= 0) return 0;
  return ((preKg - postKg) / preKg) * 100;
}

/** True when both weights recorded and loss (if any) is within the allowed band. */
export function isSessionWeightPairInRange(
  preKg: number,
  postKg: number,
  maxLossPercent: number = DEFAULT_MAX_SESSION_MASS_LOSS_PERCENT,
): boolean {
  if (preKg <= 0 || postKg <= 0) return false;
  const lossPct = sessionMassLossPercent(preKg, postKg);
  if (lossPct <= 0) return true;
  return lossPct <= maxLossPercent;
}

export type WeighPairStatus = 'in_range' | 'out_of_range' | 'incomplete';


export function weighPairRowStatus(
  preKg: number | undefined,
  postKg: number | undefined,
): WeighPairStatus {
  if (preKg == null || postKg == null) return 'incomplete';
  if (preKg <= 0 || postKg <= 0) return 'incomplete';
  return isSessionWeightPairInRange(preKg, postKg) ? 'in_range' : 'out_of_range';
}

/** Pre→post body mass change as % of pre (positive = mass lost). */
export function formatSessionMassLossPercentDisplay(
  preKg: number | undefined,
  postKg: number | undefined,
): { text: string; warn: boolean } {
  if (preKg == null || postKg == null || preKg <= 0 || postKg <= 0) {
    return { text: '—', warn: false };
  }
  const pct = sessionMassLossPercent(preKg, postKg);
  const text = `${pct.toFixed(1)}%`;
  const warn = pct > DEFAULT_MAX_SESSION_MASS_LOSS_PERCENT;
  return { text, warn };
}
