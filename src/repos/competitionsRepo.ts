import type { CompetitionRecord } from '@/domain/competition';
import { db } from './db';
import { deleteTeamCascade } from './teamsRepo';

const META_DEFAULT_COMPETITION = 'systemDefaultCompetitionId';

/**
 * Stable default bucket for legacy matches and imports. Id stored in meta; recreates if missing.
 */
export async function getOrCreateDefaultCompetitionId(): Promise<string> {
  const row = await db.meta.get(META_DEFAULT_COMPETITION);
  const existingId = typeof row?.value === 'string' ? row.value : null;
  if (existingId) {
    const c = await db.competitions.get(existingId);
    if (c) return existingId;
  }
  const now = Date.now();
  const rec: CompetitionRecord = {
    id: crypto.randomUUID(),
    name: 'General',
    createdAt: now,
    updatedAt: now,
  };
  await db.competitions.put(rec);
  await db.meta.put({ key: META_DEFAULT_COMPETITION, value: rec.id });
  return rec.id;
}

export type CreateCompetitionInput = {
  name: string;
  clubId?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
};

export async function createCompetition(nameOrInput: string | CreateCompetitionInput, clubId?: string): Promise<CompetitionRecord> {
  const input: CreateCompetitionInput =
    typeof nameOrInput === 'string' ? { name: nameOrInput, clubId } : nameOrInput;
  const now = Date.now();
  const row: CompetitionRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Untitled competition',
    ...(input.clubId ? { clubId: input.clubId } : {}),
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.competitions.put(row);
  return row;
}

export async function listCompetitions(): Promise<CompetitionRecord[]> {
  const rows = await db.competitions.toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listCompetitionsForClub(clubId: string): Promise<CompetitionRecord[]> {
  const rows = await db.competitions.where('clubId').equals(clubId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCompetition(id: string): Promise<CompetitionRecord | undefined> {
  return db.competitions.get(id);
}

export async function updateCompetition(
  id: string,
  patch: { name?: string; startDate?: string; endDate?: string; location?: string },
): Promise<void> {
  const row = await db.competitions.get(id);
  if (!row) return;
  const next: CompetitionRecord = {
    ...row,
    name: patch.name?.trim() || row.name,
    updatedAt: Date.now(),
  };
  if (patch.startDate !== undefined) next.startDate = patch.startDate || undefined;
  if (patch.endDate !== undefined) next.endDate = patch.endDate || undefined;
  if (patch.location !== undefined) next.location = patch.location.trim() || undefined;
  await db.competitions.put(next);
}

export async function deleteCompetition(id: string): Promise<void> {
  const teamRows = await db.teams.where('competitionId').equals(id).toArray();
  for (const t of teamRows) {
    await deleteTeamCascade(t.id);
  }
  const linked = await db.matches.where('competitionId').equals(id).toArray();
  for (const m of linked) {
    await db.matches.put({ ...m, competitionId: undefined, updatedAt: Date.now() });
  }
  await db.competitions.delete(id);
}
