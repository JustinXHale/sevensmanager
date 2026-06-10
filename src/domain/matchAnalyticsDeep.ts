import type { MatchSessionRecord } from '@/domain/match';
import type {
  MatchEventKind,
  MatchEventRecord,
  NegativeActionId,
  PenaltyTypeId,
} from '@/domain/matchEvent';
import { penaltyTypeLabel } from '@/domain/matchEvent';
import {
  bankedMatchMsBeforeCurrentPeriod,
  currentPeriodElapsedDisplayMs,
} from '@/domain/matchClock';
import { RUCK_SPEED_LOGGING_OFFSET_MS, sortMatchEventsByTime } from '@/domain/matchStats';
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
        arr.push(dt + RUCK_SPEED_LOGGING_OFFSET_MS);
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
  kind: 'scrum' | 'lineout' | 'ruck' | 'restart',
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
  /** Try→conversion and conversion→restart gaps excluded from phase split. */
  deadTimeMs: number;
  playingTimeMs: number;
};

/** Gaps between scoring events and restarts are walk-back / setup — not playing time. */
export function isDeadTimeGap(curr: MatchEventRecord, next: MatchEventRecord): boolean {
  if (curr.period !== next.period) return false;
  if (curr.kind === 'try' && next.kind === 'conversion') return true;
  if (curr.kind === 'opponent_try' && next.kind === 'opponent_conversion') return true;
  if (
    (curr.kind === 'conversion' || curr.kind === 'opponent_conversion') &&
    next.kind === 'restart'
  ) {
    return true;
  }
  return false;
}

const PHASE_GAP_MAX_MS = 90_000;

function buildPhaseTimeSplit(
  sorted: MatchEventRecord[],
  periodFilter?: number,
): PhaseTimeSplit | null {
  if (sorted.length < 2) return null;

  let offenseMs = 0;
  let defenseMs = 0;
  let deadTimeMs = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;
    if (curr.period !== next.period) continue;
    if (periodFilter != null && curr.period !== periodFilter) continue;

    const gap = Math.min(next.matchTimeMs - curr.matchTimeMs, PHASE_GAP_MAX_MS);
    if (gap <= 0) continue;

    if (isDeadTimeGap(curr, next)) {
      deadTimeMs += gap;
      continue;
    }

    const phase = classifyPhase(curr);
    if (!phase) continue;

    if (phase === 'offense') offenseMs += gap;
    else defenseMs += gap;
  }

  const playingTimeMs = offenseMs + defenseMs;
  if (playingTimeMs === 0 && deadTimeMs === 0) return null;
  const total = playingTimeMs;
  return {
    offenseMs,
    defenseMs,
    offensePct: total > 0 ? Math.round((offenseMs / total) * 100) : 0,
    defensePct: total > 0 ? Math.round((defenseMs / total) * 100) : 0,
    deadTimeMs,
    playingTimeMs,
  };
}

/**
 * Estimate time spent on offense vs defense by classifying each event
 * and attributing the gap to the next event to the current phase.
 * Only gaps within the same period are counted (period transitions are ignored).
 * Gaps larger than 90s are capped to avoid skewing from long stoppages.
 * Dead time (try→conversion, conversion→restart) is tracked separately.
 */
export function phaseTimeSplit(
  events: MatchEventRecord[],
  opts?: { period?: number },
): PhaseTimeSplit | null {
  const active = events.filter(
    (e) => e.deletedAt == null && (opts?.period == null || e.period === opts.period),
  );
  const sorted = [...active].sort((a, b) => a.matchTimeMs - b.matchTimeMs || a.createdAt - b.createdAt);
  return buildPhaseTimeSplit(sorted, opts?.period);
}

/* ------------------------------------------------------------------ */
/*  Half clock & ball-in-play breakdown                                */
/* ------------------------------------------------------------------ */

export function periodDisplayLabel(period: number): string {
  if (period === 1) return '1st half';
  if (period === 2) return '2nd half';
  return `Period ${period}`;
}

export function periodsWithEvents(events: MatchEventRecord[]): number[] {
  const set = new Set<number>();
  for (const e of events) {
    if (e.deletedAt == null) set.add(e.period);
  }
  return [...set].sort((a, b) => a - b);
}

export function periodEventSpanMs(events: MatchEventRecord[], period: number): number {
  let max = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.period !== period) continue;
    if (e.matchTimeMs > max) max = e.matchTimeMs;
  }
  return max;
}

/** Match-clock elapsed per half from session (periods 1–2 for regulation sevens). */
export function periodClockMsFromSession(
  session: MatchSessionRecord,
  nowMs: number,
): { period: number; clockMs: number }[] {
  const rows: { period: number; clockMs: number }[] = [];
  const period = session.period;

  if (period >= 2) {
    const p1Ms = session.completedMsP1 ?? bankedMatchMsBeforeCurrentPeriod(session);
    if (p1Ms > 0) rows.push({ period: 1, clockMs: p1Ms });
    const p2Ms = currentPeriodElapsedDisplayMs(session, nowMs);
    if (p2Ms > 0) rows.push({ period: 2, clockMs: p2Ms });
  } else {
    const p1Ms = currentPeriodElapsedDisplayMs(session, nowMs);
    if (p1Ms > 0) rows.push({ period: 1, clockMs: p1Ms });
  }

  return rows;
}

export type HalfTimeStats = {
  period: number;
  label: string;
  /** Match clock elapsed for the half (session preferred; else last logged event time). */
  clockMs: number | null;
  clockSource: 'match_clock' | 'event_span' | null;
  eventSpanMs: number;
  ballInPlayMs: number;
  deadTimeMs: number;
  offenseMs: number;
  defenseMs: number;
  /** Ball in play ÷ clock when clock is known. */
  ballInPlayPct: number | null;
  /** Clock minus ball in play minus scoring dead time (stoppages, halftime, uncaptured gaps). */
  stoppageMs: number | null;
};

export type MatchTimeBreakdown = {
  halves: HalfTimeStats[];
  totals: {
    clockMs: number | null;
    ballInPlayMs: number;
    deadTimeMs: number;
    offenseMs: number;
    defenseMs: number;
    ballInPlayPct: number | null;
    stoppageMs: number | null;
  };
};

function pctOf(part: number, whole: number | null): number | null {
  if (whole == null || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function buildHalfRow(
  period: number,
  events: MatchEventRecord[],
  clockMs: number | null,
  clockSource: HalfTimeStats['clockSource'],
): HalfTimeStats {
  const eventSpanMs = periodEventSpanMs(events, period);
  const resolvedClock = clockMs ?? (eventSpanMs > 0 ? eventSpanMs : null);
  const resolvedSource =
    clockSource ?? (eventSpanMs > 0 && clockMs == null ? 'event_span' : null);
  const phase = phaseTimeSplit(events, { period });
  const ballInPlayMs = phase?.playingTimeMs ?? 0;
  const deadTimeMs = phase?.deadTimeMs ?? 0;
  const offenseMs = phase?.offenseMs ?? 0;
  const defenseMs = phase?.defenseMs ?? 0;
  const stoppageMs =
    resolvedClock != null
      ? Math.max(0, resolvedClock - ballInPlayMs - deadTimeMs)
      : null;

  return {
    period,
    label: periodDisplayLabel(period),
    clockMs: resolvedClock,
    clockSource: resolvedSource,
    eventSpanMs,
    ballInPlayMs,
    deadTimeMs,
    offenseMs,
    defenseMs,
    ballInPlayPct: pctOf(ballInPlayMs, resolvedClock),
    stoppageMs,
  };
}

export function matchTimeBreakdown(
  events: MatchEventRecord[],
  session?: MatchSessionRecord | null,
  nowMs: number = Date.now(),
): MatchTimeBreakdown | null {
  const clockByPeriod = new Map<number, number>();
  if (session) {
    for (const row of periodClockMsFromSession(session, nowMs)) {
      clockByPeriod.set(row.period, row.clockMs);
    }
  }

  const periods = new Set<number>([...periodsWithEvents(events), ...clockByPeriod.keys()]);
  if (periods.size === 0) return null;

  const halves = [...periods]
    .sort((a, b) => a - b)
    .map((period) =>
      buildHalfRow(
        period,
        events,
        clockByPeriod.get(period) ?? null,
        clockByPeriod.has(period) ? 'match_clock' : null,
      ),
    )
    .filter(
      (h) =>
        h.clockMs != null ||
        h.ballInPlayMs > 0 ||
        h.deadTimeMs > 0 ||
        h.eventSpanMs > 0,
    );

  if (halves.length === 0) return null;

  const totalClockMs = halves.reduce((s, h) => s + (h.clockMs ?? 0), 0) || null;
  const totalBallInPlayMs = halves.reduce((s, h) => s + h.ballInPlayMs, 0);
  const totalDeadTimeMs = halves.reduce((s, h) => s + h.deadTimeMs, 0);
  const totalOffenseMs = halves.reduce((s, h) => s + h.offenseMs, 0);
  const totalDefenseMs = halves.reduce((s, h) => s + h.defenseMs, 0);
  const totalStoppageMs =
    totalClockMs != null
      ? Math.max(0, totalClockMs - totalBallInPlayMs - totalDeadTimeMs)
      : null;

  return {
    halves,
    totals: {
      clockMs: totalClockMs,
      ballInPlayMs: totalBallInPlayMs,
      deadTimeMs: totalDeadTimeMs,
      offenseMs: totalOffenseMs,
      defenseMs: totalDefenseMs,
      ballInPlayPct: pctOf(totalBallInPlayMs, totalClockMs),
      stoppageMs: totalStoppageMs,
    },
  };
}

export function aggregateMatchTimeBreakdown(
  rows: { events: MatchEventRecord[]; session?: MatchSessionRecord | null }[],
  nowMs: number = Date.now(),
): MatchTimeBreakdown | null {
  const byPeriod = new Map<
    number,
    {
      clockMs: number;
      clockFromSession: boolean;
      eventSpanMs: number;
      ballInPlayMs: number;
      deadTimeMs: number;
      offenseMs: number;
      defenseMs: number;
    }
  >();

  for (const row of rows) {
    const breakdown = matchTimeBreakdown(row.events, row.session, nowMs);
    if (!breakdown) continue;
    for (const h of breakdown.halves) {
      const cur = byPeriod.get(h.period) ?? {
        clockMs: 0,
        clockFromSession: false,
        eventSpanMs: 0,
        ballInPlayMs: 0,
        deadTimeMs: 0,
        offenseMs: 0,
        defenseMs: 0,
      };
      if (h.clockMs != null) {
        cur.clockMs += h.clockMs;
        if (h.clockSource === 'match_clock') cur.clockFromSession = true;
      }
      cur.eventSpanMs += h.eventSpanMs;
      cur.ballInPlayMs += h.ballInPlayMs;
      cur.deadTimeMs += h.deadTimeMs;
      cur.offenseMs += h.offenseMs;
      cur.defenseMs += h.defenseMs;
      byPeriod.set(h.period, cur);
    }
  }

  if (byPeriod.size === 0) return null;

  const halves: HalfTimeStats[] = [...byPeriod.entries()]
    .sort(([a], [b]) => a - b)
    .map(([period, acc]) => {
      const clockMs = acc.clockMs > 0 ? acc.clockMs : acc.eventSpanMs > 0 ? acc.eventSpanMs : null;
      const clockSource: HalfTimeStats['clockSource'] =
        acc.clockFromSession && acc.clockMs > 0
          ? 'match_clock'
          : acc.eventSpanMs > 0
            ? 'event_span'
            : null;
      const stoppageMs =
        clockMs != null ? Math.max(0, clockMs - acc.ballInPlayMs - acc.deadTimeMs) : null;
      return {
        period,
        label: periodDisplayLabel(period),
        clockMs,
        clockSource,
        eventSpanMs: acc.eventSpanMs,
        ballInPlayMs: acc.ballInPlayMs,
        deadTimeMs: acc.deadTimeMs,
        offenseMs: acc.offenseMs,
        defenseMs: acc.defenseMs,
        ballInPlayPct: pctOf(acc.ballInPlayMs, clockMs),
        stoppageMs,
      };
    });

  const totalClockMs = halves.reduce((s, h) => s + (h.clockMs ?? 0), 0) || null;
  const totalBallInPlayMs = halves.reduce((s, h) => s + h.ballInPlayMs, 0);
  const totalDeadTimeMs = halves.reduce((s, h) => s + h.deadTimeMs, 0);
  const totalOffenseMs = halves.reduce((s, h) => s + h.offenseMs, 0);
  const totalDefenseMs = halves.reduce((s, h) => s + h.defenseMs, 0);
  const totalStoppageMs =
    totalClockMs != null
      ? Math.max(0, totalClockMs - totalBallInPlayMs - totalDeadTimeMs)
      : null;

  return {
    halves,
    totals: {
      clockMs: totalClockMs,
      ballInPlayMs: totalBallInPlayMs,
      deadTimeMs: totalDeadTimeMs,
      offenseMs: totalOffenseMs,
      defenseMs: totalDefenseMs,
      ballInPlayPct: pctOf(totalBallInPlayMs, totalClockMs),
      stoppageMs: totalStoppageMs,
    },
  };
}
