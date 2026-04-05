/** Tournament / competition container (admin hierarchy). */
export interface CompetitionRecord {
  id: string;
  name: string;
  /** When set, this competition belongs to a landing club (team picker). */
  clubId?: string;
  /** Start date ISO string (YYYY-MM-DD). */
  startDate?: string;
  /** End date ISO string (YYYY-MM-DD). Omit for single-day events. */
  endDate?: string;
  /** City / venue location (e.g. "Austin, TX"). */
  location?: string;
  createdAt: number;
  updatedAt: number;
}

/** Format competition date(s) for display. */
export function formatCompetitionDateLabel(rec: CompetitionRecord): string | undefined {
  if (!rec.startDate) return undefined;
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y!, m! - 1, d!);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const start = fmt(rec.startDate);
  if (!rec.endDate || rec.endDate === rec.startDate) return start;
  const [sy, sm] = rec.startDate.split('-').map(Number);
  const [ey, em] = rec.endDate.split('-').map(Number);
  if (sy === ey && sm === em) {
    const endDay = new Date(ey!, em! - 1, Number(rec.endDate.split('-')[2]));
    return `${start.replace(/,\s*\d{4}$/, '')}–${endDay.getDate()}, ${ey}`;
  }
  return `${start} – ${fmt(rec.endDate)}`;
}
