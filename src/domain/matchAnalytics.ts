import type { MatchEventRecord } from '@/domain/matchEvent';
import {
  countActiveOpponentCards,
  countActiveOpponentSubstitutions,
  countOurTeamPenaltyCards,
  rugbyPointsFromOpponentEvents,
  rugbyPointsFromOwnTeamEvents,
  tackleMadeMissed,
  triesByZone,
} from '@/domain/matchStats';
import type { ZoneId } from '@/domain/zone';

/** Group own-team tries by field third (team-relative zones). */
export function ownTriesByTerritoryThird(events: MatchEventRecord[]): {
  defensive: number;
  middle: number;
  attack: number;
  unzoned: number;
} {
  let defensive = 0;
  let middle = 0;
  let attack = 0;
  let unzoned = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'try') continue;
    const z = e.zoneId;
    if (!z) {
      unzoned += 1;
      continue;
    }
    if (z === 'Z1' || z === 'Z2') defensive += 1;
    else if (z === 'Z3' || z === 'Z4') middle += 1;
    else attack += 1;
  }
  return { defensive, middle, attack, unzoned };
}

function conversionKickSplit(events: MatchEventRecord[], kind: 'conversion' | 'opponent_conversion'): {
  made: number;
  missed: number;
  legacyNoOutcome: number;
} {
  let made = 0;
  let missed = 0;
  let legacyNoOutcome = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== kind) continue;
    if (e.conversionOutcome === 'made') made += 1;
    else if (e.conversionOutcome === 'missed') missed += 1;
    else legacyNoOutcome += 1;
  }
  return { made, missed, legacyNoOutcome };
}

function countOwnTries(events: MatchEventRecord[]): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'try') continue;
    n += 1;
  }
  return n;
}

function countOpponentTries(events: MatchEventRecord[]): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'opponent_try') continue;
    n += 1;
  }
  return n;
}

export type SetPieceSplit = { won: number; lost: number; penalized: number };

function setPieceSplit(events: MatchEventRecord[], kind: 'scrum' | 'lineout' | 'ruck'): SetPieceSplit {
  const out: SetPieceSplit = { won: 0, lost: 0, penalized: 0 };
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== kind || !e.setPieceOutcome) continue;
    out[e.setPieceOutcome] += 1;
  }
  return out;
}

/** Single-match analytics for coaching review (all from logged data). */
export type MatchAnalyticsSnapshot = {
  ownPoints: number;
  oppPoints: number;
  ownTries: number;
  oppTries: number;
  ownKick: ReturnType<typeof conversionKickSplit>;
  oppKick: ReturnType<typeof conversionKickSplit>;
  tackles: ReturnType<typeof tackleMadeMissed>;
  subsOurs: number;
  subsOpp: number;
  cardsOurs: { yc: number; rc: number };
  cardsOpp: { yc: number; rc: number };
  territory: ReturnType<typeof ownTriesByTerritoryThird>;
  triesZonedByZone: Record<ZoneId, number>;
  scrums: SetPieceSplit;
  lineouts: SetPieceSplit;
  rucks: SetPieceSplit;
};

export function computeMatchAnalyticsSnapshot(
  events: MatchEventRecord[],
  substitutionCount: number,
): MatchAnalyticsSnapshot {
  const ownKick = conversionKickSplit(events, 'conversion');
  const oppKick = conversionKickSplit(events, 'opponent_conversion');
  return {
    ownPoints: rugbyPointsFromOwnTeamEvents(events),
    oppPoints: rugbyPointsFromOpponentEvents(events),
    ownTries: countOwnTries(events),
    oppTries: countOpponentTries(events),
    ownKick,
    oppKick,
    tackles: tackleMadeMissed(events),
    subsOurs: substitutionCount,
    subsOpp: countActiveOpponentSubstitutions(events),
    cardsOurs: {
      yc: countOurTeamPenaltyCards(events, 'yellow'),
      rc: countOurTeamPenaltyCards(events, 'red'),
    },
    cardsOpp: {
      yc: countActiveOpponentCards(events, 'yellow'),
      rc: countActiveOpponentCards(events, 'red'),
    },
    territory: ownTriesByTerritoryThird(events),
    triesZonedByZone: triesByZone(events),
    scrums: setPieceSplit(events, 'scrum'),
    lineouts: setPieceSplit(events, 'lineout'),
    rucks: setPieceSplit(events, 'ruck'),
  };
}

/** Kick-at-goal rate when made/missed was recorded (excludes legacy rows without outcome). */
export function kickDecidedSuccessPct(made: number, missed: number): number | null {
  const d = made + missed;
  if (d === 0) return null;
  return Math.round((made / d) * 1000) / 10;
}
