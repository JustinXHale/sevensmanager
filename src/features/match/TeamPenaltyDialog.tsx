import { useEffect, useRef } from 'react';
import type { PlayerRecord } from '@/domain/player';
import { PENALTY_TYPES, type PenaltyTypeId } from '@/domain/matchEvent';
import { formatPlayerLabel } from '@/domain/rosterDisplay';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  players: PlayerRecord[];
  playerId: string;
  setPlayerId: (id: string) => void;
  penaltyType: PenaltyTypeId;
  setPenaltyType: (id: PenaltyTypeId) => void;
};

export function TeamPenaltyDialog({
  open,
  onClose,
  onConfirm,
  players,
  playerId,
  setPlayerId,
  penaltyType,
  setPenaltyType,
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
        <h2 className="roster-dialog-title">Team penalty</h2>
        <p className="muted roster-dialog-lead">Log against your team: player and offence type.</p>

        <div className="field">
          <span>Player</span>
          <select
            className="filter-select"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            aria-label="Player"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPlayerLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span>Penalty type</span>
          <select
            className="filter-select"
            value={penaltyType}
            onChange={(e) => setPenaltyType(e.target.value as PenaltyTypeId)}
            aria-label="Penalty type"
          >
            {PENALTY_TYPES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
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
            disabled={!playerId || players.length === 0}
            onClick={onConfirm}
          >
            Log penalty
          </button>
        </div>
      </div>
    </dialog>
  );
}
