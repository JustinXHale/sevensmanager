import Dexie, { type Table } from 'dexie';
import type { ClubRecord } from '@/domain/club';
import type { CompetitionRecord } from '@/domain/competition';
import type { DayScheduleItemRecord } from '@/domain/daySchedule';
import type { MatchRecord, MatchSessionRecord } from '@/domain/match';
import type { MatchEventRecord } from '@/domain/matchEvent';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import type { TeamRecord } from '@/domain/team';
import type { TeamMemberRecord } from '@/domain/teamMember';
import type { WeighInRecord } from '@/domain/weighIn';

/** Single-row meta: schema version and future flags. */
export interface MetaRow {
  key: string;
  value: unknown;
}

/** v7: clubs (landing team picker), competitions optional clubId. */
export const SCHEMA_VERSION = 7;

/**
 * IndexedDB database. Version bumps run migrations in upgrade handlers.
 */
export class SevensManagerDb extends Dexie {
  meta!: Table<MetaRow, string>;
  matches!: Table<MatchRecord, string>;
  matchSessions!: Table<MatchSessionRecord, string>;
  players!: Table<PlayerRecord, string>;
  substitutions!: Table<SubstitutionRecord, string>;
  matchEvents!: Table<MatchEventRecord, string>;
  clubs!: Table<ClubRecord, string>;
  competitions!: Table<CompetitionRecord, string>;
  teams!: Table<TeamRecord, string>;
  teamMembers!: Table<TeamMemberRecord, string>;
  weighIns!: Table<WeighInRecord, string>;
  dayScheduleItems!: Table<DayScheduleItemRecord, string>;

  constructor() {
    super('sevensmanager');
    this.version(1).stores({
      meta: 'key',
    });
    this.version(2).stores({
      meta: 'key',
      matches: 'id, createdAt, kickoffDate, title, competition',
      matchSessions: 'matchId',
    });
    this.version(3).stores({
      meta: 'key',
      matches: 'id, createdAt, kickoffDate, title, competition',
      matchSessions: 'matchId',
      players: 'id, matchId, number, onField',
      substitutions: 'id, matchId, matchTimeMs',
    });
    this.version(4)
      .stores({
        meta: 'key',
        matches: 'id, createdAt, kickoffDate, title, competition',
        matchSessions: 'matchId',
        players: 'id, matchId, number, status',
        substitutions: 'id, matchId, matchTimeMs',
      })
      .upgrade(async (tx) => {
        const t = tx.table('players');
        await t.toCollection().modify((raw: Record<string, unknown>) => {
          if (raw.status == null) {
            raw.status = raw.onField === true ? 'on' : 'bench';
          }
          delete raw.onField;
        });
      });
    this.version(5).stores({
      meta: 'key',
      matches: 'id, createdAt, kickoffDate, title, competition',
      matchSessions: 'matchId',
      players: 'id, matchId, number, status',
      substitutions: 'id, matchId, matchTimeMs',
      matchEvents: 'id, matchId, matchTimeMs, kind, createdAt',
    });
    this.version(6).stores({
      meta: 'key',
      matches: 'id, createdAt, kickoffDate, title, competition, competitionId, teamId',
      matchSessions: 'matchId',
      players: 'id, matchId, number, status',
      substitutions: 'id, matchId, matchTimeMs',
      matchEvents: 'id, matchId, matchTimeMs, kind, createdAt',
      competitions: 'id, createdAt, name',
      teams: 'id, competitionId, name, createdAt',
      teamMembers: 'id, teamId, number',
      weighIns: 'id, teamMemberId, recordedAt, matchId',
      dayScheduleItems: 'id, teamId, dayDate, sortIndex',
    });
    this.version(7)
      .stores({
        meta: 'key',
        matches: 'id, createdAt, kickoffDate, title, competition, competitionId, teamId',
        matchSessions: 'matchId',
        players: 'id, matchId, number, status',
        substitutions: 'id, matchId, matchTimeMs',
        matchEvents: 'id, matchId, matchTimeMs, kind, createdAt',
        competitions: 'id, createdAt, name, clubId',
        clubs: 'id, createdAt, name',
        teams: 'id, competitionId, name, createdAt',
        teamMembers: 'id, teamId, number',
        weighIns: 'id, teamMemberId, recordedAt, matchId',
        dayScheduleItems: 'id, teamId, dayDate, sortIndex',
      })
      .upgrade(async (tx) => {
        const clubsTable = tx.table('clubs');
        const compsTable = tx.table('competitions');
        const existingClubs = await clubsTable.count();
        const comps = await compsTable.toArray();
        if (existingClubs === 0 && comps.length > 0) {
          const now = Date.now();
          const clubId = crypto.randomUUID();
          await clubsTable.add({
            id: clubId,
            name: 'My teams',
            nickname: 'Home',
            abbreviation: 'HOME',
            createdAt: now,
            updatedAt: now,
          });
          for (const c of comps) {
            const raw = c as { id: string; clubId?: string };
            if (raw.clubId == null) {
              await compsTable.update(raw.id, { clubId });
            }
          }
        }
      });
  }
}

export const db = new SevensManagerDb();

/** Open DB and ensure schema version meta exists. */
export async function initPersistence(): Promise<void> {
  await db.open();
  await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  const { runDataMigrations } = await import('./migrations');
  await runDataMigrations();
}

export async function getPersistedSchemaVersion(): Promise<number> {
  const row = await db.meta.get('schemaVersion');
  return typeof row?.value === 'number' ? row.value : SCHEMA_VERSION;
}
