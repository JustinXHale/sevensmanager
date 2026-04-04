import type { ClubRecord } from '@/domain/club';
import { db } from './db';
import { deleteCompetition } from './competitionsRepo';

export type CreateClubInput = {
  name: string;
  nickname: string;
  abbreviation: string;
  logoDataUrl?: string;
};

export async function createClub(input: CreateClubInput): Promise<ClubRecord> {
  const now = Date.now();
  const row: ClubRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Untitled team',
    nickname: input.nickname.trim() || input.name.trim() || 'Team',
    abbreviation: input.abbreviation.trim().slice(0, 8).toUpperCase() || 'TM',
    ...(input.logoDataUrl ? { logoDataUrl: input.logoDataUrl } : {}),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.clubs.put(row);
  } catch (e) {
    if (e && typeof e === 'object' && (e as { name?: string }).name === 'QuotaExceededError') {
      throw new Error('Storage is full or this image is too large. Try another photo or free browser storage.');
    }
    throw e;
  }
  return row;
}

export async function listClubs(): Promise<ClubRecord[]> {
  const rows = await db.clubs.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function getClub(id: string): Promise<ClubRecord | undefined> {
  return db.clubs.get(id);
}

export type UpdateClubInput = {
  name: string;
  nickname: string;
  abbreviation: string;
  /** `keep` = leave existing image; `remove` = clear logo; otherwise new data URL. */
  logo: 'keep' | 'remove' | string;
};

export async function updateClub(id: string, patch: UpdateClubInput): Promise<ClubRecord> {
  const row = await db.clubs.get(id);
  if (!row) {
    throw new Error('Team not found.');
  }
  const now = Date.now();
  const next: ClubRecord = {
    ...row,
    name: patch.name.trim() || row.name,
    nickname: patch.nickname.trim() || patch.name.trim() || row.nickname,
    abbreviation: patch.abbreviation.trim().slice(0, 8).toUpperCase() || row.abbreviation,
    updatedAt: now,
  };
  if (patch.logo === 'remove') {
    delete next.logoDataUrl;
  } else if (patch.logo !== 'keep') {
    next.logoDataUrl = patch.logo;
  }
  try {
    await db.clubs.put(next);
  } catch (e) {
    if (e && typeof e === 'object' && (e as { name?: string }).name === 'QuotaExceededError') {
      throw new Error('Storage is full or this image is too large. Try another photo or free browser storage.');
    }
    throw e;
  }
  return next;
}

/** Deletes all competitions for this club, then the club row. */
export async function deleteClubCascade(clubId: string): Promise<void> {
  const comps = await db.competitions.where('clubId').equals(clubId).toArray();
  for (const c of comps) {
    await deleteCompetition(c.id);
  }
  await db.clubs.delete(clubId);
}
