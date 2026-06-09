import type { PlayerRecord, PlayerStatus } from '@/domain/player';

type Props = {
  player: PlayerRecord;
  onNameCommit: (name: string) => void;
  onStatusChange: (status: PlayerStatus) => void;
  onRemove: () => void;
  /** When false, status is changed via drag board only. */
  showStatusTags?: boolean;
  showSortControls?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  isDragging?: boolean;
};

const STATUS_ORDER: PlayerStatus[] = ['on', 'bench', 'off'];

export function RosterPlayerCard({
  player,
  onNameCommit,
  onStatusChange,
  onRemove,
  showStatusTags = true,
  showSortControls = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDragHandlePointerDown,
  isDragging = false,
}: Props) {
  return (
    <div className={`roster-row-compact${isDragging ? ' roster-row-compact--dragging' : ''}`}>
      {onDragHandlePointerDown ? (
        <button
          type="button"
          className="roster-row-drag-handle"
          aria-label={`Drag ${player.name || `player #${player.number ?? ''}`}`}
          onPointerDown={onDragHandlePointerDown}
        >
          ⠿
        </button>
      ) : null}
      <span className="roster-row-jersey">{player.number ?? '—'}</span>
      <label className="roster-row-name-wrap">
        <span className="visually-hidden">Name for #{player.number}</span>
        <input
          className="roster-row-name"
          defaultValue={player.name}
          key={`${player.id}-${player.name}`}
          placeholder="Name"
          autoComplete="off"
          onBlur={(e) => onNameCommit(e.target.value)}
        />
      </label>
      {showStatusTags ? (
        <div className="roster-row-tags" role="group" aria-label={`Status for #${player.number}`}>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`roster-tag roster-tag--${s}${player.status === s ? ' roster-tag--active' : ''}`}
              onClick={() => onStatusChange(s)}
            >
              {s === 'on' ? 'On' : s === 'bench' ? 'Bench' : 'Off'}
            </button>
          ))}
        </div>
      ) : null}
      {showSortControls ? (
        <div className="roster-row-sort" role="group" aria-label={`Reorder #${player.number}`}>
          <button
            type="button"
            className="roster-row-sort-btn roster-row-sort-btn--up"
            disabled={!canMoveUp}
            aria-label={`Move #${player.number} up`}
            onClick={onMoveUp}
          >
            <span className="roster-row-sort-caret" aria-hidden>
              ▴
            </span>
          </button>
          <button
            type="button"
            className="roster-row-sort-btn roster-row-sort-btn--down"
            disabled={!canMoveDown}
            aria-label={`Move #${player.number} down`}
            onClick={onMoveDown}
          >
            <span className="roster-row-sort-caret" aria-hidden>
              ▾
            </span>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="roster-row-remove"
        title="Remove from roster"
        aria-label={`Remove #${player.number} from roster`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
