import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClubRecord } from '@/domain/club';
import { formatCompetitionDateLabel, type CompetitionRecord } from '@/domain/competition';
import { useAppChrome } from '@/context/AppChromeContext';
import { ClubTeamFormModal } from '@/features/clubs/ClubTeamFormModal';
import { getClub } from '@/repos/clubsRepo';
import { scaffoldQuickStartForClub } from '@/repos/clubScaffold';
import { createCompetition, deleteCompetition, listCompetitionsForClub, updateCompetition } from '@/repos/competitionsRepo';
import { seedDemoCoastalPack } from '@/repos/demoSeed';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';

export function CompetitionHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { setTeamHeader } = useAppChrome();
  const [clubRecord, setClubRecord] = useState<ClubRecord | null>(null);
  const [rows, setRows] = useState<CompetitionRecord[] | null>(null);
  const [teamEditOpen, setTeamEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleMsg, setSampleMsg] = useState<string | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [editComp, setEditComp] = useState<CompetitionRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const createDlgRef = useRef<HTMLDialogElement>(null);
  const editDlgRef = useRef<HTMLDialogElement>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useBeforeUnload(createModalOpen && createName.trim() !== '');
  useBeforeUnload(editComp !== null && editName.trim() !== '');

  const load = useCallback(async () => {
    if (!clubId) {
      setRows([]);
      setClubRecord(null);
      return;
    }
    try {
      const c = await getClub(clubId);
      if (!c) {
        setRows([]);
        setClubRecord(null);
        setError('Club not found.');
        return;
      }
      setClubRecord(c);
      setRows(await listCompetitionsForClub(clubId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!clubRecord) {
      setTeamHeader(null);
      return;
    }
    setTeamHeader({
      clubCompetitionsBar: {
        teamName: clubRecord.name,
        onEditTeam: () => setTeamEditOpen(true),
      },
    });
    return () => setTeamHeader(null);
  }, [clubRecord, setTeamHeader]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const el = createDlgRef.current;
    if (!el) return;
    if (createModalOpen && !el.open) el.showModal();
    else if (!createModalOpen && el.open) el.close();
  }, [createModalOpen]);

  useEffect(() => {
    const el = editDlgRef.current;
    if (!el) return;
    if (editComp && !el.open) el.showModal();
    else if (!editComp && el.open) el.close();
  }, [editComp]);

  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(null), 2500);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  async function onCreateFromModal(e: React.FormEvent) {
    e.preventDefault();
    const n = createName.trim();
    if (!n || !clubId) return;
    setCreateBusy(true);
    try {
      const rec = await createCompetition({
        name: n,
        clubId,
        startDate: createStartDate,
        endDate: createEndDate,
        location: createLocation,
      });
      setCreateName('');
      setCreateStartDate('');
      setCreateEndDate('');
      setCreateLocation('');
      setCreateModalOpen(false);
      setSuccessMsg('Competition created.');
      navigate(`/competition/${rec.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create');
    } finally {
      setCreateBusy(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete “${label}” and all teams under it? Linked matches keep their log but lose admin links.`)) return;
    await deleteCompetition(id);
    await load();
    setSuccessMsg('Competition deleted.');
  }

  function openEdit(c: CompetitionRecord) {
    setEditComp(c);
    setEditName(c.name);
    setEditStartDate(c.startDate ?? '');
    setEditEndDate(c.endDate ?? '');
    setEditLocation(c.location ?? '');
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editComp || !editName.trim()) return;
    setEditBusy(true);
    try {
      await updateCompetition(editComp.id, {
        name: editName,
        startDate: editStartDate,
        endDate: editEndDate,
        location: editLocation,
      });
      setEditComp(null);
      await load();
      setSuccessMsg('Competition updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    } finally {
      setEditBusy(false);
    }
  }

  async function onLoadSampleData() {
    setMenuOpen(false);
    setSampleMsg(null);
    setSampleBusy(true);
    try {
      if (!clubId) return;
      const r = await seedDemoCoastalPack(clubId);
      if (r.ok) {
        await load();
      } else {
        setSampleMsg(r.message);
      }
    } catch (e) {
      setSampleMsg(e instanceof Error ? e.message : 'Could not load sample data.');
    } finally {
      setSampleBusy(false);
    }
  }

  async function openQuickCreate() {
    setMenuOpen(false);
    if (!clubId || quickBusy) return;
    setQuickBusy(true);
    setError(null);
    try {
      const { competitionId } = await scaffoldQuickStartForClub(clubId);
      await load();
      setSuccessMsg('Quick create: Generic competition, Team A, and a match vs Opponents.');
      navigate(`/competition/${competitionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not quick-create');
    } finally {
      setQuickBusy(false);
    }
  }

  if (!clubId) {
    return (
      <section className="card">
        <p>Missing club context.</p>
        <Link to="/">Back to clubs</Link>
      </section>
    );
  }

  if (rows === null) {
    return (
      <section className="card">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  if (error === 'Club not found.') {
    return (
      <section className="card">
        <p>{error}</p>
        <Link to="/">Back to clubs</Link>
      </section>
    );
  }

  return (
    <div className="competitions-page">
      <div className="competitions-page-body">
        <div className="toolbar toolbar-multi">
          <div className="toolbar-heading">
            <h1 className="page-title">Competitions</h1>
          </div>
        </div>

        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {successMsg ? (
          <p className="success-toast" role="status">
            {successMsg}
          </p>
        ) : null}
        {sampleMsg ? (
          <p className={sampleMsg.includes('already') ? 'muted' : 'error-text'} role="status">
            {sampleMsg}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <div className="card empty-card">
            <p className="muted">No competitions yet. Use <strong>New competition</strong> below to add one.</p>
          </div>
        ) : (
          <ul className="match-list">
            {rows.map((c) => (
              <li key={c.id} className="match-row match-row--with-action">
                <Link to={`/competition/${c.id}`} className="match-row-main">
                  <span className="match-title">{c.name}</span>
                  <span className="match-meta">
                    {[formatCompetitionDateLabel(c), c.location].filter(Boolean).join(' · ') || `Updated ${formatDate(c.updatedAt)}`}
                  </span>
                </Link>
                <button
                  type="button"
                  className="match-row-action"
                  title={`Edit ${c.name}`}
                  aria-label={`Edit ${c.name}`}
                  onClick={() => openEdit(c)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="match-row-delete btn-danger"
                  title={`Delete ${c.name}`}
                  aria-label={`Delete ${c.name}`}
                  onClick={() => void onDelete(c.id, c.name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="competitions-sticky-footer" role="toolbar" aria-label="New competition">
        <button
          type="button"
          className="btn btn-primary competitions-sticky-main"
          onClick={() => {
            setMenuOpen(false);
            setCreateModalOpen(true);
          }}
        >
          New competition
        </button>
        <div className="competitions-sticky-menu-wrap" ref={menuWrapRef}>
          <button
            type="button"
            className="btn btn-secondary competitions-sticky-caret"
            aria-label="More options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ▾
          </button>
          {menuOpen ? (
            <ul className="competitions-sticky-dropdown" role="list">
              <li>
                <button
                  type="button"
                  className="competitions-sticky-dropdown-item competitions-sticky-dropdown-item--detail"
                  disabled={quickBusy}
                  onClick={() => void openQuickCreate()}
                >
                  <span className="competitions-sticky-dropdown-label">Quick create</span>
                  <span className="competitions-sticky-dropdown-desc">
                    Instantly creates a Generic competition, Team A, and a match vs Opponents — no form.
                  </span>
                </button>
              </li>
              <li>
                <Link
                  to="/matches/import"
                  className="competitions-sticky-dropdown-item competitions-sticky-dropdown-item--detail"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="competitions-sticky-dropdown-label">Upload schedule</span>
                  <span className="competitions-sticky-dropdown-desc">Import many matches from pasted CSV.</span>
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="competitions-sticky-dropdown-item competitions-sticky-dropdown-item--detail"
                  disabled={sampleBusy}
                  onClick={() => void onLoadSampleData()}
                >
                  <span className="competitions-sticky-dropdown-label">
                    {sampleBusy ? 'Loading sample…' : 'Load sample data'}
                  </span>
                  <span className="competitions-sticky-dropdown-desc">
                    One-time demo: teams, matches, timelines, schedule, weigh-ins.
                  </span>
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </div>

      {teamEditOpen && clubRecord ? (
        <ClubTeamFormModal
          open
          variant="edit"
          club={clubRecord}
          onClose={() => setTeamEditOpen(false)}
          onSaved={async () => {
            await load();
          }}
        />
      ) : null}

      <dialog
        ref={createDlgRef}
        className="modal-dialog"
        aria-labelledby="comp-create-title"
        onCancel={() => setCreateModalOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setCreateModalOpen(false);
        }}
      >
        <div className="modal-card card">
          <h2 id="comp-create-title" className="admin-card-title">
            New competition
          </h2>
          <p className="muted form-subtitle">Enter a name — you’ll add teams on the next screen.</p>
          <form className="form" onSubmit={(e) => void onCreateFromModal(e)}>
            <label className="field">
              <span>Name</span>
              <input
                className="filter-select"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Summer 7s"
                autoFocus
                aria-label="Competition name"
                required
              />
            </label>
              <div className="form-row-inline">
                <label className="field field--half">
                  <span>Start date</span>
                  <input
                    type="date"
                    className="filter-select"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    aria-label="Start date"
                  />
                </label>
                <label className="field field--half">
                  <span>End date</span>
                  <input
                    type="date"
                    className="filter-select"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    aria-label="End date"
                  />
                </label>
              </div>
              <label className="field">
                <span>Location</span>
                <input
                  className="filter-select"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  aria-label="Competition location"
                />
              </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!createName.trim() || createBusy}>
                {createBusy ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog
        ref={editDlgRef}
        className="modal-dialog"
        aria-labelledby="comp-edit-title"
        onCancel={() => setEditComp(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setEditComp(null);
        }}
      >
        <div className="modal-card card">
          <h2 id="comp-edit-title" className="admin-card-title">
            Edit competition
          </h2>
          <form className="form" onSubmit={(e) => void onSaveEdit(e)}>
              <label className="field">
                <span>Name</span>
                <input
                  className="filter-select"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  aria-label="Competition name"
                />
              </label>
              <div className="form-row-inline">
                <label className="field field--half">
                  <span>Start date</span>
                  <input
                    type="date"
                    className="filter-select"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    aria-label="Start date"
                  />
                </label>
                <label className="field field--half">
                  <span>End date</span>
                  <input
                    type="date"
                    className="filter-select"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    aria-label="End date"
                  />
                </label>
              </div>
              <label className="field">
                <span>Location</span>
                <input
                  className="filter-select"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  aria-label="Competition location"
                />
              </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditComp(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!editName.trim() || editBusy}>
                {editBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium' });
}
