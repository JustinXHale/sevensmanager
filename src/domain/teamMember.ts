/** Squad member for conditioning / admin (separate from match-scoped PlayerRecord). */
export interface TeamMemberRecord {
  id: string;
  teamId: string;
  name: string;
  /** Jersey number; optional for admin-only tracking. */
  number: number | null;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** List label: `#4 Alex` or `#4` when name still empty (seed slots). */
export function formatTeamMemberLabel(m: Pick<TeamMemberRecord, 'name' | 'number'>): string {
  const num = m.number != null ? `#${m.number}` : '';
  const nm = m.name.trim();
  if (num && nm) return `${num} ${nm}`;
  if (nm) return nm;
  if (num) return num;
  return '—';
}
