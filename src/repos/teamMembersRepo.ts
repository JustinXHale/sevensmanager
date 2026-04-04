import type { TeamMemberRecord } from '@/domain/teamMember';
import { SQUAD_MAX } from '@/domain/player';
import { db } from './db';

/** Jersey slots 1–13 (same as match Tech Zone seed). Idempotent if team already has members. */
export async function seedSevensTeamMembers(teamId: string): Promise<void> {
  const count = await db.teamMembers.where('teamId').equals(teamId).count();
  if (count > 0) return;
  const now = Date.now();
  await db.transaction('rw', db.teamMembers, async () => {
    for (let n = 1; n <= SQUAD_MAX; n++) {
      const row: TeamMemberRecord = {
        id: crypto.randomUUID(),
        teamId,
        name: '',
        number: n,
        createdAt: now,
        updatedAt: now,
      };
      await db.teamMembers.add(row);
    }
  });
}

export async function createTeamMember(
  teamId: string,
  input: { name: string; number?: number | null; notes?: string },
): Promise<TeamMemberRecord> {
  const now = Date.now();
  const row: TeamMemberRecord = {
    id: crypto.randomUUID(),
    teamId,
    name: (input.name ?? '').trim(),
    number: input.number ?? null,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.teamMembers.put(row);
  return row;
}

export async function listTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
  const rows = await db.teamMembers.where('teamId').equals(teamId).toArray();
  return rows.sort((a, b) => {
    const an = a.number ?? 999;
    const bn = b.number ?? 999;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export async function getTeamMember(id: string): Promise<TeamMemberRecord | undefined> {
  return db.teamMembers.get(id);
}

export async function updateTeamMember(
  id: string,
  patch: Partial<Pick<TeamMemberRecord, 'name' | 'number' | 'notes'>>,
): Promise<void> {
  const row = await db.teamMembers.get(id);
  if (!row) return;
  await db.teamMembers.put({
    ...row,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : row.name,
    number: patch.number !== undefined ? patch.number : row.number,
    notes: patch.notes !== undefined ? patch.notes?.trim() || undefined : row.notes,
    updatedAt: Date.now(),
  });
}

export async function deleteTeamMember(id: string): Promise<void> {
  await db.transaction('rw', db.teamMembers, db.weighIns, async () => {
    await db.weighIns.where('teamMemberId').equals(id).delete();
    await db.teamMembers.delete(id);
  });
}
