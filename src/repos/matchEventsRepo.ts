import type {
  ConversionOutcome,
  FieldLengthBandId,
  MatchEventKind,
  MatchEventRecord,
  NegativeActionId,
  OffloadTone,
  PassVariant,
  PenaltyCard,
  PenaltyDirection,
  PenaltyTypeId,
  PlayPhaseContext,
  RestartKickDepth,
  FreeKickAgainst,
  RuckContest,
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
  penaltyDirection?: PenaltyDirection;
  tackleOutcome?: TackleOutcome;
  tackleQuality?: TackleQuality;
  offloadTone?: OffloadTone;
  passVariant?: PassVariant;
  precedingPassEventId?: string;
  zoneId?: ZoneId;
  fieldLengthBand?: FieldLengthBandId;
  setPieceOutcome?: SetPieceOutcome;
  restartKickDepth?: RestartKickDepth;
  playPhaseContext?: PlayPhaseContext;
  negativeActionId?: NegativeActionId;
  conversionOutcome?: ConversionOutcome;
  filmTimeMs?: number;
  markerNote?: string;
  ruckContest?: RuckContest;
  freeKickAgainst?: FreeKickAgainst;
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
    penaltyDirection: input.penaltyDirection,
    tackleOutcome: input.tackleOutcome,
    tackleQuality: input.tackleQuality,
    offloadTone: input.offloadTone,
    passVariant: input.passVariant,
    precedingPassEventId: input.precedingPassEventId,
    zoneId: input.zoneId,
    setPieceOutcome: input.setPieceOutcome,
    restartKickDepth: input.restartKickDepth,
    playPhaseContext: input.playPhaseContext,
    negativeActionId: input.negativeActionId,
  };
  if (input.conversionOutcome !== undefined) {
    row.conversionOutcome = input.conversionOutcome;
  }
  if (input.fieldLengthBand !== undefined) {
    row.fieldLengthBand = input.fieldLengthBand;
  }
  if (input.filmTimeMs !== undefined) {
    row.filmTimeMs = input.filmTimeMs;
  }
  if (input.markerNote !== undefined) {
    row.markerNote = input.markerNote;
  }
  if (input.ruckContest !== undefined) {
    row.ruckContest = input.ruckContest;
  }
  if (input.freeKickAgainst !== undefined) {
    row.freeKickAgainst = input.freeKickAgainst;
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

function applyNullablePatch<K extends keyof MatchEventRecord>(
  next: MatchEventRecord,
  key: K,
  value: MatchEventRecord[K] | null | undefined,
): void {
  if (value === undefined) return;
  if (value === null) {
    delete next[key];
  } else {
    next[key] = value;
  }
}

/** Edit clock, zone, and event-specific fields (outcome, delivery, etc.). */
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
    setPieceOutcome?: SetPieceOutcome | null;
    restartKickDepth?: RestartKickDepth | null;
    playPhaseContext?: PlayPhaseContext | null;
    freeKickAgainst?: FreeKickAgainst | null;
    ruckContest?: RuckContest | null;
    tackleOutcome?: TackleOutcome | null;
    tackleQuality?: TackleQuality | null;
    negativeActionId?: NegativeActionId | null;
    penaltyDirection?: PenaltyDirection | null;
    playerId?: string | null;
  },
): Promise<void> {
  const row = await db.matchEvents.get(id);
  if (!row || row.deletedAt != null) return;
  const next: MatchEventRecord = {
    ...row,
    matchTimeMs: patch.matchTimeMs,
    period: patch.period,
  };
  applyNullablePatch(next, 'zoneId', patch.zoneId);
  applyNullablePatch(next, 'fieldLengthBand', patch.fieldLengthBand);
  applyNullablePatch(next, 'passVariant', patch.passVariant);
  applyNullablePatch(next, 'offloadTone', patch.offloadTone);
  applyNullablePatch(next, 'conversionOutcome', patch.conversionOutcome);
  applyNullablePatch(next, 'penaltyCard', patch.penaltyCard);
  applyNullablePatch(next, 'setPieceOutcome', patch.setPieceOutcome);
  applyNullablePatch(next, 'restartKickDepth', patch.restartKickDepth);
  applyNullablePatch(next, 'playPhaseContext', patch.playPhaseContext);
  applyNullablePatch(next, 'freeKickAgainst', patch.freeKickAgainst);
  applyNullablePatch(next, 'ruckContest', patch.ruckContest);
  applyNullablePatch(next, 'tackleOutcome', patch.tackleOutcome);
  applyNullablePatch(next, 'tackleQuality', patch.tackleQuality);
  applyNullablePatch(next, 'negativeActionId', patch.negativeActionId);
  applyNullablePatch(next, 'penaltyDirection', patch.penaltyDirection);
  applyNullablePatch(next, 'playerId', patch.playerId);
  await db.matchEvents.put(next);
}
