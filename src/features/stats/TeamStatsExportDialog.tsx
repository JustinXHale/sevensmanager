import { useEffect, useRef, useState } from 'react';

export type TeamStatsExportMatchOption = {
  id: string;
  label: string;
};

type Props = {
  open: boolean;
  teamName: string;
  matches: TeamStatsExportMatchOption[];
  onClose: () => void;
  onExport: (selectedMatchIds: string[]) => void;
};

export function TeamStatsExportDialog({ open, teamName, matches, onClose, onExport }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      setSelected(new Set());
      el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(matches.map((m) => m.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <dialog ref={ref} className="roster-dialog team-stats-export-dialog" onClose={onClose}>
      <div className="roster-dialog-inner">
        <h2 className="roster-dialog-title">Export global stats</h2>
        <p className="muted roster-dialog-lead">
          Opens a printable report for <strong>{teamName}</strong>: one global summary page, plus optional
          individual match one-pagers you select below. Use Print → Save as PDF to share.
        </p>

        <p className="team-stats-export-note muted">
          Page 1 is always the pooled global stats summary.
        </p>

        {matches.length > 0 ? (
          <>
            <div className="team-stats-export-match-actions">
              <span className="team-stats-export-match-label">Match one-pagers</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>
                Select all
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                Clear
              </button>
            </div>
            <ul className="team-stats-export-match-list">
              {matches.map((m) => (
                <li key={m.id}>
                  <label className="team-stats-export-match-item">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    <span>{m.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No matches with logged events.</p>
        )}

        <div className="roster-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onExport([...selected]);
              onClose();
            }}
          >
            Export {selected.size > 0 ? `(${selected.size + 1} pages)` : '(1 page)'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
