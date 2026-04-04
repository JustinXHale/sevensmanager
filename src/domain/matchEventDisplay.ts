import type { PlayerRecord } from '@/domain/player';
import { resolveOffloadTone } from '@/domain/matchEvent';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { fieldLengthBandShortLabel, negativeActionLabel, penaltyTypeLabel } from '@/domain/matchEvent';
import { formatPlayerLabel } from '@/domain/rosterDisplay';

function zoneSuffix(zoneId: MatchEventRecord['zoneId']): string {
  return zoneId ? ` · ${zoneId}` : '';
}

function lengthBandSuffix(e: MatchEventRecord): string {
  const hasBand =
    e.kind === 'pass' ||
    e.kind === 'try' ||
    e.kind === 'conversion' ||
    e.kind === 'opponent_try' ||
    e.kind === 'opponent_conversion' ||
    e.kind === 'tackle' ||
    e.kind === 'line_break';
  if (!hasBand || !e.fieldLengthBand) return '';
  return ` · ${fieldLengthBandShortLabel(e.fieldLengthBand)}`;
}

const PLAYER_KIND_LABEL: Record<string, string> = {
  pass: 'Pass',
  tackle: 'Tackle',
  try: 'Try',
  conversion: 'Conversion',
  line_break: 'Line break',
};

function setPieceLineParts(e: MatchEventRecord, kindLabel: string): string {
  const parts: string[] = [kindLabel];
  if (e.setPieceOutcome === 'won') parts.push('Won');
  else if (e.setPieceOutcome === 'lost') parts.push('Lost');
  else if (e.setPieceOutcome === 'penalized') parts.push('Penalized');
  if (e.playPhaseContext === 'attack') parts.push('Attack');
  else if (e.playPhaseContext === 'defense') parts.push('Defense');
  if (e.fieldLengthBand) parts.push(fieldLengthBandShortLabel(e.fieldLengthBand));
  return parts.join(' · ') + zoneSuffix(e.zoneId);
}

export function formatMatchEventSummary(
  e: MatchEventRecord,
  playersById: Map<string, PlayerRecord>,
): string {
  if (e.kind === 'scrum') return setPieceLineParts(e, 'Scrum');
  if (e.kind === 'lineout') return setPieceLineParts(e, 'Lineout');
  if (e.kind === 'team_penalty') {
    const p = e.playerId ? playersById.get(e.playerId) : undefined;
    const who = p ? formatPlayerLabel(p) : 'Player';
    const card =
      e.penaltyCard === 'yellow' ? 'YC · ' : e.penaltyCard === 'red' ? 'RC · ' : '';
    let typeStr = 'Penalty';
    if (e.penaltyType === 'other' && e.penaltyDetail?.trim()) {
      typeStr = `Other (${e.penaltyDetail.trim()})`;
    } else if (e.penaltyType) {
      typeStr = penaltyTypeLabel(e.penaltyType);
    }
    return `${card}${typeStr} · ${who}${zoneSuffix(e.zoneId)}`;
  }
  if (e.kind === 'ruck') {
    const link = e.precedingPassEventId ? ' (after pass)' : '';
    return setPieceLineParts(e, 'Ruck') + link;
  }
  const p = e.playerId ? playersById.get(e.playerId) : undefined;
  const who = p ? formatPlayerLabel(p) : 'Player';
  if (e.kind === 'tackle') {
    const out = e.tackleOutcome === 'missed' ? 'Tackle missed' : 'Tackle made';
    const q =
      e.tackleOutcome !== 'missed' && e.tackleQuality
        ? e.tackleQuality === 'dominant'
          ? ' · Dom'
          : e.tackleQuality === 'passive'
            ? ' · Pas'
            : ' · Neu'
        : '';
    return `${out}${q} · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
  }
  if (e.kind === 'pass') {
    if (e.passVariant === 'standard') {
      return `Pass · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
    }
    const t = resolveOffloadTone(e);
    const off = t === 'negative' ? ' · Neg' : t === 'positive' ? ' · Pos' : ' · Neu';
    return `Pass${off} · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
  }
  if (e.kind === 'line_break') {
    if (e.passVariant === 'standard') {
      return `Line break · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
    }
    const t = resolveOffloadTone(e);
    const off = t === 'negative' ? ' · Neg' : t === 'positive' ? ' · Pos' : ' · Neu';
    return `Line break${off} · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
  }
  if (e.kind === 'negative_action') {
    const lab = e.negativeActionId ? negativeActionLabel(e.negativeActionId) : 'Negative play';
    return `${lab} · ${who}${zoneSuffix(e.zoneId)}`;
  }
  if (e.kind === 'conversion') {
    const act =
      e.conversionOutcome === 'made'
        ? 'Conversion made'
        : e.conversionOutcome === 'missed'
          ? 'Conversion missed'
          : 'Conversion';
    return `${act} · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
  }
  if (e.kind === 'opponent_try') {
    return `Opponent try${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
  }
  if (e.kind === 'opponent_conversion') {
    const act =
      e.conversionOutcome === 'made'
        ? 'Opponent conversion made'
        : e.conversionOutcome === 'missed'
          ? 'Opponent conversion missed'
          : 'Opponent conversion';
    return `${act}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
  }
  if (e.kind === 'opponent_substitution') {
    return 'Opponent substitution';
  }
  if (e.kind === 'opponent_card') {
    const label = e.penaltyCard === 'red' ? 'Opponent red card' : 'Opponent yellow card';
    return label;
  }
  const act = PLAYER_KIND_LABEL[e.kind] ?? e.kind;
  return `${act} · ${who}${zoneSuffix(e.zoneId)}${lengthBandSuffix(e)}`;
}
