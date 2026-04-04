import type { PlayerRecord, PlayerStatus, SubstitutionRecord } from '@/domain/player';
import { ON_FIELD_MAX, SQUAD_MAX } from '@/domain/player';
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

/**
 * Copy team roster names and teamMemberId into match players by jersey number (1–{SQUAD_MAX}).
 * Only fills `PlayerRecord.name` when it is empty and the linked team member has a non-empty name
 * (preserves names edited on the match roster). Always sets `teamMemberId` when a member matches.
 */
export async function syncMatchPlayerNamesFromTeam(teamId: string, matchId: string): Promise<void> {
  const members = await listTeamMembers(teamId);
  const byNumber = new Map<number, { name: string; memberId: string }>();
  for (const m of members) {
    if (m.number == null || m.number < 1 || m.number > SQUAD_MAX) continue;
    byNumber.set(m.number, { name: m.name.trim(), memberId: m.id });
  }
  if (byNumber.size === 0) return;

  const rows = await db.players.where('matchId').equals(matchId).toArray();
  await db.transaction('rw', db.players, async () => {
    for (const p of rows) {
      const num = p.number;
      if (num == null || num < 1 || num > SQUAD_MAX) continue;
      const member = byNumber.get(num);
      if (!member) continue;
      const current = (normalizeRow(p as PlayerRecord & { onField?: boolean }).name ?? '').trim();
      const patch: Partial<PlayerRecord> = { teamMemberId: member.memberId };
      if (current === '' && member.name) patch.name = member.name;
      await db.players.update(p.id, patch);
    }
  });
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
