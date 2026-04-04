import type { PlayerRecord, PlayerStatus } from '@/domain/player';

type Props = {
  player: PlayerRecord;
  onNameCommit: (name: string) => void;
  onStatusChange: (status: PlayerStatus) => void;
  onRemove: () => void;
  countOnField: number;
};

const STATUS_ORDER: PlayerStatus[] = ['on', 'bench', 'off'];

export function RosterPlayerCard({
  player,
  onNameCommit,
  onStatusChange,
  onRemove,
  countOnField,
}: Props) {
  const atCap = countOnField >= 7 && player.status !== 'on';

  return (
    <div className="roster-row-compact">
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
      <div className="roster-row-tags" role="group" aria-label={`Status for #${player.number}`}>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            className={`roster-tag roster-tag--${s}${player.status === s ? ' roster-tag--active' : ''}`}
            disabled={s === 'on' && atCap}
            onClick={() => onStatusChange(s)}
          >
            {s === 'on' ? 'On' : s === 'bench' ? 'Bench' : 'Off'}
          </button>
        ))}
      </div>
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
