import type { PlayerRecord, PlayerStatus, SubstitutionRecord } from '@/domain/player';
import { ON_FIELD_MAX, SQUAD_MAX } from '@/domain/player';
import type { TeamMemberRecord } from '@/domain/teamMember';
import { sortPlayersRefLogStyle } from '@/domain/rosterDisplay';
import { listTeamMembers } from './teamMembersRepo';
import { db } from './db';

function statusFrom(raw: unknown, legacyOnField?: boolean): PlayerStatus {
  if (raw === 'on' || raw === 'bench' || raw === 'off') return raw;
  if (typeof legacyOnField === 'boolean') return legacyOnField ? 'on' : 'bench';
  return 'bench';
}

/** Normalize rows that predate `status` (defensive). */
function normalizeRow(r: PlayerRecord & { onField?: boolean }): PlayerRecord {
  return {
    id: r.id,
    matchId: r.matchId,
    name: r.name ?? '',
    number: r.number ?? null,
    status: statusFrom(r.status, r.onField),
    teamMemberId: r.teamMemberId,
    createdAt: r.createdAt,
  };
}

export async function listPlayers(matchId: string, sortByStatus = true): Promise<PlayerRecord[]> {
  const rows = await db.players.where('matchId').equals(matchId).toArray();
  const normalized = rows.map(normalizeRow);
  const byId = new Map<string, PlayerRecord>();
  for (const p of normalized) {
    byId.set(p.id, p);
  }
  return sortPlayersRefLogStyle([...byId.values()], sortByStatus);
}

export async function getPlayer(id: string): Promise<PlayerRecord | undefined> {
  const r = await db.players.get(id);
  return r ? normalizeRow(r as PlayerRecord & { onField?: boolean }) : undefined;
}

/** Seed 1–13 with 7 on / 6 bench (RefLog Tech Zone sevens). Call inside match creation tx. */
export async function seedSevensRosterForNewMatch(matchId: string): Promise<void> {
  for (let n = 1; n <= SQUAD_MAX; n++) {
    const row: PlayerRecord = {
      id: crypto.randomUUID(),
      matchId,
      name: '',
      number: n,
      status: n <= ON_FIELD_MAX ? 'on' : 'bench',
      createdAt: Date.now(),
    };
    await db.players.add(row);
  }
}

type RosterSyncCounters = { on: number; bench: number };

/** Default on/bench/off for a new match player derived from admin jersey (1–7 on, 8–13 bench). */
export function initialStatusForTeamMember(
  member: Pick<TeamMemberRecord, 'number'>,
  counters: RosterSyncCounters,
): PlayerStatus {
  const n = member.number;
  if (n != null && n >= 1 && n <= ON_FIELD_MAX && counters.on < ON_FIELD_MAX) {
    counters.on += 1;
    return 'on';
  }
  if (n != null && n >= 1 && n <= SQUAD_MAX && counters.on + counters.bench < SQUAD_MAX) {
    counters.bench += 1;
    return 'bench';
  }
  if (counters.on < ON_FIELD_MAX) {
    counters.on += 1;
    return 'on';
  }
  if (counters.on + counters.bench < SQUAD_MAX) {
    counters.bench += 1;
    return 'bench';
  }
  return 'off';
}

function sortMembersForRoster(members: TeamMemberRecord[]): TeamMemberRecord[] {
  return [...members].sort((a, b) => {
    const an = a.number ?? 9999;
    const bn = b.number ?? 9999;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Build / refresh the match roster from the team admin master roster.
 * One `PlayerRecord` per `TeamMemberRecord` (linked by `teamMemberId`).
 * Jerseys 1–7 start on field, 8–13 on bench (for new rows only when `preserveStatus` is true).
 */
export async function syncMatchRosterFromTeam(
  teamId: string,
  matchId: string,
  options: { preserveStatus?: boolean } = {},
): Promise<void> {
  const preserveStatus = options.preserveStatus ?? true;
  const members = await listTeamMembers(teamId);
  if (members.length === 0) {
    await ensureSevensRoster(matchId);
    return;
  }

  const existing = (await db.players.where('matchId').equals(matchId).toArray()).map((p) =>
    normalizeRow(p as PlayerRecord & { onField?: boolean }),
  );
  const byMemberId = new Map<string, PlayerRecord>();
  const byNumber = new Map<number, PlayerRecord>();
  for (const p of existing) {
    if (p.teamMemberId) byMemberId.set(p.teamMemberId, p);
    if (p.number != null && !byNumber.has(p.number)) byNumber.set(p.number, p);
  }

  const memberIds = new Set(members.map((m) => m.id));
  const claimedPlayerIds = new Set<string>();
  const sorted = sortMembersForRoster(members);
  const assignCounters: RosterSyncCounters = preserveStatus
    ? {
        on: existing.filter((p) => p.status === 'on').length,
        bench: existing.filter((p) => p.status === 'bench').length,
      }
    : { on: 0, bench: 0 };

  await db.transaction('rw', db.players, async () => {
    for (const m of sorted) {
      let player =
        byMemberId.get(m.id) ??
        (m.number != null ? byNumber.get(m.number) : undefined);

      const name = m.name.trim();
      const number = m.number;

      if (player) {
        claimedPlayerIds.add(player.id);
        if (player.teamMemberId) byMemberId.set(player.teamMemberId, player);
        await db.players.update(player.id, {
          teamMemberId: m.id,
          name,
          number,
        });
        if (number != null) byNumber.set(number, { ...player, teamMemberId: m.id, name, number });
        continue;
      }

      const status = initialStatusForTeamMember(m, assignCounters);
      const row: PlayerRecord = {
        id: crypto.randomUUID(),
        matchId,
        name,
        number,
        status,
        teamMemberId: m.id,
        createdAt: Date.now(),
      };
      await db.players.add(row);
      claimedPlayerIds.add(row.id);
      byMemberId.set(m.id, row);
      if (number != null) byNumber.set(number, row);
    }

    for (const p of existing) {
      if (p.teamMemberId && !memberIds.has(p.teamMemberId)) {
        await db.players.delete(p.id);
        continue;
      }
      if (claimedPlayerIds.has(p.id)) continue;
      const isEmptySeed = !p.teamMemberId && !(p.name ?? '').trim();
      if (isEmptySeed) {
        await db.players.delete(p.id);
      }
    }
  });
}

/** @deprecated Use {@link syncMatchRosterFromTeam}. */
export async function syncMatchPlayerNamesFromTeam(teamId: string, matchId: string): Promise<void> {
  await syncMatchRosterFromTeam(teamId, matchId);
}

/**
 * Backfill missing jersey slots 1–13 (legacy / partial rosters). Does not remove extras.
 */
export async function ensureSevensRoster(matchId: string): Promise<void> {
  const existing = await db.players.where('matchId').equals(matchId).toArray();
  const taken = new Set(
    existing.map((p) => p.number).filter((n): n is number => typeof n === 'number' && n >= 1 && n <= SQUAD_MAX),
  );
  if (existing.length === 0) {
    await seedSevensRosterForNewMatch(matchId);
    return;
  }
  if (taken.size >= SQUAD_MAX) return;

  await db.transaction('rw', db.players, async () => {
    let onCount = existing.filter((p) => normalizeRow(p as PlayerRecord & { onField?: boolean }).status === 'on').length;
    for (let n = 1; n <= SQUAD_MAX; n++) {
      if (taken.has(n)) continue;
      const status: PlayerStatus = onCount < ON_FIELD_MAX ? 'on' : 'bench';
      if (status === 'on') onCount++;
      const row: PlayerRecord = {
        id: crypto.randomUUID(),
        matchId,
        name: '',
        number: n,
        status,
        createdAt: Date.now(),
      };
      await db.players.add(row);
      taken.add(n);
    }
  });
}

export async function updatePlayerName(playerId: string, name: string): Promise<void> {
  await db.players.update(playerId, { name: name.trim() });
}

export async function updatePlayerStatus(
  playerId: string,
  next: PlayerStatus,
): Promise<'ok' | 'toomanyon' | 'missing'> {
  const p = await db.players.get(playerId);
  if (!p) return 'missing';
  const row = normalizeRow(p as PlayerRecord & { onField?: boolean });
  if (next === row.status) return 'ok';
  const all = await db.players.where('matchId').equals(row.matchId).toArray();
  const onCount = all.filter((x) => normalizeRow(x as PlayerRecord & { onField?: boolean }).status === 'on').length;
  if (next === 'on' && row.status !== 'on' && onCount >= ON_FIELD_MAX) {
    return 'toomanyon';
  }
  await db.players.update(playerId, { status: next });
  return 'ok';
}

export async function removePlayer(playerId: string): Promise<void> {
  const p = await db.players.get(playerId);
  if (!p) return;
  const matchId = p.matchId;
  await db.players.delete(playerId);
  await ensureSevensRoster(matchId);
}

export async function recordSubstitution(
  matchId: string,
  playerOffId: string,
  playerOnId: string,
  matchTimeMs: number,
  period: number,
): Promise<'ok' | 'invalid'> {
  const players = await db.players.where('matchId').equals(matchId).toArray();
  const mapped = players.map((x) => normalizeRow(x as PlayerRecord & { onField?: boolean }));
  const off = mapped.find((p) => p.id === playerOffId);
  const on = mapped.find((p) => p.id === playerOnId);
  if (!off || !on) return 'invalid';
  if (off.status !== 'on') return 'invalid';
  if (on.status !== 'bench' && on.status !== 'off') return 'invalid';
  const id = crypto.randomUUID();
  const sub: SubstitutionRecord = {
    id,
    matchId,
    matchTimeMs,
    period,
    playerOffId,
    playerOnId,
    createdAt: Date.now(),
  };
  await db.transaction('rw', db.players, db.substitutions, async () => {
    await db.players.update(off.id, { status: 'off' });
    await db.players.update(on.id, { status: 'on' });
    await db.substitutions.put(sub);
  });
  return 'ok';
}

export async function listSubstitutions(matchId: string): Promise<SubstitutionRecord[]> {
  const rows = await db.substitutions.where('matchId').equals(matchId).toArray();
  return rows.sort((a, b) => a.matchTimeMs - b.matchTimeMs);
}
