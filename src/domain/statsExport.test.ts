import { describe, expect, it } from 'vitest';
import type { InferredMatchStats } from '@/domain/inferredStats';
import type { MatchRecord } from '@/domain/match';
import type { TeamGlobalAggregate } from '@/domain/teamGlobalStats';
import { buildGlobalOnePagerHtml, buildMatchOnePagerHtml, buildStatsExportDocument } from './statsExport';
import type { TeamRecord } from '@/domain/team';

const match: MatchRecord = {
  id: 'm1',
  teamId: 't1',
  title: 'Pool game 1',
  ourTeamName: 'Eagles',
  opponentName: 'Hawks',
  competition: 'Summer 7s',
  kickoffDate: '2026-06-01T18:00:00.000Z',
  createdAt: 1,
  updatedAt: 1,
};

const team: TeamRecord = {
  id: 't1',
  competitionId: 'c1',
  name: 'Eagles',
  createdAt: 1,
  updatedAt: 1,
};

describe('statsExport', () => {
  it('builds match one-pager with escaped title', () => {
    const html = buildMatchOnePagerHtml({
      match: { ...match, title: 'Game <script>' },
      events: [],
      substitutionCount: 0,
      playersById: new Map(),
    });
    expect(html).toContain('Game &lt;script&gt;');
    expect(html).toContain('Eagles vs Hawks');
  });

  it('builds global one-pager with team name', () => {
    const aggregate = {
      gameCount: 3,
      totalEvents: 120,
      sumOwnPoints: 45,
      sumOppPoints: 38,
      sumOwnTries: 9,
      sumOppTries: 7,
      tacklesMade: 40,
      tacklesMissed: 10,
      subsOurs: 6,
      subsOpp: 4,
    } satisfies TeamGlobalAggregate;
    const inferred = { attackPasses: 0, defensePasses: 0 } as InferredMatchStats;
    const html = buildGlobalOnePagerHtml({
      team,
      competitionLabel: 'Summer 7s',
      aggregate,
      tacklePct: 80,
      inferred,
      phase: null,
      matchCount: 3,
    });
    expect(html).toContain('Global stats');
    expect(html).toContain('Eagles');
  });

  it('wraps pages in a full HTML document', () => {
    const doc = buildStatsExportDocument(['<section class="stats-export-page">x</section>']);
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('stats-export-page');
  });
});
