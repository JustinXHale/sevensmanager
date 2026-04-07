import {
  eventCountsTowardOffloadStats,
  resolveOffloadTone,
  type MatchEventKind,
  type MatchEventRecord,
  type PenaltyCard,
} from '@/domain/matchEvent';
import type { SubstitutionRecord } from '@/domain/player';
import { ZONE_IDS, type ZoneId } from '@/domain/zone';

export type KindCounts = Partial<Record<MatchEventKind, number>>;

/** Count events by kind (for analytics tab). */
export function countEventsByKind(events: MatchEventRecord[]): KindCounts {
  const out: KindCounts = {};
  for (const e of events) {
    out[e.kind] = (out[e.kind] ?? 0) + 1;
  }
  return out;
}

/** Tries and conversions per player id. */
export function triesAndConversionsByPlayer(events: MatchEventRecord[]): Map<string, { tries: number; conversions: number }> {
  const m = new Map<string, { tries: number; conversions: number }>();
  for (const e of events) {
    if (!e.playerId) continue;
    if (e.kind !== 'try' && e.kind !== 'conversion') continue;
    const cur = m.get(e.playerId) ?? { tries: 0, conversions: 0 };
    if (e.kind === 'try') cur.tries += 1;
    else cur.conversions += 1;
    m.set(e.playerId, cur);
  }
  return m;
}

/**
 * Rugby union points from logged own-team scoring: try +5, conversion made +2 (missed +0).
 * Legacy conversions without `conversionOutcome` count as +2.
 */
export function rugbyPointsFromOwnTeamEvents(events: MatchEventRecord[]): number {
  let pts = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'try') pts += 5;
    if (e.kind === 'conversion' && e.conversionOutcome !== 'missed') pts += 2;
  }
  return pts;
}

/** Rugby points from logged opponent scoring events (try 5, conversion made 2). */
export function rugbyPointsFromOpponentEvents(events: MatchEventRecord[]): number {
  let pts = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'opponent_try') pts += 5;
    if (e.kind === 'opponent_conversion' && e.conversionOutcome !== 'missed') pts += 2;
  }
  return pts;
}

const KIND_LABEL: Record<MatchEventKind, string> = {
  scrum: 'Scrums',
  lineout: 'Lineouts',
  restart: 'Restarts',
  team_penalty: 'Team penalties',
  pass: 'Passes',
  tackle: 'Tackles',
  try: 'Tries',
  conversion: 'Conversions',
  opponent_try: 'Opponent tries',
  opponent_conversion: 'Opponent conversions',
  opponent_substitution: 'Opponent subs',
  opponent_card: 'Opponent cards',
  ruck: 'Rucks',
  line_break: 'Line breaks',
  negative_action: 'Negative plays',
};

export function kindLabel(kind: MatchEventKind): string {
  return KIND_LABEL[kind];
}

/** Count tackle rows by outcome (legacy tackle rows without `tackleOutcome` count as made). */
/** Try count per zone (events with kind try and a zone; unzoned tries not counted here). */
export function triesByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  const out = {} as Record<ZoneId, number>;
  for (const z of ZONE_IDS) {
    out[z] = 0;
  }
  for (const e of events) {
    if (e.kind !== 'try' || !e.zoneId) continue;
    out[e.zoneId] = (out[e.zoneId] ?? 0) + 1;
  }
  return out;
}

/** Made tackles only: counts by coach-selected quality (legacy rows without quality → neutral). */
export function tackleQualityBreakdown(events: MatchEventRecord[]): {
  dominant: number;
  neutral: number;
  passive: number;
} {
  let dominant = 0;
  let neutral = 0;
  let passive = 0;
  for (const e of events) {
    if (e.kind !== 'tackle' || e.tackleOutcome === 'missed') continue;
    const q = e.tackleQuality ?? 'neutral';
    if (q === 'dominant') dominant += 1;
    else if (q === 'passive') passive += 1;
    else neutral += 1;
  }
  return { dominant, neutral, passive };
}

/** Pass + line break: offload quality tones only (excludes {@link eventCountsTowardOffloadStats} false). */
export function offloadToneBreakdown(events: MatchEventRecord[]): {
  negative: number;
  neutral: number;
  positive: number;
} {
  let negative = 0;
  let neutral = 0;
  let positive = 0;
  for (const e of events) {
    if (e.kind !== 'pass' && e.kind !== 'line_break') continue;
    if (!eventCountsTowardOffloadStats(e)) continue;
    const t = resolveOffloadTone(e);
    if (t === 'negative') negative += 1;
    else if (t === 'positive') positive += 1;
    else neutral += 1;
  }
  return { negative, neutral, positive };
}

/**
 * Ruck = breakdown (product). For each ruck, time until the next pass in the same period (clock ms).
 * Used for average “breakdown length” without extra taps.
 */
export function ruckToFirstPassDurationsMs(events: MatchEventRecord[]): number[] {
  const sorted = sortMatchEventsByTime(events);
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    if (e.kind !== 'ruck') continue;
    const p0 = e.period;
    const t0 = e.matchTimeMs;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j]!;
      if (next.period !== p0) break;
      if (next.kind !== 'pass') continue;
      const dt = next.matchTimeMs - t0;
      if (dt >= 0) out.push(dt);
      break;
    }
  }
  return out;
}

export function avgRuckToFirstPassMs(events: MatchEventRecord[]): number | null {
  const d = ruckToFirstPassDurationsMs(events);
  if (d.length === 0) return null;
  return Math.round(d.reduce((a, b) => a + b, 0) / d.length);
}

export function tackleMadeMissed(events: MatchEventRecord[]): { made: number; missed: number } {
  let made = 0;
  let missed = 0;
  for (const e of events) {
    if (e.kind !== 'tackle') continue;
    if (e.tackleOutcome === 'missed') missed += 1;
    else made += 1;
  }
  return { made, missed };
}

/** Events counted as “tackles made” (same rules as {@link tackleMadeMissed}). */
export function tackleEventsMadeList(events: MatchEventRecord[]): MatchEventRecord[] {
  return events.filter((e) => e.kind === 'tackle' && e.tackleOutcome !== 'missed');
}

/** Events counted as “tackles missed”. */
export function tackleEventsMissedList(events: MatchEventRecord[]): MatchEventRecord[] {
  return events.filter((e) => e.kind === 'tackle' && e.tackleOutcome === 'missed');
}

/** All logged events of a given kind (for stats drill-down). */
export function eventsOfKind(events: MatchEventRecord[], kind: MatchEventKind): MatchEventRecord[] {
  return events.filter((e) => e.kind === kind);
}

/** Try events attributed to a field zone (same rules as {@link triesByZone}). */
export function tryEventsInZone(events: MatchEventRecord[], zoneId: ZoneId): MatchEventRecord[] {
  return events.filter((e) => e.kind === 'try' && e.zoneId === zoneId);
}

/** Chronological order for display lists (period, then match clock). */
export function sortMatchEventsByTime(events: MatchEventRecord[]): MatchEventRecord[] {
  return [...events].sort((a, b) => (a.period !== b.period ? a.period - b.period : a.matchTimeMs - b.matchTimeMs));
}

/**
 * Most recent active event matching `predicate` by match clock (for undo/remove-last).
 */
export function lastMatchingEventId(
  events: MatchEventRecord[],
  predicate: (e: MatchEventRecord) => boolean,
): string | undefined {
  const candidates = events.filter((e) => e.deletedAt == null && predicate(e));
  if (candidates.length === 0) return undefined;
  const sorted = sortMatchEventsByTime(candidates);
  return sorted[sorted.length - 1]?.id;
}

/** Count `team_penalty` rows with a given card (own-team discipline). */
export function countOurTeamPenaltyCards(events: MatchEventRecord[], card: PenaltyCard): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind !== 'team_penalty') continue;
    if (e.penaltyCard === card) n += 1;
  }
  return n;
}

export function countActiveOpponentSubstitutions(events: MatchEventRecord[]): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'opponent_substitution') n += 1;
  }
  return n;
}

export function countActiveOpponentCards(events: MatchEventRecord[], card: PenaltyCard): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind !== 'opponent_card') continue;
    if (e.penaltyCard === card) n += 1;
  }
  return n;
}

export function countActiveOpponentTries(events: MatchEventRecord[]): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'opponent_try') n += 1;
  }
  return n;
}

/** All logged opponent conversion attempts (made + missed). */
export function countActiveOpponentConversions(events: MatchEventRecord[]): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'opponent_conversion') n += 1;
  }
  return n;
}

export function sortSubstitutionsByTime(subs: SubstitutionRecord[]): SubstitutionRecord[] {
  return [...subs].sort((a, b) => (a.period !== b.period ? a.period - b.period : a.matchTimeMs - b.matchTimeMs));
}

/** Logged events per period (for tempo / quarter-style charts). */
export function countEventsByPeriod(events: MatchEventRecord[]): { period: number; count: number }[] {
  const m = new Map<number, number>();
  for (const e of events) {
    const p = typeof e.period === 'number' && e.period >= 1 ? Math.floor(e.period) : 1;
    m.set(p, (m.get(p) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([period, count]) => ({ period, count }));
}

/**
 * Bin events by match clock time (0 → max seen) to spot clusters / "trains" of activity.
 * Empty events → zero bins and maxMs 0.
 */
export function eventHistogramByMatchTime(events: MatchEventRecord[], bucketCount: number): { bins: number[]; maxMs: number } {
  const n = Math.max(1, Math.floor(bucketCount));
  if (events.length === 0) {
    return { bins: Array.from({ length: n }, () => 0), maxMs: 0 };
  }
  let maxMs = 0;
  for (const e of events) {
    if (typeof e.matchTimeMs === 'number' && e.matchTimeMs > maxMs) maxMs = e.matchTimeMs;
  }
  if (maxMs <= 0) {
    const bins = Array.from({ length: n }, () => 0);
    bins[0] = events.length;
    return { bins, maxMs: 0 };
  }
  const bins = Array.from({ length: n }, () => 0);
  for (const e of events) {
    const t = typeof e.matchTimeMs === 'number' ? e.matchTimeMs : 0;
    const idx = Math.min(n - 1, Math.floor((t / maxMs) * n));
    bins[idx] += 1;
  }
  return { bins, maxMs };
}
