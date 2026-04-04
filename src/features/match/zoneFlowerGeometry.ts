import { FIELD_LENGTH_BAND_IDS, type FieldLengthBandId } from '@/domain/matchEvent';
import { ZONE_IDS, type ZoneId } from '@/domain/zone';

/**
 * Upper semicircle (180°): pointer must be in the upper half-plane (dy < -minDy) from center.
 * P1/Z1 at the left end of the arc, P6/Z6 at the right (team-relative width along the pitch).
 */
export function zoneIndexFromPointerSemicircle6(
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
  minRadiusPx = 28,
  minDyPx = 4,
): number | null {
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const dist = Math.hypot(dx, dy);
  if (dist < minRadiusPx) return null;
  if (dy > -minDyPx) return null;
  const theta = Math.atan2(dy, dx);
  if (theta >= 0 || theta <= -Math.PI) return null;
  const u = (theta + Math.PI) / Math.PI;
  return Math.min(5, Math.floor(u * 6));
}

/** Same geometry as level 1; four bands: own 22 → own half → opp half → opp 22 (left → right). */
export function bandIndexFromPointerSemicircle4(
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
  minRadiusPx = 28,
  minDyPx = 4,
): number | null {
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const dist = Math.hypot(dx, dy);
  if (dist < minRadiusPx) return null;
  if (dy > -minDyPx) return null;
  const theta = Math.atan2(dy, dx);
  if (theta >= 0 || theta <= -Math.PI) return null;
  const u = (theta + Math.PI) / Math.PI;
  return Math.min(3, Math.floor(u * 4));
}

export function zoneIdFromIndex(i: number): ZoneId {
  return ZONE_IDS[Math.max(0, Math.min(5, i))]!;
}

export function fieldLengthBandIdFromIndex(i: number): FieldLengthBandId {
  return FIELD_LENGTH_BAND_IDS[Math.max(0, Math.min(3, i))]!;
}

/**
 * Pixel offset from center for pill `i` of `n` along the **upper** semicircle (screen +y down).
 * Arc opens upward from the anchor point.
 */
export function semicirclePillOffset(i: number, n: number, rPx: number): { x: number; y: number } {
  const thetaMid = -Math.PI + (i + 0.5) * (Math.PI / n);
  return { x: Math.cos(thetaMid) * rPx, y: Math.sin(thetaMid) * rPx };
}
