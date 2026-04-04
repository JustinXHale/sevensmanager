import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { TeamRecord } from '@/domain/team';
import { useAppChrome } from '@/context/AppChromeContext';
import { getTeam } from '@/repos/teamsRepo';
import { TeamAdminPanel } from './TeamAdminPanel';
import { TeamGlobalStatsPanel } from './TeamGlobalStatsPanel';
import { TeamLivePanel } from './TeamLivePanel';

/**
 * Team context: **Admin** (roster, schedule, weigh-ins) · **Match** (games list) · **Global stats** (team trends, planned).
 * App header uses drill-in style (back + team name); tabs are first in the content area.
 */
export function TeamHubPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setTeamHeader } = useAppChrome();
  /** Default: Admin. `?tab=match` · `?tab=stats` */
  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'match' ? 'match' : tabParam === 'stats' ? 'stats' : 'admin';

  const [team, setTeam] = useState<TeamRecord | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!teamId) return;
    const t = await getTeam(teamId);
    setTeam(t ?? null);
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (team === undefined) return;
    if (team === null) {
      setTeamHeader(null);
      return;
    }
    setTeamHeader({
      title: team.name,
      backTo: `/competition/${team.competitionId}`,
      backAriaLabel: 'Back to competition',
    });
  }, [team, setTeamHeader]);

  useEffect(() => {
    return () => setTeamHeader(null);
  }, [setTeamHeader]);

  function setTab(next: 'admin' | 'match' | 'stats') {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'admin') {
          p.set('tab', 'admin');
          if (!p.get('section')) p.set('section', 'roster');
        } else if (next === 'match') {
          p.set('tab', 'match');
          p.delete('section');
        } else {
          p.set('tab', 'stats');
          p.delete('section');
        }
        return p;
      },
      { replace: true },
    );
  }

  if (team === undefined) {
    return (
      <section className="card">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  if (!teamId || team === null) {
    return (
      <section className="card">
        <p>Team not found.</p>
        <Link to="/">Home</Link>
      </section>
    );
  }

  return (
    <section className="stack team-hub-page">
      <div className="team-hub-tabs-wrap">
        <div
          className="live-tab-strip live-tab-strip-3 team-hub-tabs"
          role="tablist"
          aria-label="Team sections"
        >
          <button
            type="button"
            role="tab"
            id="tab-team-admin"
            aria-selected={tab === 'admin'}
            aria-controls="panel-team-admin"
            className={`live-tab${tab === 'admin' ? ' live-tab-active' : ''}`}
            onClick={() => setTab('admin')}
          >
            Admin
          </button>
          <button
            type="button"
            role="tab"
            id="tab-team-match"
            aria-selected={tab === 'match'}
            aria-controls="panel-team-match"
            className={`live-tab${tab === 'match' ? ' live-tab-active' : ''}`}
            onClick={() => setTab('match')}
          >
            Match
          </button>
          <button
            type="button"
            role="tab"
            id="tab-team-stats"
            aria-selected={tab === 'stats'}
            aria-controls="panel-team-stats"
            className={`live-tab${tab === 'stats' ? ' live-tab-active' : ''}`}
            onClick={() => setTab('stats')}
          >
            Global stats
          </button>
        </div>
      </div>

      {tab === 'match' ? (
        <div
          id="panel-team-match"
          role="tabpanel"
          aria-labelledby="tab-team-match"
          className="team-hub-panel"
        >
          <TeamLivePanel team={team} />
        </div>
      ) : tab === 'stats' ? (
        <div
          id="panel-team-stats"
          role="tabpanel"
          aria-labelledby="tab-team-stats"
          className="team-hub-panel"
        >
          <TeamGlobalStatsPanel team={team} />
        </div>
      ) : (
        <div
          id="panel-team-admin"
          role="tabpanel"
          aria-labelledby="tab-team-admin"
          className="team-hub-panel"
        >
          <TeamAdminPanel team={team} />
        </div>
      )}
    </section>
  );
}
