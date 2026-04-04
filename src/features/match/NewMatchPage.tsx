import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { CompetitionRecord } from '@/domain/competition';
import type { TeamRecord } from '@/domain/team';
import { getOrCreateDefaultCompetitionId, listCompetitions } from '@/repos/competitionsRepo';
import { createMatch } from '@/repos/matchesRepo';
import { getTeam, listTeamsForCompetition } from '@/repos/teamsRepo';
import { safeReturnPath } from '@/utils/safeReturnPath';

export function NewMatchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const [title, setTitle] = useState('');
  const [ourTeamName, setOurTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [opponentAbbreviation, setOpponentAbbreviation] = useState('');
  const [kickoffDate, setKickoffDate] = useState('');
  const [location, setLocation] = useState('');
  const [competition, setCompetition] = useState('');
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const rows = await listCompetitions();
      setCompetitions(rows);
      const defId = await getOrCreateDefaultCompetitionId();
      setSelectedCompetitionId((prev) => prev || defId);
    })();
  }, []);

  useEffect(() => {
    const teamId = searchParams.get('teamId');
    const compId = searchParams.get('competitionId');
    if (teamId) {
      setSelectedTeamId(teamId);
      void getTeam(teamId).then((t) => {
        if (t) {
          setSelectedCompetitionId(t.competitionId);
          setOurTeamName(t.name);
        }
      });
    } else if (compId) {
      setSelectedCompetitionId(compId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCompetitionId) {
      setTeams([]);
      return;
    }
    void listTeamsForCompetition(selectedCompetitionId).then(setTeams);
  }, [selectedCompetitionId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const kickoff = kickoffDate.trim() ? new Date(kickoffDate).toISOString() : undefined;
      const compRecord = competitions.find((c) => c.id === selectedCompetitionId);
      const compStr = competition.trim() || compRecord?.name;
      await createMatch({
        title: title.trim() || undefined,
        ourTeamName: ourTeamName.trim() || undefined,
        opponentName: opponentName.trim() || undefined,
        opponentAbbreviation: opponentAbbreviation.trim() || undefined,
        kickoffDate: kickoff,
        location: location.trim() || undefined,
        competition: compStr || undefined,
        competitionId: selectedCompetitionId,
        teamId: selectedTeamId || undefined,
      });
      navigate(returnTo || '/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <Link to={returnTo || '/'} className="back-link">
          ← {returnTo ? 'Back' : 'Competitions'}
        </Link>
      </div>
      <div className="card">
        <h1 className="page-title">Add game</h1>
        <p className="muted form-subtitle">
          Link to a competition and team for admin (weigh-ins, schedule). Same fields as{' '}
          <Link to="/matches/import">Import schedule</Link>.
        </p>
        <form className="form" onSubmit={(e) => void onSubmit(e)}>
          <label className="field">
            <span>Competition</span>
            <select
              className="filter-select"
              value={selectedCompetitionId}
              onChange={(e) => {
                setSelectedCompetitionId(e.target.value);
                setSelectedTeamId('');
              }}
              required
              aria-label="Competition (required)"
            >
              {competitions.length === 0 ? (
                <option value="">Loading…</option>
              ) : (
                competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="field">
            <span>Admin — your team</span>
            <select
              className="filter-select"
              value={selectedTeamId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTeamId(id);
                const t = teams.find((x) => x.id === id);
                if (t) setOurTeamName(t.name);
              }}
              disabled={!selectedCompetitionId}
              aria-label="Link to team"
            >
              <option value="">— None —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional if both teams set (e.g. Pool A — Game 2)"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Our team</span>
            <input
              type="text"
              value={ourTeamName}
              onChange={(e) => setOurTeamName(e.target.value)}
              placeholder="Your side on the sheet"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Opponent</span>
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Opponent abbreviation</span>
            <input
              type="text"
              value={opponentAbbreviation}
              onChange={(e) => setOpponentAbbreviation(e.target.value.toUpperCase())}
              placeholder="e.g. EEM"
              maxLength={8}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Kickoff</span>
            <input
              type="datetime-local"
              value={kickoffDate}
              onChange={(e) => setKickoffDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Pitch, venue, or city"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Competition (display text)</span>
            <input
              type="text"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="Optional; defaults from admin competition above"
              autoComplete="off"
            />
          </label>
          <div className="form-actions">
            <Link to={returnTo || '/'} className="btn btn-ghost">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || competitions.length === 0 || !selectedCompetitionId}
            >
              {busy ? 'Saving…' : 'Save to match list'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
