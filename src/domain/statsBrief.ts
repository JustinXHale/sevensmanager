import type { MatchAnalyticsSnapshot } from '@/domain/matchAnalytics';
import type { PhaseTimeSplit } from '@/domain/matchAnalyticsDeep';
import type { NegativeActionRow, PenaltyTypeRow } from '@/domain/matchAnalyticsDeep';
import type { InferredMatchStats } from '@/domain/inferredStats';
import type { MatchRecord } from '@/domain/match';
import type { TeamRecord } from '@/domain/team';
import type { TeamGlobalAggregate } from '@/domain/teamGlobalStats';

function fmtDurationMs(ms: number | null): string | null {
  if (ms == null) return null;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function msToSeconds(ms: number | null): number | null {
  if (ms == null) return null;
  return Math.round(ms / 100) / 10;
}

function ruckPhaseExport(
  phase: InferredMatchStats['ruckByPhase']['attack'],
): Record<string, number | null> {
  return {
    total: phase.total,
    won: phase.won,
    lost: phase.lost,
    wonPct: phase.wonPct,
    contestedMedianSec: msToSeconds(phase.contestedMedianMs),
    uncontestedMedianSec: msToSeconds(phase.uncontestedMedianMs),
    overallMedianSec: msToSeconds(phase.overallMedianMs),
  };
}

function pctOrNull(n: number | null): number | null {
  return n;
}

function serializeInferred(stats: InferredMatchStats) {
  const attack = stats.ruckByPhase.attack;
  const defense = stats.ruckByPhase.defense;
  return {
    ballSpeed: {
      attackPasses: stats.attackPasses,
      attackOffloads: stats.attackOffloads,
      defensePassesLogged: stats.defensePasses,
      oppPassesPerDefenseMin: stats.oppPassesPerDefenseMin,
      lineBreakToTryPct: pctOrNull(stats.lineBreakToTryPct),
      avgPassChainLength: stats.avgPassChainLength,
      maxPassChainLength: stats.maxPassChainLength,
    },
    structure: {
      attackRuckWonPct: pctOrNull(stats.attackRuckWonPct),
      systemMoments: stats.systemMoments,
      systemMomentsPerOffenseMin: stats.systemMomentsPerOffenseMin,
      possessionSwings: stats.possessionSwings,
      defenseRucksWon: stats.defenseRucksWon,
      possessionSwingPct: pctOrNull(stats.possessionSwingPct),
      attackRestartWonPct: pctOrNull(stats.attackRestartWonPct),
      attackRestarts: stats.attackRestarts,
      attackRestartsWon: stats.attackRestartsWon,
      attackRestartsLost: stats.attackRestartsLost,
    },
    discipline: {
      forcedTurnovers: stats.forcedTurnovers,
      forcedTurnoversDefinition:
        'Count of forced_turnover events logged from the Defense Forced Turnover button (not derived)',
      negatives: stats.negatives,
      penaltiesConceded: stats.penaltiesConceded,
      penaltyNetAttack: stats.penaltyNetAttack,
      penaltyNetDefense: stats.penaltyNetDefense,
      knockOns: stats.knockOns,
      errorClusters: stats.errorClusters,
      longestTryDrought: fmtDurationMs(stats.longestTryDroughtMs),
      avgTryGap: fmtDurationMs(stats.avgTryGapMs),
      maxPointsIn2Min: stats.maxPointsIn2Min,
    },
    ruck: {
      contest: stats.ruckContest,
      note: 'Median ruck speeds in seconds (ruck to next pass in same phase; gaps over 12s excluded)',
      attack: ruckPhaseExport(attack),
      defense: ruckPhaseExport(defense),
    },
  };
}

export type MatchStatsBrief = {
  scope: 'match';
  match: {
    id: string;
    title: string;
    opponent: string | null;
    competition: string | null;
    kickoffDate: string | null;
    ourTeamName: string | null;
  };
  score: {
    ourPoints: number;
    oppPoints: number;
    ourTries: number;
    oppTries: number;
  };
  overview: {
    tacklesMade: number;
    tacklesMissed: number;
    tackleCompletionPct: number | null;
    substitutions: number;
    systemMoments: number;
  };
  phase: PhaseTimeSplit | null;
  ruckMedianSec: number | null;
  ruckAttackMedianSec: number | null;
  ruckDefenseMedianSec: number | null;
  passToPassMedianSec: number | null;
  ruckSpeedNote: string;
  topPenalties: { label: string; count: number }[];
  topNegatives: { label: string; count: number }[];
  inferred: ReturnType<typeof serializeInferred>;
};

export function buildMatchStatsBrief(input: {
  match: MatchRecord;
  snapshot: MatchAnalyticsSnapshot;
  inferred: InferredMatchStats;
  phase: PhaseTimeSplit | null;
  tackleCompletionPct: number | null;
  ruckMedianMs: number | null;
  ruckAttackMedianMs: number | null;
  ruckDefenseMedianMs: number | null;
  passToPassMedianMs: number | null;
  penaltyTypes: PenaltyTypeRow[];
  negativeActions: NegativeActionRow[];
  systemMoments: number;
}): MatchStatsBrief {
  const tt = input.snapshot.tackles.made + input.snapshot.tackles.missed;
  return {
    scope: 'match',
    match: {
      id: input.match.id,
      title: input.match.title?.trim() || 'Match',
      opponent: input.match.opponentName?.trim() || null,
      competition: input.match.competition?.trim() || null,
      kickoffDate: input.match.kickoffDate?.trim() || null,
      ourTeamName: input.match.ourTeamName?.trim() || null,
    },
    score: {
      ourPoints: input.snapshot.ownPoints,
      oppPoints: input.snapshot.oppPoints,
      ourTries: input.snapshot.ownTries,
      oppTries: input.snapshot.oppTries,
    },
    overview: {
      tacklesMade: input.snapshot.tackles.made,
      tacklesMissed: input.snapshot.tackles.missed,
      tackleCompletionPct:
        input.tackleCompletionPct ??
        (tt > 0 ? Math.round((input.snapshot.tackles.made / tt) * 1000) / 10 : null),
      substitutions: input.snapshot.subsOurs,
      systemMoments: input.systemMoments,
    },
    phase: input.phase,
    ruckMedianSec: msToSeconds(input.ruckMedianMs),
    ruckAttackMedianSec: msToSeconds(input.ruckAttackMedianMs),
    ruckDefenseMedianSec: msToSeconds(input.ruckDefenseMedianMs),
    passToPassMedianSec: msToSeconds(input.passToPassMedianMs),
    ruckSpeedNote:
      'Prefer inferred.ruck attack/defense medians (phase-specific). Top-level medians are pooled summaries.',
    topPenalties: input.penaltyTypes.slice(0, 6).map((r) => ({ label: r.label, count: r.count })),
    topNegatives: input.negativeActions.slice(0, 6).map((r) => ({ label: r.label, count: r.count })),
    inferred: serializeInferred(input.inferred),
  };
}

export type TeamStatsBrief = {
  scope: 'team';
  team: { id: string; name: string };
  filter: 'all_matches' | 'single_match';
  matchCount: number;
  matchLabel: string | null;
  aggregate: TeamGlobalAggregate & { tackleCompletionPct: number | null };
  phase: PhaseTimeSplit | null;
  ruckMedianSec: number | null;
  ruckAttackMedianSec: number | null;
  ruckDefenseMedianSec: number | null;
  passToPassMedianSec: number | null;
  ruckSpeedNote: string;
  topPenalties: { label: string; count: number }[];
  topNegatives: { label: string; count: number }[];
  inferred: ReturnType<typeof serializeInferred>;
};

export function buildTeamStatsBrief(input: {
  team: TeamRecord;
  aggregate: TeamGlobalAggregate;
  tackleCompletionPct: number | null;
  inferred: InferredMatchStats;
  phase: PhaseTimeSplit | null;
  ruckMedianMs: number | null;
  ruckAttackMedianMs: number | null;
  ruckDefenseMedianMs: number | null;
  passToPassMedianMs: number | null;
  penaltyTypes: PenaltyTypeRow[];
  negativeActions: NegativeActionRow[];
  isSingleMatch: boolean;
  matchLabel: string | null;
}): TeamStatsBrief {
  return {
    scope: 'team',
    team: { id: input.team.id, name: input.team.name },
    filter: input.isSingleMatch ? 'single_match' : 'all_matches',
    matchCount: input.aggregate.gameCount,
    matchLabel: input.matchLabel,
    aggregate: {
      ...input.aggregate,
      tackleCompletionPct: input.tackleCompletionPct,
    },
    phase: input.phase,
    ruckMedianSec: msToSeconds(input.ruckMedianMs),
    ruckAttackMedianSec: msToSeconds(input.ruckAttackMedianMs),
    ruckDefenseMedianSec: msToSeconds(input.ruckDefenseMedianMs),
    passToPassMedianSec: msToSeconds(input.passToPassMedianMs),
    ruckSpeedNote:
      'Prefer inferred.ruck attack/defense medians (phase-specific). Top-level medians are pooled summaries.',
    topPenalties: input.penaltyTypes.slice(0, 6).map((r) => ({ label: r.label, count: r.count })),
    topNegatives: input.negativeActions.slice(0, 6).map((r) => ({ label: r.label, count: r.count })),
    inferred: serializeInferred(input.inferred),
  };
}

export type StatsBrief = MatchStatsBrief | TeamStatsBrief;

export function statsBriefToJson(brief: StatsBrief): string {
  return JSON.stringify(brief, null, 2);
}
