import { useCallback, useRef, useState } from 'react';
import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { ON_FIELD_MAX } from '@/domain/player';
import { RosterPlayerCard } from './RosterPlayerCard';

const ZONES: { status: PlayerStatus; title: string; hint: string }[] = [
  { status: 'on', title: 'On field', hint: `Up to ${ON_FIELD_MAX}` },
  { status: 'bench', title: 'Bench', hint: 'Reserves' },
  { status: 'off', title: 'Off', hint: 'Not in squad' },
];

type Props = {
  players: PlayerRecord[];
  countOnField: number;
  onMove: (playerId: string, status: PlayerStatus) => void;
  onNameCommit: (playerId: string, name: string) => void;
  onRemove: (playerId: string) => void;
};

function sortInZone(a: PlayerRecord, b: PlayerRecord): number {
  const an = a.number ?? 999;
  const bn = b.number ?? 999;
  if (an !== bn) return an - bn;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function RosterDragBoard({
  players,
  countOnField,
  onMove,
  onNameCommit,
  onRemove,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<PlayerStatus | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const byZone = (status: PlayerStatus) =>
    players.filter((p) => p.status === status).sort(sortInZone);

  const resolveZoneAt = useCallback((clientX: number, clientY: number): PlayerStatus | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const zone = el?.closest<HTMLElement>('[data-roster-zone]');
    const v = zone?.dataset.rosterZone;
    if (v === 'on' || v === 'bench' || v === 'off') return v;
    return null;
  }, []);

  function finishDrag(playerId: string, clientX: number, clientY: number) {
    const zone = resolveZoneAt(clientX, clientY);
    if (zone) onMove(playerId, zone);
    setDraggingId(null);
    setHoverZone(null);
  }

  function onDragStart(playerId: string, e: React.DragEvent) {
    setDraggingId(playerId);
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setDraggingId(null);
    setHoverZone(null);
  }

  function onZoneDragOver(status: PlayerStatus, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoverZone(status);
  }

  function onZoneDrop(status: PlayerStatus, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    if (id) onMove(id, status);
    setDraggingId(null);
    setHoverZone(null);
  }

  function onHandlePointerDown(playerId: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    setDraggingId(playerId);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBoardPointerMove(e: React.PointerEvent) {
    if (!draggingId) return;
    setHoverZone(resolveZoneAt(e.clientX, e.clientY));
  }

  function onBoardPointerUp(e: React.PointerEvent) {
    if (!draggingId) return;
    finishDrag(draggingId, e.clientX, e.clientY);
  }

  function onBoardPointerCancel() {
    setDraggingId(null);
    setHoverZone(null);
  }

  return (
    <div
      ref={boardRef}
      className={`roster-drag-board${draggingId ? ' roster-drag-board--dragging' : ''}`}
      onPointerMove={onBoardPointerMove}
      onPointerUp={onBoardPointerUp}
      onPointerCancel={onBoardPointerCancel}
    >
      <p className="muted roster-drag-hint">Drag players between groups using the handle (⠿).</p>
      {ZONES.map(({ status, title, hint }) => {
        const list = byZone(status);
        const full = status === 'on' && countOnField >= ON_FIELD_MAX;
        return (
          <section
            key={status}
            className={`roster-drag-zone roster-drag-zone--${status}${
              hoverZone === status ? ' roster-drag-zone--hover' : ''
            }${full && draggingId ? ' roster-drag-zone--full' : ''}`}
            data-roster-zone={status}
            aria-label={`${title}: ${list.length} players`}
            onDragOver={(e) => onZoneDragOver(status, e)}
            onDragLeave={() => setHoverZone((z) => (z === status ? null : z))}
            onDrop={(e) => onZoneDrop(status, e)}
          >
            <header className="roster-drag-zone-head">
              <h3 className="roster-drag-zone-title">{title}</h3>
              <span className="roster-drag-zone-meta muted">
                {list.length}
                {status === 'on' ? ` / ${ON_FIELD_MAX}` : ''}
                {' · '}
                {hint}
              </span>
            </header>
            <ul className="roster-drag-zone-list">
              {list.length === 0 ? (
                <li className="roster-drag-zone-empty muted">Drop players here</li>
              ) : (
                list.map((p) => (
                  <li
                    key={p.id}
                    className={`roster-drag-zone-item${draggingId === p.id ? ' roster-drag-zone-item--dragging' : ''}`}
                    draggable
                    onDragStart={(e) => onDragStart(p.id, e)}
                    onDragEnd={onDragEnd}
                  >
                    <RosterPlayerCard
                      player={p}
                      countOnField={countOnField}
                      showStatusTags={false}
                      onNameCommit={(name) => onNameCommit(p.id, name)}
                      onStatusChange={() => {}}
                      onRemove={() => onRemove(p.id)}
                      onDragHandlePointerDown={(e) => onHandlePointerDown(p.id, e)}
                      isDragging={draggingId === p.id}
                    />
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
