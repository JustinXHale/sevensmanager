import type { PlayerRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';

type Props = {
  heading: string;
  players: PlayerRecord[];
  onSelect: (playerId: string) => void;
  onCancel: () => void;
};

export function TallyRosterPick({ heading, players, onSelect, onCancel }: Props) {
  return (
    <div className="on-field-sub-pick tally-roster-pick" role="group" aria-label={heading}>
      <div className="tally-roster-pick-head">
        <span className="on-field-sub-pick-heading">{heading}</span>
        <button type="button" className="tally-roster-pick-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {players.length === 0 ? (
        <p className="muted on-field-sub-pick-empty">No one on field — check the Roster tab.</p>
      ) : (
        <div className="on-field-sub-pick-chips">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              className="on-field-sub-pick-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(p.id);
              }}
            >
              <span className="on-field-sub-pick-btn-text">{formatPlayerLabel(p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
