import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppChrome } from '@/context/AppChromeContext';
import type { CompetitionRecord } from '@/domain/competition';
import type { TeamRecord } from '@/domain/team';
import { getCompetition } from '@/repos/competitionsRepo';
import { createTeam, deleteTeamCascade, listTeamsForCompetition, updateTeam } from '@/repos/teamsRepo';

export function CompetitionDetailPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { setTeamHeader } = useAppChrome();
  const [comp, setComp] = useState<CompetitionRecord | null | undefined>(undefined);
  const [teams, setTeams] = useState<TeamRecord[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamRecord | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!competitionId) return;
    try {
      const c = await getCompetition(competitionId);
      setComp(c ?? null);
      setTeams(await listTeamsForCompetition(competitionId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setComp(null);
      setTeams([]);
    }
  }, [competitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (comp === undefined || teams === null) return;
    if (!competitionId || comp === null) {
      setTeamHeader(null);
      return;
    }
    setTeamHeader({
      title: comp.name,
      backTo: comp.clubId ? `/club/${comp.clubId}/competitions` : '/',
      backAriaLabel: 'Back to competitions',
    });
    return () => setTeamHeader(null);
  }, [comp, teams, competitionId, setTeamHeader]);

  async function onDeleteTeam(teamId: string, teamName: string) {
    if (!confirm(`Delete "${teamName}", its roster, weigh-ins, and schedule? Linked matches keep their log but unlink.`)) return;
    setError(null);
    try {
      await deleteTeamCascade(teamId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete team');
    }
  }

  function openEditTeam(t: TeamRecord) {
    setEditTeam(t);
    setEditName(t.name);
  }

  async function onSaveEditTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!editTeam) return;
    const n = editName.trim();
    if (!n) return;
    await updateTeam(editTeam.id, n);
    setEditTeam(null);
    await load();
  }

  async function onCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!competitionId) return;
    const n = name.trim();
    if (!n) return;
    await createTeam(competitionId, n);
    setName('');
    setAddTeamModalOpen(false);
    await load();
  }

  if (comp === undefined || teams === null) {
    return (
      <section className="card">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  if (!competitionId || comp === null) {
    return (
      <section className="card">
        <p>Competition not found.</p>
        <Link to="/">Back</Link>
      </section>
    );
  }

  return (
    <div className="competitions-page competition-detail-page">
      <div className="competitions-page-body">
        <h1 className="visually-hidden">{comp.name}</h1>
        {error ? <p className="error-text">{error}</p> : null}

        <h2 className="admin-card-title section-title-teams">Teams</h2>
        {teams.length === 0 ? (
          <div className="card empty-card">
            <p className="muted">
              No teams yet. Tap <strong>Add team</strong> below.
            </p>
          </div>
        ) : (
          <ul className="match-list">
            {teams.map((t) => (
              <li key={t.id} className="match-row match-row--with-action">
                <Link to={`/team/${t.id}?tab=admin&section=roster`} className="match-row-main">
                  <span className="match-title">{t.name}</span>
                  <span className="match-meta">Updated {formatDate(t.updatedAt)}</span>
                </Link>
                <button
                  type="button"
                  className="match-row-action"
                  title={`Rename ${t.name}`}
                  aria-label={`Rename ${t.name}`}
                  onClick={() => openEditTeam(t)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="match-row-delete"
                  title={`Delete ${t.name}`}
                  aria-label={`Delete ${t.name}`}
                  onClick={() => void onDeleteTeam(t.id, t.name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="competitions-sticky-footer" role="toolbar" aria-label="Add team">
        <button
          type="button"
          className="btn btn-primary competitions-sticky-main"
          onClick={() => setAddTeamModalOpen(true)}
        >
          Add team
        </button>
      </div>

      {addTeamModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddTeamModalOpen(false)}>
          <div
            className="modal-card card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comp-add-team-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="comp-add-team-title" className="admin-card-title">
              Add team
            </h2>
            <p className="muted form-subtitle">Enter a team name — then open it for roster, timeline, and weigh-ins.</p>
            <form className="form" onSubmit={(e) => void onCreateTeam(e)}>
              <label className="field">
                <span>Team name</span>
                <input
                  className="filter-select"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. U18 Boys"
                  autoFocus
                  aria-label="Team name"
                />
              </label>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAddTeamModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                  Add team
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editTeam ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditTeam(null)}>
          <div
            className="modal-card card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comp-edit-team-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="comp-edit-team-title" className="admin-card-title">
              Rename team
            </h2>
            <form className="form" onSubmit={(e) => void onSaveEditTeam(e)}>
              <label className="field">
                <span>Team name</span>
                <input
                  className="filter-select"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  aria-label="Team name"
                />
              </label>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditTeam(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!editName.trim()}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium' });
}
