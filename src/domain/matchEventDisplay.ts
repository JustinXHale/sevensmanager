import { filmDisplayMsForSession, filmTimeForDisplay, formatClock } from '@/domain/matchClock';
import type { MatchSessionRecord } from '@/domain/match';
import type { PlayerRecord } from '@/domain/player';
import { resolveOffloadTone } from '@/domain/matchEvent';
import type { MatchEventRecord } from '@/domain/matchEvent';
import {
  fieldLengthBandShortLabel,
  negativeActionLabel,
  penaltyDirectionLabel,
  penaltyTypeLabel,
  resolvePenaltyDirection,
  restartKickDepthLabel,
  ruckContestLabel,
} from '@/domain/matchEvent';
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
  else if (e.setPieceOutcome === 'free_kick') parts.push('Free kick');
  if (e.playPhaseContext === 'attack') parts.push('Attack');
  else if (e.playPhaseContext === 'defense') parts.push('Defense');
  if (e.fieldLengthBand) parts.push(fieldLengthBandShortLabel(e.fieldLengthBand));
  return parts.join(' · ') + zoneSuffix(e.zoneId);
}

export function formatMatchEventSummary(
  e: MatchEventRecord,
  playersById: Map<string, PlayerRecord>,
  filmSession?: MatchSessionRecord | null,
): string {
  const filmClock = (raw: number | undefined) => {
    if (raw == null) return '';
    const ms = filmSession
      ? filmDisplayMsForSession(filmSession, raw)
      : filmTimeForDisplay(raw, 0);
    return ms != null ? ` · Film ${formatClock(ms)}` : '';
  };
  if (e.kind === 'film_star') {
    const film = filmClock(e.filmTimeMs);
    const note = e.markerNote?.trim() ? ` · ${e.markerNote.trim()}` : '';
    return `★ Starred moment${film}${note}`;
  }
  if (e.kind === 'system_moment') {
    const film = filmClock(e.filmTimeMs);
    return `System moment · Attack${film}`;
  }
  if (e.kind === 'forced_turnover') {
    const film = filmClock(e.filmTimeMs);
    return `Forced turnover · Defense${film}`;
  }
  if (e.kind === 'scrum') return setPieceLineParts(e, 'Scrum');
  if (e.kind === 'lineout') return setPieceLineParts(e, 'Lineout');
  if (e.kind === 'team_penalty') {
    const p = e.playerId ? playersById.get(e.playerId) : undefined;
    const who = p ? formatPlayerLabel(p) : null;
    const card =
      e.penaltyCard === 'yellow' ? 'YC · ' : e.penaltyCard === 'red' ? 'RC · ' : '';
    let typeStr = penaltyDirectionLabel(resolvePenaltyDirection(e));
    if (e.penaltyType === 'other' && e.penaltyDetail?.trim()) {
      typeStr = `Other (${e.penaltyDetail.trim()})`;
    } else if (e.penaltyType) {
      typeStr = penaltyTypeLabel(e.penaltyType);
    }
    const phase =
      e.playPhaseContext === 'attack' ? ' · Attack' : e.playPhaseContext === 'defense' ? ' · Defense' : '';
    const whoBit = who ? ` · ${who}` : '';
    return `${card}${typeStr}${phase}${whoBit}${zoneSuffix(e.zoneId)}`;
  }
  if (e.kind === 'ruck') {
    const link = e.precedingPassEventId ? ' (after pass)' : '';
    const contest = e.ruckContest ? ` · ${ruckContestLabel(e.ruckContest)}` : '';
    return setPieceLineParts(e, 'Ruck') + contest + link;
  }
  if (e.kind === 'restart') {
    const parts: string[] = ['Restart'];
    if (e.zoneId) parts.push(e.zoneId);
    if (e.restartKickDepth) parts.push(restartKickDepthLabel(e.restartKickDepth));
    if (e.setPieceOutcome === 'won') parts.push('Won');
    else if (e.setPieceOutcome === 'lost') parts.push('Lost');
    else if (e.setPieceOutcome === 'free_kick') parts.push('Free kick');
    else if (e.setPieceOutcome === 'penalized') parts.push('Penalized');
    if (e.playPhaseContext === 'attack') parts.push('Kick');
    else if (e.playPhaseContext === 'defense') parts.push('Receive');
    return parts.join(' · ');
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
  if (e.kind === 'pass' && e.playPhaseContext === 'defense' && !e.playerId) {
    return 'Opp pass · Defense';
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
