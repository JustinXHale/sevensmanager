import { db } from './db';
import { getOrCreateDefaultCompetitionId } from './competitionsRepo';
import { seedSevensTeamMembers } from './teamMembersRepo';

/** Link legacy matches with no competitionId to the system default competition. */
export async function migrateMatchesToDefaultCompetition(): Promise<void> {
  const compId = await getOrCreateDefaultCompetitionId();
  const rows = await db.matches.toArray();
  for (const m of rows) {
    if (m.competitionId) continue;
    await db.matches.put({
      ...m,
      competitionId: compId,
      competition: m.competition?.trim() || 'General',
      updatedAt: Date.now(),
    });
  }
}

/** Teams created before auto-roster: add jersey slots 1–13 when empty. */
export async function migrateTeamMembersSevensSeed(): Promise<void> {
  const teams = await db.teams.toArray();
  for (const t of teams) {
    const n = await db.teamMembers.where('teamId').equals(t.id).count();
    if (n === 0) {
      await seedSevensTeamMembers(t.id);
    }
  }
}

/**
 * Matches created before `teamId` existed are invisible on team landing. Link them to a team
 * named "Ragamuffin" (case-insensitive) when unambiguous: one such team globally, or exactly
 * one whose competition matches the match's `competitionId`.
 */
export async function migrateOrphanMatchesToRagamuffinTeam(): Promise<void> {
  const targetName = 'ragamuffin';
  const teams = await db.teams.toArray();
  const ragTeams = teams.filter((t) => t.name.trim().toLowerCase() === targetName);
  if (ragTeams.length === 0) return;

  const rows = await db.matches.toArray();
  const now = Date.now();

  for (const m of rows) {
    if (m.teamId) continue;

    let teamId: string | undefined;
    if (ragTeams.length === 1) {
      teamId = ragTeams[0]!.id;
    } else {
      const byComp = ragTeams.filter((t) => t.competitionId === m.competitionId);
      if (byComp.length === 1) teamId = byComp[0]!.id;
    }

    if (teamId == null) continue;

    await db.matches.put({
      ...m,
      teamId,
      updatedAt: now,
    });
  }
}

export async function runDataMigrations(): Promise<void> {
  await migrateMatchesToDefaultCompetition();
  await migrateOrphanMatchesToRagamuffinTeam();
  await migrateTeamMembersSevensSeed();
}
