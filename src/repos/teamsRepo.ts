import type { TeamRecord } from '@/domain/team';
import { db } from './db';
import { seedSevensTeamMembers } from './teamMembersRepo';

export async function createTeam(competitionId: string, name: string): Promise<TeamRecord> {
  const now = Date.now();
  const row: TeamRecord = {
    id: crypto.randomUUID(),
    competitionId,
    name: name.trim() || 'Untitled team',
    createdAt: now,
    updatedAt: now,
  };
  await db.teams.put(row);
  await seedSevensTeamMembers(row.id);
  return row;
}

export async function listTeamsForCompetition(competitionId: string): Promise<TeamRecord[]> {
  const rows = await db.teams.where('competitionId').equals(competitionId).toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function getTeam(id: string): Promise<TeamRecord | undefined> {
  return db.teams.get(id);
}

export async function updateTeam(id: string, name: string): Promise<void> {
  const row = await db.teams.get(id);
  if (!row) return;
  await db.teams.put({ ...row, name: name.trim() || row.name, updatedAt: Date.now() });
}

/** Removes members, weigh-ins, schedule items, and clears match.teamId for linked matches. */
export async function deleteTeamCascade(teamId: string): Promise<void> {
  const memberIds = (await db.teamMembers.where('teamId').equals(teamId).toArray()).map((m) => m.id);
  for (const mid of memberIds) {
    await db.weighIns.where('teamMemberId').equals(mid).delete();
  }
  await db.teamMembers.where('teamId').equals(teamId).delete();
  await db.dayScheduleItems.where('teamId').equals(teamId).delete();
  const matches = await db.matches.where('teamId').equals(teamId).toArray();
  for (const m of matches) {
    await db.matches.put({ ...m, teamId: undefined, updatedAt: Date.now() });
  }
  await db.teams.delete(teamId);
}
