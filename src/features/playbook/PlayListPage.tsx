import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppChrome } from '@/context/AppChromeContext';
import type { AttackingPlayRecord } from '@/domain/attackingPlay';
import { createAttackingPlay, deleteAttackingPlay, listAttackingPlays } from '@/repos/attackingPlaysRepo';
import './playbook.css';

export function PlayListPage() {
  const navigate = useNavigate();
  const { setTeamHeader } = useAppChrome();
  const [rows, setRows] = useState<AttackingPlayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTeamHeader({ backTo: '/', title: 'Canvas' });
    return () => setTeamHeader(null);
  }, [setTeamHeader]);

  const load = useCallback(async () => {
    try {
      setRows(await listAttackingPlays());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onNew() {
    try {
      const row = await createAttackingPlay();
      await load();
      navigate(`/plays/${row.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create play');
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete “${label}”?`)) return;
    try {
      await deleteAttackingPlay(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  if (rows === null) {
    return (
      <div className="playbook-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="playbook-page">
      <h1>Canvas</h1>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="playbook-toolbar">
        <button type="button" className="btn" onClick={() => void onNew()}>
          New play
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="playbook-empty">No saved plays yet. Create one to draw attacking lines and preview motion.</p>
      ) : (
        <ul className="playbook-playlist card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/plays/${r.id}`}>{r.document.name || 'Untitled play'}</Link>
              <button
                type="button"
                className="btn btn-secondary playbook-danger"
                aria-label={`Delete ${r.document.name || 'play'}`}
                onClick={() => void onDelete(r.id, r.document.name || 'Untitled play')}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
