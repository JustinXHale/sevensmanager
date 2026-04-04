/** Single block on a team’s gameday timeline (local calendar day). */
export type DayScheduleKind = 'meal' | 'warmup' | 'match' | 'other';

export interface DayScheduleItemRecord {
  id: string;
  teamId: string;
  /** Calendar day in local YYYY-MM-DD. */
  dayDate: string;
  /** Order within the day (drag reorder not required for v1). */
  sortIndex: number;
  /** Minutes from local midnight (0–1439). */
  startMinutes: number;
  /** Inclusive end; omit for point-in-time. */
  endMinutes?: number;
  label: string;
  kind: DayScheduleKind;
  createdAt: number;
  updatedAt: number;
}

export const DAY_SCHEDULE_KIND_LABEL: Record<DayScheduleKind, string> = {
  meal: 'Meal',
  warmup: 'Warm-up',
  match: 'Match / block',
  other: 'Other',
};

/** Format minutes-from-midnight as H:MM or HH:MM (24h). */
export function formatDayTimeMinutes(m: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(m)));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${h}:${min.toString().padStart(2, '0')}`;
}

/** Parse "H:MM" or "HH:MM" 24h → minutes from midnight. */
export function parseTimeToMinutes(s: string): number | null {
  const t = s.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Local calendar day YYYY-MM-DD. */
export function localDayDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${mo}-${day}`;
}
