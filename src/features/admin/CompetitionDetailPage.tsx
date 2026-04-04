import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppChrome } from '@/context/AppChromeContext';
import type { CompetitionRecord } from '@/domain/competition';
import type { TeamRecord } from '@/domain/team';
import { deleteCompetition, getCompetition } from '@/repos/competitionsRepo';
import { createTeam, listTeamsForCompetition } from '@/repos/teamsRepo';

export function CompetitionDetailPage() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const navigate = useNavigate();
  const { setTeamHeader } = useAppChrome();
  const [comp, setComp] = useState<CompetitionRecord | null | undefined>(undefined);
  const [teams, setTeams] = useState<TeamRecord[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  async function onDeleteCompetition() {
    if (!competitionId || !comp || deleteBusy) return;
    if (
      !confirm(
        `Delete “${comp.name}” and all teams under it? Linked matches keep their log but lose admin links.`,
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteCompetition(competitionId);
      navigate(comp.clubId ? `/club/${comp.clubId}/competitions` : '/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete competition');
    } finally {
      setDeleteBusy(false);
    }
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
              <li key={t.id} className="match-row">
                <Link to={`/team/${t.id}?tab=admin&section=roster`} className="match-row-main">
                  <span className="match-title">{t.name}</span>
                  <span className="match-meta">Open for admin</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="competition-delete-wrap">
          <button
            type="button"
            className="competition-delete-link"
            disabled={deleteBusy}
            onClick={() => void onDeleteCompetition()}
          >
            {deleteBusy ? 'Deleting…' : 'Delete competition'}
          </button>
        </p>
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
    </div>
  );
}
