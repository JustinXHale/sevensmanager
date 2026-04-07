import type { MatchRecord, MatchSessionRecord } from '@/domain/match';
import { defaultSessionForMatch, matchListSortKey, normalizeSession } from '@/domain/match';
import type { ScheduleImportRow } from '@/domain/scheduleImport';
import { getOrCreateDefaultCompetitionId } from './competitionsRepo';
import { getClub } from './clubsRepo';
import { clearRecentMatchIfStale } from '@/components/AppNavDrawer';
import { db } from './db';
import { seedSevensRosterForNewMatch, syncMatchPlayerNamesFromTeam } from './rosterRepo';
import { getTeam } from './teamsRepo';

export type CreateMatchInput = {
  title?: string;
  ourTeamName?: string;
  opponentName?: string;
  ourAbbreviation?: string;
  opponentAbbreviation?: string;
  kickoffDate?: string;
  location?: string;
  competition?: string;
  competitionId?: string;
  teamId?: string;
};

function resolveMatchFields(input: CreateMatchInput): Omit<MatchRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const ourTeamName = input.ourTeamName?.trim() || undefined;
  const opponentName = input.opponentName?.trim() || undefined;
  const ourAbbreviation = input.ourAbbreviation?.trim().toUpperCase() || undefined;
  const opponentAbbreviation = input.opponentAbbreviation?.trim().toUpperCase() || undefined;
  const competition = input.competition?.trim() || undefined;
  const location = input.location?.trim() || undefined;
  let title = input.title?.trim() ?? '';
  if (!title) {
    if (ourTeamName && opponentName) title = `${ourTeamName} vs ${opponentName}`;
    else if (opponentName) title = `vs ${opponentName}`;
    else if (ourTeamName) title = ourTeamName;
    else title = 'Untitled match';
  }
  return {
    title,
    ourTeamName,
    opponentName,
    ourAbbreviation,
    opponentAbbreviation,
    kickoffDate: input.kickoffDate || undefined,
    location,
    competition,
    competitionId: input.competitionId,
    teamId: input.teamId,
  };
}

export async function createMatch(input: CreateMatchInput): Promise<MatchRecord> {
  const defaultCompId = await getOrCreateDefaultCompetitionId();
  const id = crypto.randomUUID();
  const now = Date.now();

  let ourAbbreviation = input.ourAbbreviation;
  if (!ourAbbreviation && input.teamId) {
    ourAbbreviation = await resolveClubAbbreviation(input.teamId);
  }

  const fields = resolveMatchFields({
    ...input,
    ourAbbreviation,
    competitionId: input.competitionId ?? defaultCompId,
  });
  const match: MatchRecord = {
    id,
    ...fields,
    createdAt: now,
    updatedAt: now,
  };
  const session = defaultSessionForMatch(id);

  await db.transaction('rw', db.matches, db.matchSessions, db.players, async () => {
    await db.matches.put(match);
    await db.matchSessions.put(session);
    await seedSevensRosterForNewMatch(id);
  });

  if (fields.teamId) {
    await syncMatchPlayerNamesFromTeam(fields.teamId, id);
  }

  return match;
}

async function resolveClubAbbreviation(teamId: string): Promise<string | undefined> {
  const team = await getTeam(teamId);
  if (!team) return undefined;
  const comp = await db.competitions.get(team.competitionId);
  if (!comp?.clubId) return undefined;
  const club = await getClub(comp.clubId);
  return club?.abbreviation;
}

/** Create many matches + sessions in one transaction (tournament schedule import). */
export async function createMatchesFromSchedule(rows: ScheduleImportRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const defaultCompId = await getOrCreateDefaultCompetitionId();
  const base = Date.now();
  await db.transaction('rw', db.matches, db.matchSessions, db.players, async () => {
    for (let i = 0; i < rows.length; i++) {
      const id = crypto.randomUUID();
      const fields = resolveMatchFields({
        ...rows[i]!,
        competitionId: defaultCompId,
      });
      const match: MatchRecord = {
        id,
        ...fields,
        createdAt: base + i,
        updatedAt: base + i,
      };
      await db.matches.put(match);
      await db.matchSessions.put(defaultSessionForMatch(id));
      await seedSevensRosterForNewMatch(id);
    }
  });
  return rows.length;
}

export async function listMatchesSorted(): Promise<MatchRecord[]> {
  const rows = await db.matches.toArray();
  return rows.sort((a, b) => matchListSortKey(b) - matchListSortKey(a));
}

export async function listMatchesForTeam(teamId: string): Promise<MatchRecord[]> {
  const rows = await db.matches.where('teamId').equals(teamId).toArray();
  return rows.sort((a, b) => matchListSortKey(b) - matchListSortKey(a));
}

export async function getMatch(id: string): Promise<MatchRecord | undefined> {
  return db.matches.get(id);
}

export async function updateMatch(
  id: string,
  patch: Partial<
    Pick<
      MatchRecord,
      | 'title'
      | 'ourTeamName'
      | 'opponentName'
      | 'ourAbbreviation'
      | 'opponentAbbreviation'
      | 'kickoffDate'
      | 'location'
      | 'competition'
      | 'competitionId'
      | 'teamId'
    >
  >,
): Promise<void> {
  const row = await db.matches.get(id);
  if (!row) return;
  const updated: MatchRecord = {
    ...row,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() || 'Untitled match' : row.title,
    ourTeamName: patch.ourTeamName?.trim() || undefined,
    opponentName: patch.opponentName?.trim() || undefined,
    ourAbbreviation: 'ourAbbreviation' in patch ? patch.ourAbbreviation?.trim().toUpperCase() || undefined : row.ourAbbreviation,
    opponentAbbreviation: 'opponentAbbreviation' in patch ? patch.opponentAbbreviation?.trim().toUpperCase() || undefined : row.opponentAbbreviation,
    kickoffDate: patch.kickoffDate || undefined,
    location: patch.location?.trim() || undefined,
    competition: patch.competition?.trim() || undefined,
    competitionId: 'competitionId' in patch ? patch.competitionId : row.competitionId,
    teamId: 'teamId' in patch ? patch.teamId : row.teamId,
    updatedAt: Date.now(),
  };
  await db.matches.put(updated);
}

export async function deleteMatch(id: string): Promise<void> {
  await db.matchEvents.where('matchId').equals(id).delete();
  await db.transaction('rw', db.matches, db.matchSessions, db.players, db.substitutions, async () => {
    await db.players.where('matchId').equals(id).delete();
    await db.substitutions.where('matchId').equals(id).delete();
    await db.matchSessions.delete(id);
    await db.matches.delete(id);
  });
  clearRecentMatchIfStale(id);
}

export async function getSession(matchId: string): Promise<MatchSessionRecord | undefined> {
  const raw = await db.matchSessions.get(matchId);
  return normalizeSession(raw);
}

export async function saveSession(session: MatchSessionRecord): Promise<void> {
  await db.matchSessions.put(session);
}
