import type { AttackingPlayRecord } from '@/domain/attackingPlay';
import { createDefaultAttackingPlayDocument, normalizePlayDocumentV2 } from '@/domain/attackingPlay';
import { db } from '@/repos/db';

export type { AttackingPlayRecord } from '@/domain/attackingPlay';

export async function listAttackingPlays(): Promise<AttackingPlayRecord[]> {
  const rows = await db.attackingPlays.orderBy('updatedAt').reverse().toArray();
  return rows;
}

export async function getAttackingPlay(id: string): Promise<AttackingPlayRecord | undefined> {
  return db.attackingPlays.get(id);
}

export async function createAttackingPlay(name?: string): Promise<AttackingPlayRecord> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const document = normalizePlayDocumentV2(createDefaultAttackingPlayDocument(name ?? 'Untitled play'));
  const row: AttackingPlayRecord = { id, createdAt: now, updatedAt: now, document };
  await db.attackingPlays.add(row);
  return row;
}

export async function saveAttackingPlay(record: AttackingPlayRecord): Promise<void> {
  const updatedAt = Date.now();
  const document = normalizePlayDocumentV2(record.document);
  await db.attackingPlays.put({ ...record, document, updatedAt });
}

export async function deleteAttackingPlay(id: string): Promise<void> {
  await db.attackingPlays.delete(id);
}
