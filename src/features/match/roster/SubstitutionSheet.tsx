import { useEffect, useRef } from 'react';
import type { PlayerRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  matchLabel: string;
  /** On-field players (player out). */
  onField: PlayerRecord[];
  /** Bench + off (player in). */
  benchOrOff: PlayerRecord[];
  offId: string;
  onId: string;
  setOffId: (id: string) => void;
  setOnId: (id: string) => void;
};

export function SubstitutionSheet({
  open,
  onClose,
  onConfirm,
  matchLabel,
  onField,
  benchOrOff,
  offId,
  onId,
  setOffId,
  setOnId,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog ref={ref} className="roster-dialog" onClose={onClose}>
      <div className="roster-dialog-inner">
        <h2 className="roster-dialog-title">Substitution</h2>
        <p className="muted roster-dialog-lead">{matchLabel}</p>

        <div className="field">
          <span>Player out (on field)</span>
          <select
            className="filter-select"
            value={offId}
            onChange={(e) => setOffId(e.target.value)}
            aria-label="Player coming off"
          >
            <option value="">—</option>
            {onField.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPlayerLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span>Player in (bench or off)</span>
          <select
            className="filter-select"
            value={onId}
            onChange={(e) => setOnId(e.target.value)}
            aria-label="Player coming on"
          >
            <option value="">—</option>
            {benchOrOff.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPlayerLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="roster-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!offId || !onId}
            onClick={onConfirm}
          >
            Record substitution
          </button>
        </div>
      </div>
    </dialog>
  );
}
