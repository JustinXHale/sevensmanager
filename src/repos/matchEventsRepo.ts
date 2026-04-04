import type {
  ConversionOutcome,
  FieldLengthBandId,
  MatchEventKind,
  MatchEventRecord,
  NegativeActionId,
  OffloadTone,
  PassVariant,
  PenaltyCard,
  PenaltyTypeId,
  PlayPhaseContext,
  SetPieceOutcome,
  TackleOutcome,
  TackleQuality,
} from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import { db } from './db';

export async function addMatchEvent(input: {
  matchId: string;
  kind: MatchEventKind;
  matchTimeMs: number;
  period: number;
  playerId?: string;
  penaltyType?: PenaltyTypeId;
  penaltyCard?: PenaltyCard;
  penaltyDetail?: string;
  tackleOutcome?: TackleOutcome;
  tackleQuality?: TackleQuality;
  offloadTone?: OffloadTone;
  passVariant?: PassVariant;
  precedingPassEventId?: string;
  zoneId?: ZoneId;
  fieldLengthBand?: FieldLengthBandId;
  setPieceOutcome?: SetPieceOutcome;
  playPhaseContext?: PlayPhaseContext;
  negativeActionId?: NegativeActionId;
  conversionOutcome?: ConversionOutcome;
}): Promise<MatchEventRecord> {
  const row: MatchEventRecord = {
    id: crypto.randomUUID(),
    matchId: input.matchId,
    kind: input.kind,
    matchTimeMs: input.matchTimeMs,
    period: input.period,
    createdAt: Date.now(),
    playerId: input.playerId,
    penaltyType: input.penaltyType,
    penaltyCard: input.penaltyCard,
    penaltyDetail: input.penaltyDetail,
    tackleOutcome: input.tackleOutcome,
    tackleQuality: input.tackleQuality,
    offloadTone: input.offloadTone,
    passVariant: input.passVariant,
    precedingPassEventId: input.precedingPassEventId,
    zoneId: input.zoneId,
    setPieceOutcome: input.setPieceOutcome,
    playPhaseContext: input.playPhaseContext,
    negativeActionId: input.negativeActionId,
  };
  if (input.conversionOutcome !== undefined) {
    row.conversionOutcome = input.conversionOutcome;
  }
  if (input.fieldLengthBand !== undefined) {
    row.fieldLengthBand = input.fieldLengthBand;
  }
  await db.matchEvents.put(row);
  return row;
}

/** Count active (non-deleted) events for one match (indexed by `matchId`). */
export async function countActiveEventsForMatch(matchId: string): Promise<number> {
  const rows = await db.matchEvents.where('matchId').equals(matchId).toArray();
  let n = 0;
  for (const e of rows) {
    if (e.deletedAt == null) n += 1;
  }
  return n;
}

/**
 * Count active events per match (one full-table scan). Prefer `countActiveEventsForMatch` per row
 * when you need correctness with large DBs; kept for bulk analytics if needed.
 */
export async function countActiveMatchEventsByMatchId(): Promise<Map<string, number>> {
  const rows = await db.matchEvents.toArray();
  const out = new Map<string, number>();
  for (const e of rows) {
    if (e.deletedAt != null) continue;
    const mid = e.matchId;
    if (mid == null || mid === '') continue;
    const key = String(mid);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/** Newest first (sideline review). Excludes soft-deleted rows. */
export async function listMatchEvents(matchId: string): Promise<MatchEventRecord[]> {
  const rows = await db.matchEvents.where('matchId').equals(matchId).toArray();
  return rows
    .filter((e) => e.deletedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Soft-delete (undo-friendly). */
export async function deleteMatchEvent(id: string): Promise<void> {
  const row = await db.matchEvents.get(id);
  if (!row) return;
  await db.matchEvents.put({ ...row, deletedAt: Date.now() });
}

/** Restore a soft-deleted event (undo). */
export async function restoreMatchEvent(id: string): Promise<void> {
  const row = await db.matchEvents.get(id);
  if (!row) return;
  const next = { ...row };
  delete next.deletedAt;
  await db.matchEvents.put(next);
}

/** Minimal edit: clock time, segment, optional zone (null clears zone), optional length band, pass delivery. */
export async function updateMatchEvent(
  id: string,
  patch: {
    matchTimeMs: number;
    period: number;
    zoneId?: ZoneId | null;
    fieldLengthBand?: FieldLengthBandId | null;
    passVariant?: PassVariant | null;
    offloadTone?: OffloadTone | null;
    conversionOutcome?: ConversionOutcome | null;
    penaltyCard?: PenaltyCard | null;
  },
): Promise<void> {
  const row = await db.matchEvents.get(id);
  if (!row || row.deletedAt != null) return;
  const next: MatchEventRecord = {
    ...row,
    matchTimeMs: patch.matchTimeMs,
    period: patch.period,
  };
  if (patch.zoneId === null) {
    delete next.zoneId;
  } else if (patch.zoneId !== undefined) {
    next.zoneId = patch.zoneId;
  }
  if (patch.fieldLengthBand === null) {
    delete next.fieldLengthBand;
  } else if (patch.fieldLengthBand !== undefined) {
    next.fieldLengthBand = patch.fieldLengthBand;
  }
  if (patch.passVariant === null) {
    delete next.passVariant;
  } else if (patch.passVariant !== undefined) {
    next.passVariant = patch.passVariant;
  }
  if (patch.offloadTone === null) {
    delete next.offloadTone;
  } else if (patch.offloadTone !== undefined) {
    next.offloadTone = patch.offloadTone;
  }
  if (patch.conversionOutcome === null) {
    delete next.conversionOutcome;
  } else if (patch.conversionOutcome !== undefined) {
    next.conversionOutcome = patch.conversionOutcome;
  }
  if (patch.penaltyCard === null) {
    delete next.penaltyCard;
  } else if (patch.penaltyCard !== undefined) {
    next.penaltyCard = patch.penaltyCard;
  }
  await db.matchEvents.put(next);
}
