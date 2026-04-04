import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { TeamMemberRecord } from '@/domain/teamMember';
import type { TeamRecord } from '@/domain/team';
import { deleteTeamCascade } from '@/repos/teamsRepo';
import { listTeamMembers } from '@/repos/teamMembersRepo';
import { defaultSessionForMatch } from '@/domain/match';
import { getSession, listMatchesForTeam } from '@/repos/matchesRepo';
import { listPlayers } from '@/repos/rosterRepo';
import { listWeighInsForTeam } from '@/repos/weighInsRepo';
import { TeamAdminSquadTab, type SquadMatchPlayContext } from './TeamAdminSquadTab';
import { TeamAdminTimelineTab } from './TeamAdminTimelineTab';

type Props = {
  team: TeamRecord;
};

/** Admin: Roster (per-game weights) vs Gameday timeline (day blocks). */
export function TeamAdminPanel({ team }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const teamId = team.id;

  const rawSection = searchParams.get('section');
  const section = rawSection === 'timeline' ? 'timeline' : 'roster';

  const setSection = useCallback(
    (next: 'roster' | 'timeline') => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('tab', 'admin');
          p.set('section', next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [members, setMembers] = useState<TeamMemberRecord[] | null>(null);
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof listMatchesForTeam>>>([]);
  const [weighRows, setWeighRows] = useState<Awaited<ReturnType<typeof listWeighInsForTeam>>>([]);
  const [matchPlayByMatchId, setMatchPlayByMatchId] = useState<Record<string, SquadMatchPlayContext>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [memberRows, matchRows, weigh] = await Promise.all([
        listTeamMembers(teamId),
        listMatchesForTeam(teamId),
        listWeighInsForTeam(teamId),
      ]);
      setMembers(memberRows);
      setMatches(matchRows);
      setWeighRows(weigh);
      const ctx: Record<string, SquadMatchPlayContext> = {};
      await Promise.all(
        matchRows.map(async (m) => {
          const [session, players] = await Promise.all([getSession(m.id), listPlayers(m.id, false)]);
          ctx[m.id] = {
            session: session ?? defaultSessionForMatch(m.id),
            players,
          };
        }),
      );
      setMatchPlayByMatchId(ctx);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setMembers([]);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDeleteTeam() {
    if (
      !confirm(
        `Delete team “${team.name}”, roster, weigh-ins, and day schedule? Matches keep their log but unlink from this team.`,
      )
    ) {
      return;
    }
    await deleteTeamCascade(teamId);
    navigate(`/competition/${team.competitionId}`);
  }

  if (members === null) {
    return (
      <section className="card">
        <p className="muted">Loading admin…</p>
      </section>
    );
  }

  return (
    <div className={`team-admin-panel${section === 'roster' ? ' team-admin-panel--roster-sticky' : ''}`}>
      <div className="team-admin-subtabs-wrap">
        <div
          className="live-tab-strip live-tab-strip-2 team-admin-subtabs"
          role="tablist"
          aria-label="Admin sections"
        >
          <button
            type="button"
            role="tab"
            id="tab-admin-roster"
            aria-selected={section === 'roster'}
            aria-controls="panel-admin-roster"
            className={`live-tab${section === 'roster' ? ' live-tab-active' : ''}`}
            onClick={() => setSection('roster')}
          >
            Roster
          </button>
          <button
            type="button"
            role="tab"
            id="tab-admin-timeline"
            aria-selected={section === 'timeline'}
            aria-controls="panel-admin-timeline"
            className={`live-tab${section === 'timeline' ? ' live-tab-active' : ''}`}
            onClick={() => setSection('timeline')}
          >
            Gameday timeline
          </button>
        </div>
      </div>

      {section === 'roster' ? (
        <div id="panel-admin-roster" role="tabpanel" aria-labelledby="tab-admin-roster">
          <TeamAdminSquadTab
            team={team}
            members={members}
            matches={matches}
            weighRows={weighRows}
            matchPlayByMatchId={matchPlayByMatchId}
            load={load}
            error={error}
            setError={setError}
          />
        </div>
      ) : (
        <div id="panel-admin-timeline" role="tabpanel" aria-labelledby="tab-admin-timeline">
          <TeamAdminTimelineTab
            team={team}
            onScheduleChanged={() => void load()}
            error={error}
            setError={setError}
          />
        </div>
      )}

      <section className="card admin-section admin-danger-zone">
        <h2 className="admin-card-title">Danger zone</h2>
        <button type="button" className="btn btn-ghost btn-danger" onClick={() => void onDeleteTeam()}>
          Delete this team
        </button>
      </section>

    </div>
  );
}
