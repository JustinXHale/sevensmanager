import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeReturnPath } from '@/utils/safeReturnPath';
import { derivedFixtureLabel } from '@/domain/matchDisplay';
import type { ScheduleImportRow } from '@/domain/scheduleImport';
import { parseScheduleCsv, SCHEDULE_CSV_EXAMPLE } from '@/domain/scheduleImport';
import { createMatchesFromSchedule } from '@/repos/matchesRepo';

export function ScheduleImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const [text, setText] = useState(SCHEDULE_CSV_EXAMPLE);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return { rows: [] as ScheduleImportRow[], errors: [] as string[] };
    return parseScheduleCsv(trimmed);
  }, [text]);

  const canImport = parsed.rows.length > 0 && parsed.errors.length === 0;

  async function onImport() {
    if (!canImport) return;
    setBusy(true);
    try {
      await createMatchesFromSchedule(parsed.rows);
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
        <h1 className="page-title">Import schedule</h1>
        <p className="muted import-lead">
          Paste <strong>CSV</strong> from a spreadsheet (first row = column names). Include optional columns like{' '}
          <code className="inline-code">location</code> or <code className="inline-code">venue</code>. To add matches one
          at a time instead, use <Link to="/matches/new">Add match</Link>.
        </p>
        <p className="muted import-lead">
          Each row becomes a match on your list—tap one to run the clock. Export comma-separated from Excel or Google
          Sheets.
        </p>

        <div className="format-toggle">
          <button type="button" className="btn btn-ghost" onClick={() => setText(SCHEDULE_CSV_EXAMPLE)}>
            Load example
          </button>
        </div>

        <label className="field import-textarea-label">
          <span>CSV data</span>
          <textarea
            className="import-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            rows={14}
          />
        </label>

        {parsed.errors.length > 0 ? (
          <ul className="import-errors">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        {parsed.rows.length > 0 && parsed.errors.length === 0 ? (
          <div className="import-preview">
            <p className="muted preview-caption">
              Preview: <strong>{parsed.rows.length}</strong> match{parsed.rows.length === 1 ? '' : 'es'}
            </p>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fixture</th>
                    <th>Kickoff</th>
                    <th>Location</th>
                    <th>Competition</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        {derivedFixtureLabel({
                          id: 'preview',
                          title: row.title ?? 'Untitled match',
                          ourTeamName: row.ourTeamName,
                          opponentName: row.opponentName,
                          kickoffDate: row.kickoffDate,
                          location: row.location,
                          competition: row.competition,
                          createdAt: 0,
                          updatedAt: 0,
                        })}
                      </td>
                      <td>{row.kickoffDate ? formatShort(row.kickoffDate) : '—'}</td>
                      <td>{row.location ?? '—'}</td>
                      <td>{row.competition ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="form-actions">
          <Link to={returnTo || '/'} className="btn btn-ghost">
            Cancel
          </Link>
          <button type="button" className="btn btn-primary" disabled={!canImport || busy} onClick={() => void onImport()}>
            {busy ? 'Importing…' : `Import ${parsed.rows.length || '…'} match${parsed.rows.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      </div>
    </section>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
