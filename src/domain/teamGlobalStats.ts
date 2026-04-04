import type { MatchAnalyticsSnapshot } from '@/domain/matchAnalytics';
import type { MatchEventRecord } from '@/domain/matchEvent';
import {
  buildPlayerProfiles,
  buildZoneHeatRows,
  negativeActionBreakdown,
  penaltyCountByType,
  phaseTimeSplit,
  ruckSpeedMedianMs,
  type NegativeActionRow,
  type PenaltyTypeRow,
  type PhaseTimeSplit,
  type PlayerProfile,
  type ZoneHeatRow,
} from '@/domain/matchAnalyticsDeep';
import { ruckToFirstPassDurationsMs } from '@/domain/matchStats';
import { ZONE_IDS } from '@/domain/zone';

/** Roll-up across multiple matches (each snapshot is one game). */
export type TeamGlobalAggregate = {
  gameCount: number;
  totalEvents: number;
  sumOwnPoints: number;
  sumOppPoints: number;
  sumOwnTries: number;
  sumOppTries: number;
  tacklesMade: number;
  tacklesMissed: number;
  subsOurs: number;
  subsOpp: number;
};

export function aggregateTeamMatchSnapshots(
  rows: { eventCount: number; snapshot: MatchAnalyticsSnapshot }[],
): TeamGlobalAggregate {
  let totalEvents = 0;
  let sumOwnPoints = 0;
  let sumOppPoints = 0;
  let sumOwnTries = 0;
  let sumOppTries = 0;
  let tacklesMade = 0;
  let tacklesMissed = 0;
  let subsOurs = 0;
  let subsOpp = 0;
  for (const r of rows) {
    totalEvents += r.eventCount;
    const s = r.snapshot;
    sumOwnPoints += s.ownPoints;
    sumOppPoints += s.oppPoints;
    sumOwnTries += s.ownTries;
    sumOppTries += s.oppTries;
    tacklesMade += s.tackles.made;
    tacklesMissed += s.tackles.missed;
    subsOurs += s.subsOurs;
    subsOpp += s.subsOpp;
  }
  return {
    gameCount: rows.length,
    totalEvents,
    sumOwnPoints,
    sumOppPoints,
    sumOwnTries,
    sumOppTries,
    tacklesMade,
    tacklesMissed,
    subsOurs,
    subsOpp,
  };
}

export function tackleCompletionPct(made: number, missed: number): number | null {
  const t = made + missed;
  if (t === 0) return null;
  return Math.round((made / t) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Deep cross-match aggregation
// ---------------------------------------------------------------------------

export type TeamDeepAggregate = {
  zoneHeatRows: ZoneHeatRow[];
  penaltyTypes: PenaltyTypeRow[];
  negativeActions: NegativeActionRow[];
  playerProfiles: Map<string, PlayerProfile>;
  ruckDurations: number[];
  ruckMedianMs: number | null;
  phaseTime: PhaseTimeSplit | null;
};

/**
 * Merge deep analytics from all match event arrays into a single aggregate.
 * This pools raw events across games for zone maps, player profiles, etc.
 */
export function aggregateDeepAnalytics(allEvents: MatchEventRecord[][]): TeamDeepAggregate {
  const flat = allEvents.flat();

  const zoneHeatRows = buildZoneHeatRows(flat);
  const penaltyTypes = penaltyCountByType(flat);
  const negativeActions = negativeActionBreakdown(flat);

  const mergedProfiles = new Map<string, PlayerProfile>();
  for (const batch of allEvents) {
    const profiles = buildPlayerProfiles(batch);
    for (const [pid, p] of profiles) {
      const existing = mergedProfiles.get(pid);
      if (!existing) {
        mergedProfiles.set(pid, { ...p });
        continue;
      }
      existing.passes += p.passes;
      existing.offloads += p.offloads;
      existing.tackles.made += p.tackles.made;
      existing.tackles.missed += p.tackles.missed;
      existing.tackles.dominant += p.tackles.dominant;
      existing.tackles.neutral += p.tackles.neutral;
      existing.tackles.passive += p.tackles.passive;
      existing.lineBreaks += p.lineBreaks;
      existing.negatives += p.negatives;
      for (const [nid, cnt] of Object.entries(p.negativeBreakdown)) {
        existing.negativeBreakdown[nid as keyof typeof existing.negativeBreakdown] =
          ((existing.negativeBreakdown[nid as keyof typeof existing.negativeBreakdown]) ?? 0) + (cnt ?? 0);
      }
      existing.penalties += p.penalties;
      existing.cards.yellow += p.cards.yellow;
      existing.cards.red += p.cards.red;
      existing.tries += p.tries;
      existing.conversions.made += p.conversions.made;
      existing.conversions.missed += p.conversions.missed;
    }
  }

  const ruckDurations: number[] = [];
  for (const batch of allEvents) {
    ruckDurations.push(...ruckToFirstPassDurationsMs(batch));
  }

  let offMs = 0;
  let defMs = 0;
  let hasPhase = false;
  for (const batch of allEvents) {
    const pt = phaseTimeSplit(batch);
    if (pt) {
      offMs += pt.offenseMs;
      defMs += pt.defenseMs;
      hasPhase = true;
    }
  }
  const total = offMs + defMs;
  const globalPhase: PhaseTimeSplit | null = hasPhase && total > 0
    ? { offenseMs: offMs, defenseMs: defMs, offensePct: Math.round((offMs / total) * 100), defensePct: Math.round((defMs / total) * 100) }
    : null;

  return {
    zoneHeatRows,
    penaltyTypes,
    negativeActions,
    playerProfiles: mergedProfiles,
    ruckDurations,
    ruckMedianMs: ruckSpeedMedianMs(ruckDurations),
    phaseTime: globalPhase,
  };
}

/** Merge zone heat maps: sum counts per zone for matching kinds. */
export function mergeZoneHeatRows(rows: ZoneHeatRow[][]): ZoneHeatRow[] {
  const byKind = new Map<string, ZoneHeatRow>();
  for (const batch of rows) {
    for (const row of batch) {
      const existing = byKind.get(row.kind);
      if (!existing) {
        byKind.set(row.kind, { ...row, zones: { ...row.zones } });
        continue;
      }
      for (const z of ZONE_IDS) {
        existing.zones[z] += row.zones[z];
      }
      existing.total += row.total;
    }
  }
  return [...byKind.values()].filter((r) => r.total > 0);
}
