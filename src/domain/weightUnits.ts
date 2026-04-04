/** US/UK lb display; storage remains kg in IndexedDB. */
const LB_PER_KG = 2.2046226218;

/** Pounds are shown and entered with at most this many fractional digits. */
export const LB_DECIMAL_PLACES = 2;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Round pounds to two decimal places (half-up). */
export function roundLb(lb: number): number {
  return Math.round(lb * 100) / 100;
}

/**
 * String for inputs / tables: lb from stored kg, never more than two decimal places.
 */
export function formatLbStringFromKg(kg: number): string {
  const lb = roundLb(kgToLb(kg));
  return parseFloat(lb.toFixed(LB_DECIMAL_PLACES)).toString();
}

/** Human-readable label, e.g. "175.4 lb". */
export function formatWeightLbFromKg(kg: number): string {
  const lb = roundLb(kgToLb(kg));
  return `${parseFloat(lb.toFixed(LB_DECIMAL_PLACES))} lb`;
}

/** Parse user input like "174.5" or "174,5" → kg, or null. Values are rounded to two lb decimals before storing. */
export function parseWeightLbToKg(input: string): number | null {
  const t = input.trim().replace(/,/g, '.');
  if (!t) return null;
  const lbRaw = Number.parseFloat(t);
  if (!Number.isFinite(lbRaw) || lbRaw <= 0 || lbRaw > 500) return null;
  const lb = roundLb(lbRaw);
  if (lb <= 0 || lb > 500) return null;
  return lbToKg(lb);
}
