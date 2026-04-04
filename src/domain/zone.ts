/** Long-axis zones, team-relative (attack toward opponent goal). See docs/PRODUCT_SPEC.md §5.2. */
export const ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export function isZoneId(value: string): value is ZoneId {
  return (ZONE_IDS as readonly string[]).includes(value);
}
