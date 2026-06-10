import { describe, expect, it } from 'vitest';
import { computeInferredMatchStats } from '@/domain/inferredStats';
import { computeMatchAnalyticsSnapshot } from '@/domain/matchAnalytics';
import type { MatchEventRecord } from '@/domain/matchEvent';
import type { MatchRecord } from '@/domain/match';
import { buildMatchStatsBrief, buildTeamStatsBrief, statsBriefToJson } from '@/domain/statsBrief';
import type { TeamRecord } from '@/domain/team';

function ev(partial: Partial<MatchEventRecord> & Pick<MatchEventRecord, 'id' | 'kind'>): MatchEventRecord {
  return {
    matchId: 'm1',
    period: 1,
    matchTimeMs: 0,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...partial,
  } as MatchEventRecord;
}

const match: MatchRecord = {
  id: 'm1',
  title: 'Pool A',
  opponentName: 'Eagles',
  ourTeamName: 'Wolves',
  createdAt: 1,
  updatedAt: 1,
};

const team: TeamRecord = {
  id: 't1',
  competitionId: 'c1',
  name: 'Wolves',
  createdAt: 1,
  updatedAt: 1,
};

describe('statsBrief', () => {
  it('builds a match brief with score and inferred metrics', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'try', matchTimeMs: 1000 }),
      ev({ id: '2', kind: 'line_break', matchTimeMs: 900 }),
      ev({ id: '3', kind: 'tackle', tackleOutcome: 'made', matchTimeMs: 2000 }),
      ev({ id: '4', kind: 'tackle', tackleOutcome: 'missed', matchTimeMs: 3000 }),
    ];
    const snapshot = computeMatchAnalyticsSnapshot(events, 0);
    const inferred = computeInferredMatchStats(events);

    const brief = buildMatchStatsBrief({
      match,
      snapshot,
      inferred,
      phase: null,
      tackleCompletionPct: 50,
      ruckMedianMs: null,
      ruckAttackMedianMs: null,
      ruckDefenseMedianMs: null,
      passToPassMedianMs: null,
      penaltyTypes: [],
      negativeActions: [],
      systemMoments: 0,
    });

    expect(brief.scope).toBe('match');
    expect(brief.score.ourTries).toBe(1);
    expect(brief.overview.tackleCompletionPct).toBe(50);
    expect(brief.inferred.ballSpeed.lineBreakToTryPct).toBe(100);
    expect(statsBriefToJson(brief)).toContain('"scope": "match"');
  });

  it('builds a pooled team brief', () => {
    const events: MatchEventRecord[] = [
      ev({ id: '1', kind: 'forced_turnover', matchTimeMs: 1000 }),
      ev({ id: '2', kind: 'negative_action', negativeActionId: 'knock_on', matchTimeMs: 2000 }),
    ];
    const inferred = computeInferredMatchStats(events);

    const brief = buildTeamStatsBrief({
      team,
      aggregate: {
        gameCount: 2,
        totalEvents: 10,
        sumOwnPoints: 14,
        sumOppPoints: 7,
        sumOwnTries: 2,
        sumOppTries: 1,
        tacklesMade: 8,
        tacklesMissed: 2,
        subsOurs: 1,
        subsOpp: 0,
      },
      tackleCompletionPct: 80,
      inferred,
      phase: null,
      ruckMedianMs: null,
      ruckAttackMedianMs: null,
      ruckDefenseMedianMs: null,
      passToPassMedianMs: null,
      penaltyTypes: [],
      negativeActions: [],
      isSingleMatch: false,
      matchLabel: null,
    });

    expect(brief.scope).toBe('team');
    expect(brief.filter).toBe('all_matches');
    expect(brief.matchCount).toBe(2);
    expect(brief.aggregate.tackleCompletionPct).toBe(80);
  });
});
