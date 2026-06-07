import type { SetPieceSplit } from '@/domain/matchAnalytics';
import type { MatchEventKind, MatchEventRecord, PlayPhaseContext, SetPieceOutcome } from '@/domain/matchEvent';
import { resolvePenaltyDirection } from '@/domain/matchEvent';

const SET_PIECE_KINDS: MatchEventKind[] = ['scrum', 'lineout', 'restart', 'ruck'];

function splitSetPieceOutcomes(events: MatchEventRecord[]): SetPieceSplit {
  const out: SetPieceSplit = { won: 0, lost: 0, penalized: 0, freeKick: 0 };
  for (const e of events) {
    if (e.deletedAt != null || !e.setPieceOutcome) continue;
    const o: SetPieceOutcome = e.setPieceOutcome;
    if (o === 'free_kick') out.freeKick += 1;
    else if (o === 'won') out.won += 1;
    else if (o === 'lost') out.lost += 1;
    else if (o === 'penalized') out.penalized += 1;
  }
  return out;
}

export function countPassesAndOffloads(events: MatchEventRecord[]): { pass: number; offload: number } {
  let pass = 0;
  let offload = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'pass') continue;
    if (e.passVariant === 'offload') offload += 1;
    else pass += 1;
  }
  return { pass, offload };
}

export function countConversionsMadeMissed(events: MatchEventRecord[]): { made: number; missed: number } {
  let made = 0;
  let missed = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'conversion') continue;
    if (e.conversionOutcome === 'missed') missed += 1;
    else made += 1;
  }
  return { made, missed };
}

export function countPenaltiesByDirection(
  events: MatchEventRecord[],
  phase?: PlayPhaseContext,
): { conceded: number; awarded: number } {
  let conceded = 0;
  let awarded = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'team_penalty') continue;
    if (phase && e.playPhaseContext !== phase) continue;
    if (resolvePenaltyDirection(e) === 'awarded') awarded += 1;
    else conceded += 1;
  }
  return { conceded, awarded };
}

export function setPieceSplitForPhase(
  events: MatchEventRecord[],
  kind: MatchEventKind,
  phase: PlayPhaseContext,
): SetPieceSplit {
  const filtered = events.filter(
    (e) =>
      e.deletedAt == null &&
      e.kind === kind &&
      e.playPhaseContext === phase,
  );
  return splitSetPieceOutcomes(filtered);
}

export function tallySetPieceKinds(): readonly MatchEventKind[] {
  return SET_PIECE_KINDS;
}
