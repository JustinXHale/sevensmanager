import { computePossessionStats, aggregatePossessionStats } from '@/domain/possessions';
import { phaseTimeSplit, ruckSpeedMedianMs, scoringTimeline, setPieceByPhase } from '@/domain/matchAnalyticsDeep';
import type { MatchEventRecord, PlayPhaseContext } from '@/domain/matchEvent';
import { resolvePenaltyDirection } from '@/domain/matchEvent';
import {
  countEventsByKind,
  isOurPassEvent,
  ruckToFirstPassDurationsMs,
  sortMatchEventsByTime,
} from '@/domain/matchStats';
import { countDefensePasses, countPassesAndOffloads } from '@/domain/tallyStats';

const ERROR_CLUSTER_WINDOW_MS = 90_000;
const POSSESSION_SWING_WINDOW_MS = 45_000;
const SCORING_BURST_WINDOW_MS = 120_000;

function pct(num: number, den: number): number | null {
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function countKind(events: MatchEventRecord[], kind: MatchEventRecord['kind']): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== kind) continue;
    n += 1;
  }
  return n;
}

function countLineBreaks(events: MatchEventRecord[]): number {
  return countKind(events, 'line_break');
}

function countTries(events: MatchEventRecord[]): number {
  return countKind(events, 'try');
}

function countNegatives(events: MatchEventRecord[]): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'negative_action') continue;
    n += 1;
  }
  return n;
}

function countPenaltiesConceded(events: MatchEventRecord[], phase?: PlayPhaseContext): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'team_penalty') continue;
    if (phase != null && e.playPhaseContext !== phase) continue;
    if (resolvePenaltyDirection(e) === 'conceded') n += 1;
  }
  return n;
}

function countPenaltiesAwarded(events: MatchEventRecord[], phase?: PlayPhaseContext): number {
  let n = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'team_penalty') continue;
    if (phase != null && e.playPhaseContext !== phase) continue;
    if (resolvePenaltyDirection(e) === 'awarded') n += 1;
  }
  return n;
}

export type RuckContestStats = {
  contested: number;
  uncontested: number;
  unknown: number;
  contestedMedianMs: number | null;
  uncontestedMedianMs: number | null;
};

export type RuckPhaseDetail = {
  total: number;
  contested: number;
  uncontested: number;
  unknownContest: number;
  won: number;
  lost: number;
  penalized: number;
  freeKick: number;
  wonPct: number | null;
  contestedMedianMs: number | null;
  uncontestedMedianMs: number | null;
  overallMedianMs: number | null;
};

export type RuckBreakdownByPhase = {
  attack: RuckPhaseDetail;
  defense: RuckPhaseDetail;
};

export type InferredMatchStats = {
  ruckContest: RuckContestStats;
  ruckByPhase: RuckBreakdownByPhase;
  lineBreakToTryPct: number | null;
  attackRuckWonPct: number | null;
  systemMoments: number;
  systemMomentsPerOffenseMin: number | null;
  forcedTurnovers: number;
  negatives: number;
  penaltiesConceded: number;
  turnoverBalance: number;
  penaltyNetAttack: number;
  penaltyNetDefense: number;
  penAttackAwarded: number;
  penAttackConceded: number;
  penDefenseAwarded: number;
  penDefenseConceded: number;
  avgPassChainLength: number | null;
  maxPassChainLength: number;
  attackPasses: number;
  attackOffloads: number;
  defensePasses: number;
  oppPassesPerDefenseMin: number | null;
  possessionSwings: number;
  defenseRucksWon: number;
  possessionSwingPct: number | null;
  longestTryDroughtMs: number | null;
  avgTryGapMs: number | null;
  maxPointsIn2Min: number;
  attackRestartWonPct: number | null;
  attackRestarts: number;
  attackRestartsWon: number;
  attackRestartsLost: number;
  errorClusters: number;
  knockOns: number;
  possessionsUs: number;
  possessionsOpp: number;
  possessionsTotal: number;
  passesPerPossessionUs: number | null;
  passesPerPossessionOpp: number | null;
};

function emptyRuckPhaseDetail(): RuckPhaseDetail {
  return {
    total: 0,
    contested: 0,
    uncontested: 0,
    unknownContest: 0,
    won: 0,
    lost: 0,
    penalized: 0,
    freeKick: 0,
    wonPct: null,
    contestedMedianMs: null,
    uncontestedMedianMs: null,
    overallMedianMs: null,
  };
}

function finalizeRuckPhaseDetail(
  detail: RuckPhaseDetail,
  events: MatchEventRecord[],
  phase: PlayPhaseContext,
): RuckPhaseDetail {
  const decided = detail.won + detail.lost;
  return {
    ...detail,
    wonPct: pct(detail.won, decided),
    contestedMedianMs: ruckSpeedMedianMs(ruckToFirstPassDurationsMs(events, phase, 'contested')),
    uncontestedMedianMs: ruckSpeedMedianMs(ruckToFirstPassDurationsMs(events, phase, 'uncontested')),
    overallMedianMs: ruckSpeedMedianMs(ruckToFirstPassDurationsMs(events, phase)),
  };
}

export function computeRuckBreakdownByPhase(events: MatchEventRecord[]): RuckBreakdownByPhase {
  const attack = emptyRuckPhaseDetail();
  const defense = emptyRuckPhaseDetail();

  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'ruck') continue;
    const bucket = e.playPhaseContext === 'defense' ? defense : attack;

    bucket.total += 1;
    if (e.ruckContest === 'contested') bucket.contested += 1;
    else if (e.ruckContest === 'uncontested') bucket.uncontested += 1;
    else bucket.unknownContest += 1;

    const o = e.setPieceOutcome;
    if (o === 'won') bucket.won += 1;
    else if (o === 'lost') bucket.lost += 1;
    else if (o === 'penalized') bucket.penalized += 1;
    else if (o === 'free_kick') bucket.freeKick += 1;
  }

  return {
    attack: finalizeRuckPhaseDetail(attack, events, 'attack'),
    defense: finalizeRuckPhaseDetail(defense, events, 'defense'),
  };
}

function aggregateRuckPhaseDetail(
  parts: RuckPhaseDetail[],
  contestedDurations: number[],
  uncontestedDurations: number[],
  overallDurations: number[],
): RuckPhaseDetail {
  const merged = emptyRuckPhaseDetail();
  for (const p of parts) {
    merged.total += p.total;
    merged.contested += p.contested;
    merged.uncontested += p.uncontested;
    merged.unknownContest += p.unknownContest;
    merged.won += p.won;
    merged.lost += p.lost;
    merged.penalized += p.penalized;
    merged.freeKick += p.freeKick;
  }
  return {
    ...merged,
    wonPct: pct(merged.won, merged.won + merged.lost),
    contestedMedianMs: ruckSpeedMedianMs(contestedDurations),
    uncontestedMedianMs: ruckSpeedMedianMs(uncontestedDurations),
    overallMedianMs: ruckSpeedMedianMs(overallDurations),
  };
}

export function computeRuckContestStats(events: MatchEventRecord[]): RuckContestStats {
  let contested = 0;
  let uncontested = 0;
  let unknown = 0;
  for (const e of events) {
    if (e.deletedAt != null || e.kind !== 'ruck') continue;
    if (e.ruckContest === 'contested') contested += 1;
    else if (e.ruckContest === 'uncontested') uncontested += 1;
    else unknown += 1;
  }
  return {
    contested,
    uncontested,
    unknown,
    contestedMedianMs: ruckSpeedMedianMs(ruckToFirstPassDurationsMs(events, undefined, 'contested')),
    uncontestedMedianMs: ruckSpeedMedianMs(ruckToFirstPassDurationsMs(events, undefined, 'uncontested')),
  };
}

/** Lengths of consecutive our-team pass runs (each run ends at a non-pass). */
export function passChainLengths(events: MatchEventRecord[]): number[] {
  const sorted = sortMatchEventsByTime(events);
  const chains: number[] = [];
  let chain = 0;
  for (const e of sorted) {
    if (e.deletedAt != null) continue;
    if (isOurPassEvent(e)) {
      chain += 1;
    } else if (chain > 0) {
      chains.push(chain);
      chain = 0;
    }
  }
  if (chain > 0) chains.push(chain);
  return chains;
}

function isOurScoringTurnover(e: MatchEventRecord): boolean {
  if (e.deletedAt != null) return false;
  if (e.kind === 'opponent_try') return true;
  if (e.kind === 'scrum' || e.kind === 'lineout' || e.kind === 'ruck' || e.kind === 'restart') {
    return e.playPhaseContext === 'defense' && e.setPieceOutcome === 'lost';
  }
  return false;
}

export function computeInferredMatchStats(events: MatchEventRecord[]): InferredMatchStats {
  const byKind = countEventsByKind(events);
  const lineBreaks = countLineBreaks(events);
  const tries = countTries(events);
  const phase = phaseTimeSplit(events);
  const chains = passChainLengths(events);
  const defenseMs = phase?.defenseMs ?? 0;
  const offenseMs = phase?.offenseMs ?? 0;
  const systemMoments = byKind.system_moment ?? 0;
  const forcedTurnovers = byKind.forced_turnover ?? 0;
  const negatives = countNegatives(events);
  const penaltiesConceded = countPenaltiesConceded(events);
  const knockOns = events.filter(
    (e) => e.deletedAt == null && e.kind === 'negative_action' && e.negativeActionId === 'knock_on',
  ).length;

  let possessionSwings = 0;
  let defenseRucksWon = 0;
  const sorted = sortMatchEventsByTime(events);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    if (e.deletedAt != null || e.kind !== 'ruck') continue;
    if (e.playPhaseContext !== 'defense' || e.setPieceOutcome !== 'won') continue;
    defenseRucksWon += 1;
    const t0 = e.matchTimeMs;
    const p0 = e.period;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j]!;
      if (next.period !== p0) break;
      if (next.matchTimeMs - t0 > POSSESSION_SWING_WINDOW_MS) break;
      if (isOurPassEvent(next)) {
        possessionSwings += 1;
        break;
      }
    }
  }

  const ourTries = scoringTimeline(events)
    .filter((m) => m.side === 'us' && m.kind === 'try')
    .map((m) => m.matchTimeMs);
  let longestTryDroughtMs: number | null = null;
  let avgTryGapMs: number | null = null;
  if (ourTries.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < ourTries.length; i++) {
      gaps.push(ourTries[i]! - ourTries[i - 1]!);
    }
    longestTryDroughtMs = Math.max(...gaps);
    avgTryGapMs = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  const pointsByWindow = new Map<number, number>();
  for (const m of scoringTimeline(events)) {
    if (m.side !== 'us' || m.points <= 0) continue;
    const bucket = Math.floor(m.matchTimeMs / SCORING_BURST_WINDOW_MS);
    pointsByWindow.set(bucket, (pointsByWindow.get(bucket) ?? 0) + m.points);
  }
  const maxPointsIn2Min = pointsByWindow.size > 0 ? Math.max(...pointsByWindow.values()) : 0;

  const attackRestarts = setPieceByPhase(events, 'restart').attack;
  const attackRestartDecided = attackRestarts.won + attackRestarts.lost;

  let errorClusters = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    if (e.deletedAt != null || e.kind !== 'negative_action' || e.negativeActionId !== 'knock_on') continue;
    const t0 = e.matchTimeMs;
    const p0 = e.period;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j]!;
      if (next.period !== p0) break;
      if (next.matchTimeMs - t0 > ERROR_CLUSTER_WINDOW_MS) break;
      if (isOurScoringTurnover(next)) {
        errorClusters += 1;
        break;
      }
    }
  }

  const penAtkAwarded = countPenaltiesAwarded(events, 'attack');
  const penAtkConceded = countPenaltiesConceded(events, 'attack');
  const penDefAwarded = countPenaltiesAwarded(events, 'defense');
  const penDefConceded = countPenaltiesConceded(events, 'defense');

  const ruckByPhase = computeRuckBreakdownByPhase(events);
  const { pass: attackPasses, offload: attackOffloads } = countPassesAndOffloads(events);
  const defensePasses = countDefensePasses(events);
  const possessions = computePossessionStats(events);

  return {
    ruckContest: computeRuckContestStats(events),
    ruckByPhase,
    lineBreakToTryPct: pct(tries, lineBreaks),
    attackRuckWonPct: ruckByPhase.attack.wonPct,
    systemMoments,
    systemMomentsPerOffenseMin:
      offenseMs > 0 ? Math.round((systemMoments / (offenseMs / 60_000)) * 100) / 100 : null,
    forcedTurnovers,
    negatives,
    penaltiesConceded,
    turnoverBalance: forcedTurnovers - (negatives + penaltiesConceded),
    penaltyNetAttack: penAtkAwarded - penAtkConceded,
    penaltyNetDefense: penDefAwarded - penDefConceded,
    penAttackAwarded: penAtkAwarded,
    penAttackConceded: penAtkConceded,
    penDefenseAwarded: penDefAwarded,
    penDefenseConceded: penDefConceded,
    avgPassChainLength:
      chains.length > 0
        ? Math.round((chains.reduce((a, b) => a + b, 0) / chains.length) * 10) / 10
        : null,
    maxPassChainLength: chains.length > 0 ? Math.max(...chains) : 0,
    attackPasses,
    attackOffloads,
    defensePasses,
    oppPassesPerDefenseMin:
      defenseMs > 0 ? Math.round((defensePasses / (defenseMs / 60_000)) * 10) / 10 : null,
    possessionSwings,
    defenseRucksWon,
    possessionSwingPct: pct(possessionSwings, defenseRucksWon),
    longestTryDroughtMs,
    avgTryGapMs,
    maxPointsIn2Min,
    attackRestartWonPct: pct(attackRestarts.won, attackRestartDecided),
    attackRestarts: attackRestartDecided,
    attackRestartsWon: attackRestarts.won,
    attackRestartsLost: attackRestarts.lost,
    errorClusters,
    knockOns,
    possessionsUs: possessions.us,
    possessionsOpp: possessions.opp,
    possessionsTotal: possessions.total,
    passesPerPossessionUs: possessions.passesPerPossessionUs,
    passesPerPossessionOpp: possessions.passesPerPossessionOpp,
  };
}

/** Sum counts across matches; recompute rates from pooled totals. */
export function aggregateInferredStats(batches: MatchEventRecord[][]): InferredMatchStats {
  const flat = batches.flat();
  if (flat.length === 0) {
    return computeInferredMatchStats([]);
  }

  let contested = 0;
  let uncontested = 0;
  let unknown = 0;
  const contestedDurations: number[] = [];
  const uncontestedDurations: number[] = [];
  let lineBreaks = 0;
  let tries = 0;
  let systemMoments = 0;
  let forcedTurnovers = 0;
  let negatives = 0;
  let penaltiesConceded = 0;
  let knockOns = 0;
  let possessionSwings = 0;
  let defenseRucksWon = 0;
  let errorClusters = 0;
  let offenseMs = 0;
  let defenseMs = 0;
  let attackRestartsWon = 0;
  let attackRestartsLost = 0;
  const attackPhaseParts: RuckPhaseDetail[] = [];
  const defensePhaseParts: RuckPhaseDetail[] = [];
  const atkConDur: number[] = [];
  const atkUncDur: number[] = [];
  const atkAllDur: number[] = [];
  const defConDur: number[] = [];
  const defUncDur: number[] = [];
  const defAllDur: number[] = [];
  const allChains: number[] = [];
  let penAtkAwarded = 0;
  let penAtkConceded = 0;
  let penDefAwarded = 0;
  let penDefConceded = 0;
  let defensePasses = 0;
  let attackPasses = 0;
  let attackOffloads = 0;

  const tryTimes: number[] = [];
  const pointsByWindow = new Map<number, number>();

  for (const batch of batches) {
    const s = computeInferredMatchStats(batch);
    const rc = s.ruckContest;
    contested += rc.contested;
    uncontested += rc.uncontested;
    unknown += rc.unknown;
    contestedDurations.push(...ruckToFirstPassDurationsMs(batch, undefined, 'contested'));
    uncontestedDurations.push(...ruckToFirstPassDurationsMs(batch, undefined, 'uncontested'));
    lineBreaks += countLineBreaks(batch);
    tries += countTries(batch);
    systemMoments += s.systemMoments;
    forcedTurnovers += s.forcedTurnovers;
    negatives += s.negatives;
    penaltiesConceded += s.penaltiesConceded;
    knockOns += s.knockOns;
    possessionSwings += s.possessionSwings;
    defenseRucksWon += s.defenseRucksWon;
    errorClusters += s.errorClusters;
    allChains.push(...passChainLengths(batch));
    const passCounts = countPassesAndOffloads(batch);
    attackPasses += passCounts.pass;
    attackOffloads += passCounts.offload;
    defensePasses += countDefensePasses(batch);
    penAtkAwarded += countPenaltiesAwarded(batch, 'attack');
    penAtkConceded += countPenaltiesConceded(batch, 'attack');
    penDefAwarded += countPenaltiesAwarded(batch, 'defense');
    penDefConceded += countPenaltiesConceded(batch, 'defense');

    const pt = phaseTimeSplit(batch);
    if (pt) {
      offenseMs += pt.offenseMs;
      defenseMs += pt.defenseMs;
    }

    const rb = computeRuckBreakdownByPhase(batch);
    attackPhaseParts.push(rb.attack);
    defensePhaseParts.push(rb.defense);
    atkConDur.push(...ruckToFirstPassDurationsMs(batch, 'attack', 'contested'));
    atkUncDur.push(...ruckToFirstPassDurationsMs(batch, 'attack', 'uncontested'));
    atkAllDur.push(...ruckToFirstPassDurationsMs(batch, 'attack'));
    defConDur.push(...ruckToFirstPassDurationsMs(batch, 'defense', 'contested'));
    defUncDur.push(...ruckToFirstPassDurationsMs(batch, 'defense', 'uncontested'));
    defAllDur.push(...ruckToFirstPassDurationsMs(batch, 'defense'));

    const atkRestart = setPieceByPhase(batch, 'restart').attack;
    attackRestartsWon += atkRestart.won;
    attackRestartsLost += atkRestart.lost;

    for (const m of scoringTimeline(batch)) {
      if (m.side === 'us' && m.kind === 'try') tryTimes.push(m.matchTimeMs);
      if (m.side === 'us' && m.points > 0) {
        const bucket = Math.floor(m.matchTimeMs / SCORING_BURST_WINDOW_MS);
        pointsByWindow.set(bucket, (pointsByWindow.get(bucket) ?? 0) + m.points);
      }
    }
  }

  tryTimes.sort((a, b) => a - b);
  let longestTryDroughtMs: number | null = null;
  let avgTryGapMs: number | null = null;
  if (tryTimes.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < tryTimes.length; i++) gaps.push(tryTimes[i]! - tryTimes[i - 1]!);
    longestTryDroughtMs = Math.max(...gaps);
    avgTryGapMs = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  const attackRestartDecided = attackRestartsWon + attackRestartsLost;
  const ruckByPhase: RuckBreakdownByPhase = {
    attack: aggregateRuckPhaseDetail(attackPhaseParts, atkConDur, atkUncDur, atkAllDur),
    defense: aggregateRuckPhaseDetail(defensePhaseParts, defConDur, defUncDur, defAllDur),
  };
  const possessions = aggregatePossessionStats(batches);

  return {
    ruckContest: {
      contested,
      uncontested,
      unknown,
      contestedMedianMs: ruckSpeedMedianMs(contestedDurations),
      uncontestedMedianMs: ruckSpeedMedianMs(uncontestedDurations),
    },
    ruckByPhase,
    lineBreakToTryPct: pct(tries, lineBreaks),
    attackRuckWonPct: ruckByPhase.attack.wonPct,
    systemMoments,
    systemMomentsPerOffenseMin:
      offenseMs > 0 ? Math.round((systemMoments / (offenseMs / 60_000)) * 100) / 100 : null,
    forcedTurnovers,
    negatives,
    penaltiesConceded,
    turnoverBalance: forcedTurnovers - (negatives + penaltiesConceded),
    penaltyNetAttack: penAtkAwarded - penAtkConceded,
    penaltyNetDefense: penDefAwarded - penDefConceded,
    penAttackAwarded: penAtkAwarded,
    penAttackConceded: penAtkConceded,
    penDefenseAwarded: penDefAwarded,
    penDefenseConceded: penDefConceded,
    avgPassChainLength:
      allChains.length > 0
        ? Math.round((allChains.reduce((a, b) => a + b, 0) / allChains.length) * 10) / 10
        : null,
    maxPassChainLength: allChains.length > 0 ? Math.max(...allChains) : 0,
    attackPasses,
    attackOffloads,
    defensePasses,
    oppPassesPerDefenseMin:
      defenseMs > 0 ? Math.round((defensePasses / (defenseMs / 60_000)) * 10) / 10 : null,
    possessionSwings,
    defenseRucksWon,
    possessionSwingPct: pct(possessionSwings, defenseRucksWon),
    longestTryDroughtMs,
    avgTryGapMs,
    maxPointsIn2Min: pointsByWindow.size > 0 ? Math.max(...pointsByWindow.values()) : 0,
    attackRestartWonPct: pct(attackRestartsWon, attackRestartDecided),
    attackRestarts: attackRestartDecided,
    attackRestartsWon,
    attackRestartsLost,
    errorClusters,
    knockOns,
    possessionsUs: possessions.us,
    possessionsOpp: possessions.opp,
    possessionsTotal: possessions.total,
    passesPerPossessionUs: possessions.passesPerPossessionUs,
    passesPerPossessionOpp: possessions.passesPerPossessionOpp,
  };
}

export function hasRuckBreakdownData(r: RuckBreakdownByPhase): boolean {
  return r.attack.total > 0 || r.defense.total > 0;
}

export function hasInferredStatsData(s: InferredMatchStats): boolean {
  return (
    hasRuckBreakdownData(s.ruckByPhase) ||
    s.ruckContest.contested + s.ruckContest.uncontested + s.ruckContest.unknown > 0 ||
    s.lineBreakToTryPct != null ||
    s.systemMoments > 0 ||
    s.forcedTurnovers > 0 ||
    s.negatives > 0 ||
    s.penaltiesConceded > 0 ||
    s.avgPassChainLength != null ||
    s.attackPasses > 0 ||
    s.defensePasses > 0 ||
    s.oppPassesPerDefenseMin != null ||
    s.possessionSwings > 0 ||
    s.longestTryDroughtMs != null ||
    s.maxPointsIn2Min > 0 ||
    s.attackRestarts > 0 ||
    s.errorClusters > 0 ||
    s.possessionsTotal > 0
  );
}
