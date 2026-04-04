import type { WeighInPhase, WeighInRecord } from '@/domain/weighIn';
import { db } from './db';

export async function addWeighIn(input: {
  teamMemberId: string;
  matchId?: string;
  recordedAt: number;
  weightKg: number;
  phase: WeighInPhase;
}): Promise<WeighInRecord> {
  const now = Date.now();
  const row: WeighInRecord = {
    id: crypto.randomUUID(),
    teamMemberId: input.teamMemberId,
    matchId: input.matchId,
    recordedAt: input.recordedAt,
    weightKg: input.weightKg,
    phase: input.phase,
    createdAt: now,
  };
  await db.weighIns.put(row);
  return row;
}

export async function listWeighInsForMember(teamMemberId: string): Promise<WeighInRecord[]> {
  const rows = await db.weighIns.where('teamMemberId').equals(teamMemberId).toArray();
  return rows.sort((a, b) => b.recordedAt - a.recordedAt);
}

export async function listWeighInsForTeam(teamId: string): Promise<WeighInRecord[]> {
  const members = await db.teamMembers.where('teamId').equals(teamId).toArray();
  const ids = new Set(members.map((m) => m.id));
  const all = await db.weighIns.toArray();
  return all.filter((w) => ids.has(w.teamMemberId)).sort((a, b) => b.recordedAt - a.recordedAt);
}

export async function deleteWeighIn(id: string): Promise<void> {
  await db.weighIns.delete(id);
}
