import type {
  MatchEventKind,
  MatchEventRecord,
  NegativeActionId,
  PenaltyTypeId,
} from '@/domain/matchEvent';
import { penaltyTypeLabel } from '@/domain/matchEvent';
import { sortMatchEventsByTime } from '@/domain/matchStats';
import { ZONE_IDS, type ZoneId } from '@/domain/zone';

// ---------------------------------------------------------------------------
// Zone heat maps
// ---------------------------------------------------------------------------

/** Count active events with a zoneId, filtered by predicate. */
function countByZone(
  events: MatchEventRecord[],
  predicate: (e: MatchEventRecord) => boolean,
): Record<ZoneId, number> {
  const out = {} as Record<ZoneId, number>;
  for (const z of ZONE_IDS) out[z] = 0;
  for (const e of events) {
    if (e.deletedAt != null || !e.zoneId || !predicate(e)) continue;
    out[e.zoneId] = (out[e.zoneId] ?? 0) + 1;
  }
  return out;
}

export function passesByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  return countByZone(events, (e) => e.kind === 'pass');
}

export function tacklesMadeByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  return countByZone(events, (e) => e.kind === 'tackle' && e.tackleOutcome !== 'missed');
}

export function tacklesMissedByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  return countByZone(events, (e) => e.kind === 'tackle' && e.tackleOutcome === 'missed');
}

export function lineBreaksByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  return countByZone(events, (e) => e.kind === 'line_break');
}

export function negativeActionsByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  return countByZone(events, (e) => e.kind === 'negative_action');
}

export function penaltiesByZone(events: MatchEventRecord[]): Record<ZoneId, number> {
  return countByZone(events, (e) => e.kind === 'team_penalty');
}

export type ZoneHeatRow = {
  label: string;
  kind: string;
  zones: Record<ZoneId, number>;
  total: number;
};

export function buildZoneHeatRows(events: MatchEventRecord[]): ZoneHeatRow[] {
  const make = (label: string, kind: string, zones: Record<ZoneId, number>): ZoneHeatRow => {
    let total = 0;
    for (const z of ZONE_IDS) total += zones[z];
    return { label, kind, zones, total };
  };
  return [
    make('Passes', 'pass', passesByZone(events)),
    make('Tkl M', 'tackle_made', tacklesMadeByZone(events)),
    make('Tkl X', 'tackle_missed', tacklesMissedByZone(events)),
    make('Breaks', 'line_break', lineBreaksByZone(events)),
    make('(\u2212) plays', 'negative', negativeActionsByZone(events)),
    make('Pen', 'penalty', penaltiesByZone(events)),
  ].filter((r) => r.total > 0);
}

// ---------------------------------------------------------------------------
// Per-player profiles
// ---------------------------------------------------------------------------

export type PlayerProfile = {
  playerId: string;
  passes: number;
  offloads: number;
  tackles: { made: number; missed: number; dominant: number; neutral: number; passive: number };
  lineBreaks: number;
  negatives: number;
  negativeBreakdown: Partial<Record<NegativeActionId, number>>;
  penalties: number;
  cards: { yellow: number; red: number };
  tries: number;
  conversions: { made: number; missed: number };
};

function emptyProfile(playerId: string): PlayerProfile {
  return {
    playerId,
    passes: 0,
    offloads: 0,
    tackles: { made: 0, missed: 0, dominant: 0, neutral: 0, passive: 0 },
    lineBreaks: 0,
    negatives: 0,
    negativeBreakdown: {},
    penalties: 0,
    cards: { yellow: 0, red: 0 },
    tries: 0,
    conversions: { made: 0, missed: 0 },
  };
}

export function buildPlayerProfiles(events: MatchEventRecord[]): Map<string, PlayerProfile> {
  const m = new Map<string, PlayerProfile>();
  const get = (pid: string) => {
    let p = m.get(pid);
    if (!p) {
      p = emptyProfile(pid);
      m.set(pid, p);
    }
    return p;
  };

  for (const e of events) {
    if (e.deletedAt != null || !e.playerId) continue;
    const p = get(e.playerId);
    switch (e.kind) {
      case 'pass':
        p.passes += 1;
        if (e.passVariant === 'offload') p.offloads += 1;
        break;
      case 'line_break':
        p.lineBreaks += 1;
        if (e.passVariant === 'offload') p.offloads += 1;
        break;
      case 'tackle':
        if (e.tackleOutcome === 'missed') {
          p.tackles.missed += 1;
        } else {
          p.tackles.made += 1;
          const q = e.tackleQuality ?? 'neutral';
          p.tackles[q] += 1;
        }
        break;
      case 'try':
        p.tries += 1;
        break;
      case 'conversion':
        if (e.conversionOutcome === 'missed') p.conversions.missed += 1;
        else p.conversions.made += 1;
        break;
      case 'negative_action':
        p.negatives += 1;
        if (e.negativeActionId) {
          const nid = e.negativeActionId as NegativeActionId;
          p.negativeBreakdown[nid] = (p.negativeBreakdown[nid] ?? 0) + 1;
        }
        break;
      case 'team_penalty':
        p.penalties += 1;
        if (e.penaltyCard === 'yellow') p.cards.yellow += 1;
        if (e.penaltyCard === 'red') p.cards.red += 1;
        break;
    }
  }
  return m;
}

/**
 * Total "involvement" for sorting: passes + tackles + line breaks + tries + negatives + penalties.
 */
export function playerInvolvement(p: PlayerProfile): number {
  return (
    p.passes +
    p.tackles.made +
    p.tackles.missed +
    p.lineBreaks +
    p.tries +
    p.negatives +
    p.penalties
  );
}

// ---------------------------------------------------------------------------
// Penalty intelligence
// ---------------------------------------------------------------------------

export type PenaltyTypeRow = { type: PenaltyTypeId; label: string; count: number };

export function penaltyCountByType(events: MatchEventRecord[]): PenaltyTypeRow[] {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'team_penalty' || !e.penaltyType) continue;
    m.set(e.penaltyType, (m.get(e.penaltyType) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([type, count]) => ({
      type: type as PenaltyTypeId,
      label: penaltyTypeLabel(type as PenaltyTypeId),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Ruck speed details
// ---------------------------------------------------------------------------

export function ruckSpeedMedianMs(durations: number[]): number | null {
  if (durations.length === 0) return null;
  const sorted = [...durations].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  return sorted[mid]!;
}

export type RuckSpeedBucket = { label: string; count: number };

export function ruckSpeedDistribution(durations: number[]): RuckSpeedBucket[] {
  const buckets: RuckSpeedBucket[] = [
    { label: '< 2s', count: 0 },
    { label: '2–4s', count: 0 },
    { label: '4–6s', count: 0 },
    { label: '6–8s', count: 0 },
    { label: '8s+', count: 0 },
  ];
  for (const d of durations) {
    const s = d / 1000;
    if (s < 2) buckets[0]!.count += 1;
    else if (s < 4) buckets[1]!.count += 1;
    else if (s < 6) buckets[2]!.count += 1;
    else if (s < 8) buckets[3]!.count += 1;
    else buckets[4]!.count += 1;
  }
  return buckets;
}

export type RuckSpeedByPeriod = { period: number; avgMs: number; count: number };

export function ruckSpeedByPeriod(events: MatchEventRecord[]): RuckSpeedByPeriod[] {
  const sorted = sortMatchEventsByTime(events);
  const byPeriod = new Map<number, number[]>();
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    if (e.kind !== 'ruck') continue;
    const p0 = e.period;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j]!;
      if (next.period !== p0) break;
      if (next.kind !== 'pass') continue;
      const dt = next.matchTimeMs - e.matchTimeMs;
      if (dt >= 0) {
        const arr = byPeriod.get(p0) ?? [];
        arr.push(dt);
        byPeriod.set(p0, arr);
      }
      break;
    }
  }
  return [...byPeriod.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([period, durations]) => ({
      period,
      avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      count: durations.length,
    }));
}

// ---------------------------------------------------------------------------
// Set piece phase context (own ball vs opposition ball)
// ---------------------------------------------------------------------------

export type SetPiecePhaseSlice = { won: number; lost: number; penalized: number; freeKick: number };

export type SetPiecePhaseBreakdown = {
  attack: SetPiecePhaseSlice;
  defense: SetPiecePhaseSlice;
};

export function setPieceByPhase(
  events: MatchEventRecord[],
  kind: 'scrum' | 'lineout' | 'ruck',
): SetPiecePhaseBreakdown {
  const empty = (): SetPiecePhaseSlice => ({ won: 0, lost: 0, penalized: 0, freeKick: 0 });
  const out: SetPiecePhaseBreakdown = {
    attack: empty(),
    defense: empty(),
  };
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== kind || !e.setPieceOutcome) continue;
    const phase = e.playPhaseContext === 'defense' ? 'defense' : 'attack';
    const slice = out[phase];
    const o = e.setPieceOutcome;
    if (o === 'free_kick') slice.freeKick += 1;
    else if (o === 'won') slice.won += 1;
    else if (o === 'lost') slice.lost += 1;
    else if (o === 'penalized') slice.penalized += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Negative action breakdown (aggregate)
// ---------------------------------------------------------------------------

export type NegativeActionRow = { id: string; label: string; count: number };

export function negativeActionBreakdown(events: MatchEventRecord[]): NegativeActionRow[] {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'negative_action') continue;
    const nid = e.negativeActionId ?? 'unknown';
    m.set(nid, (m.get(nid) ?? 0) + 1);
  }
  const labelFor = (id: string) => {
    if (id === 'bad_pass') return 'Bad pass';
    if (id === 'knock_on') return 'Knock-on';
    if (id === 'forward_pass') return 'Forward pass';
    return id;
  };
  return [...m.entries()]
    .map(([id, count]) => ({ id, label: labelFor(id), count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Tempo: events per minute by period
// ---------------------------------------------------------------------------

export type TempoByPeriod = { period: number; durationMs: number; events: number; perMinute: number };

export function tempoByPeriod(events: MatchEventRecord[]): TempoByPeriod[] {
  const periodStats = new Map<number, { minMs: number; maxMs: number; count: number }>();
  for (const e of events) {
    if (e.deletedAt != null) continue;
    const p = e.period;
    const cur = periodStats.get(p);
    if (!cur) {
      periodStats.set(p, { minMs: e.matchTimeMs, maxMs: e.matchTimeMs, count: 1 });
    } else {
      cur.minMs = Math.min(cur.minMs, e.matchTimeMs);
      cur.maxMs = Math.max(cur.maxMs, e.matchTimeMs);
      cur.count += 1;
    }
  }
  return [...periodStats.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([period, { minMs, maxMs, count }]) => {
      const durationMs = Math.max(1, maxMs - minMs);
      const minutes = durationMs / 60000;
      return {
        period,
        durationMs,
        events: count,
        perMinute: minutes > 0 ? Math.round((count / minutes) * 10) / 10 : 0,
      };
    });
}

// ---------------------------------------------------------------------------
// Scoring timeline
// ---------------------------------------------------------------------------

export type ScoringMoment = {
  matchTimeMs: number;
  period: number;
  side: 'us' | 'opp';
  kind: MatchEventKind;
  points: number;
  runningUs: number;
  runningOpp: number;
};

export function scoringTimeline(events: MatchEventRecord[]): ScoringMoment[] {
  const sorted = sortMatchEventsByTime(
    events.filter(
      (e) =>
        e.deletedAt == null &&
        (e.kind === 'try' ||
          e.kind === 'conversion' ||
          e.kind === 'opponent_try' ||
          e.kind === 'opponent_conversion'),
    ),
  );
  let runUs = 0;
  let runOpp = 0;
  return sorted.map((e) => {
    let points = 0;
    let side: 'us' | 'opp' = 'us';
    if (e.kind === 'try') {
      points = 5;
      side = 'us';
    } else if (e.kind === 'conversion' && e.conversionOutcome !== 'missed') {
      points = 2;
      side = 'us';
    } else if (e.kind === 'opponent_try') {
      points = 5;
      side = 'opp';
    } else if (e.kind === 'opponent_conversion' && e.conversionOutcome !== 'missed') {
      points = 2;
      side = 'opp';
    }
    if (side === 'us') runUs += points;
    else runOpp += points;
    return {
      matchTimeMs: e.matchTimeMs,
      period: e.period,
      side,
      kind: e.kind,
      points,
      runningUs: runUs,
      runningOpp: runOpp,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Offense / Defense time estimation                                  */
/* ------------------------------------------------------------------ */

const OFFENSIVE_KINDS: ReadonlySet<MatchEventKind> = new Set([
  'pass', 'line_break', 'try', 'conversion', 'negative_action',
]);

const DEFENSIVE_KINDS: ReadonlySet<MatchEventKind> = new Set([
  'tackle', 'opponent_try', 'opponent_conversion',
  'opponent_substitution', 'opponent_card', 'team_penalty',
]);

function classifyPhase(e: MatchEventRecord): 'offense' | 'defense' | null {
  if (OFFENSIVE_KINDS.has(e.kind)) return 'offense';
  if (DEFENSIVE_KINDS.has(e.kind)) return 'defense';
  if (e.kind === 'scrum' || e.kind === 'lineout' || e.kind === 'ruck' || e.kind === 'restart') {
    if (e.playPhaseContext === 'attack') return 'offense';
    if (e.playPhaseContext === 'defense') return 'defense';
  }
  return null;
}

export type PhaseTimeSplit = {
  offenseMs: number;
  defenseMs: number;
  offensePct: number;
  defensePct: number;
};

/**
 * Estimate time spent on offense vs defense by classifying each event
 * and attributing the gap to the next event to the current phase.
 * Only gaps within the same period are counted (period transitions are ignored).
 * Gaps larger than 90s are capped to avoid skewing from long stoppages.
 */
export function phaseTimeSplit(events: MatchEventRecord[]): PhaseTimeSplit | null {
  const active = events.filter((e) => e.deletedAt == null);
  const sorted = [...active].sort((a, b) => a.matchTimeMs - b.matchTimeMs || a.createdAt - b.createdAt);
  if (sorted.length < 2) return null;

  let offenseMs = 0;
  let defenseMs = 0;
  const MAX_GAP = 90_000;

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;
    if (curr.period !== next.period) continue;

    const phase = classifyPhase(curr);
    if (!phase) continue;

    const gap = Math.min(next.matchTimeMs - curr.matchTimeMs, MAX_GAP);
    if (gap <= 0) continue;

    if (phase === 'offense') offenseMs += gap;
    else defenseMs += gap;
  }

  const total = offenseMs + defenseMs;
  if (total === 0) return null;
  return {
    offenseMs,
    defenseMs,
    offensePct: Math.round((offenseMs / total) * 100),
    defensePct: Math.round((defenseMs / total) * 100),
  };
}
