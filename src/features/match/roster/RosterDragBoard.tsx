import { useCallback, useRef, useState } from 'react';
import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { ON_FIELD_MAX } from '@/domain/player';
import type { RosterDisplayOrders } from '@/domain/rosterDisplay';
import { orderPlayersInStatus } from '@/domain/rosterDisplay';
import { RosterPlayerCard } from './RosterPlayerCard';

const ZONES: { status: PlayerStatus; title: string; hint: string }[] = [
  { status: 'on', title: 'On field', hint: `Up to ${ON_FIELD_MAX}` },
  { status: 'bench', title: 'Bench', hint: 'Reserves' },
  { status: 'off', title: 'Off', hint: 'Not in squad' },
];

type DropTarget = { zone: PlayerStatus; beforeId: string | null };

type Props = {
  players: PlayerRecord[];
  displayOrders: RosterDisplayOrders;
  countOnField: number;
  onMoveToZone: (playerId: string, zone: PlayerStatus, beforeId: string | null) => void;
  onReorder: (zone: PlayerStatus, order: string[]) => void;
  onMoveInZone: (zone: PlayerStatus, playerId: string, direction: 'up' | 'down') => void;
  onNameCommit: (playerId: string, name: string) => void;
  onRemove: (playerId: string) => void;
};

function orderKey(status: PlayerStatus): keyof RosterDisplayOrders {
  return status;
}

export function RosterDragBoard({
  players,
  displayOrders,
  countOnField,
  onMoveToZone,
  onReorder,
  onMoveInZone,
  onNameCommit,
  onRemove,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<PlayerStatus | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const listForZone = (status: PlayerStatus) =>
    orderPlayersInStatus(
      players,
      status,
      displayOrders[orderKey(status)],
      status === 'on' ? ON_FIELD_MAX : undefined,
    );

  const resolveDropTarget = useCallback((clientX: number, clientY: number): DropTarget | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const item = el?.closest<HTMLElement>('[data-roster-drop-target]');
    if (item) {
      const zoneEl = item.closest<HTMLElement>('[data-roster-zone]');
      const zone = zoneEl?.dataset.rosterZone;
      if (zone === 'on' || zone === 'bench' || zone === 'off') {
        const beforeId = item.dataset.rosterDropTarget || null;
        return { zone, beforeId: beforeId || null };
      }
    }
    const zoneEl = el?.closest<HTMLElement>('[data-roster-zone]');
    const zone = zoneEl?.dataset.rosterZone;
    if (zone === 'on' || zone === 'bench' || zone === 'off') {
      return { zone, beforeId: null };
    }
    return null;
  }, []);

  function applyDrop(playerId: string, target: DropTarget) {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    if (player.status === target.zone) {
      const order = displayOrders[orderKey(target.zone)];
      const next = [...order.filter((id) => id !== playerId)];
      if (target.beforeId === null) {
        next.push(playerId);
      } else {
        const idx = next.indexOf(target.beforeId);
        if (idx === -1) next.push(playerId);
        else next.splice(idx, 0, playerId);
      }
      onReorder(target.zone, next);
      return;
    }
    onMoveToZone(playerId, target.zone, target.beforeId);
  }

  function finishDrag(playerId: string, clientX: number, clientY: number) {
    const target = resolveDropTarget(clientX, clientY);
    if (target) applyDrop(playerId, target);
    setDraggingId(null);
    setHoverZone(null);
    setDropTarget(null);
  }

  function onDragStart(playerId: string, e: React.DragEvent) {
    setDraggingId(playerId);
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setDraggingId(null);
    setHoverZone(null);
    setDropTarget(null);
  }

  function onItemDragOver(playerId: string, zone: PlayerStatus, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setHoverZone(zone);
    setDropTarget({ zone, beforeId: playerId });
  }

  function onZoneDragOver(zone: PlayerStatus, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoverZone(zone);
    if (!dropTarget || dropTarget.zone !== zone) {
      setDropTarget({ zone, beforeId: null });
    }
  }

  function onZoneDrop(zone: PlayerStatus, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    if (!id) return;
    const target = dropTarget ?? { zone, beforeId: null };
    applyDrop(id, target);
    onDragEnd();
  }

  function onHandlePointerDown(playerId: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    setDraggingId(playerId);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBoardPointerMove(e: React.PointerEvent) {
    if (!draggingId) return;
    const target = resolveDropTarget(e.clientX, e.clientY);
    if (target) {
      setHoverZone(target.zone);
      setDropTarget(target);
    }
  }

  function onBoardPointerUp(e: React.PointerEvent) {
    if (!draggingId) return;
    finishDrag(draggingId, e.clientX, e.clientY);
  }

  function onBoardPointerCancel() {
    setDraggingId(null);
    setHoverZone(null);
    setDropTarget(null);
  }

  return (
    <div
      ref={boardRef}
      className={`roster-drag-board${draggingId ? ' roster-drag-board--dragging' : ''}`}
      onPointerMove={onBoardPointerMove}
      onPointerUp={onBoardPointerUp}
      onPointerCancel={onBoardPointerCancel}
    >
      <p className="muted roster-drag-hint">
        Drag between groups or drop on a row to set position. Use ↑↓ to nudge order (e.g. 8, 2, 5, 7).
      </p>
      {ZONES.map(({ status, title, hint }) => {
        const list = listForZone(status);
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
            onDragLeave={() => {
              setHoverZone((z) => (z === status ? null : z));
              setDropTarget((t) => (t?.zone === status ? null : t));
            }}
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
                <li
                  className="roster-drag-zone-empty muted"
                  data-roster-drop-target=""
                  onDragOver={(e) => onZoneDragOver(status, e)}
                  onDrop={(e) => onZoneDrop(status, e)}
                >
                  Drop players here
                </li>
              ) : (
                list.map((p, index) => {
                  const isInsertBefore =
                    dropTarget?.zone === status && dropTarget.beforeId === p.id && draggingId !== p.id;
                  return (
                    <li
                      key={p.id}
                      className={`roster-drag-zone-item${
                        draggingId === p.id ? ' roster-drag-zone-item--dragging' : ''
                      }${isInsertBefore ? ' roster-drag-zone-item--insert-before' : ''}`}
                      data-roster-drop-target={p.id}
                      draggable
                      onDragStart={(e) => onDragStart(p.id, e)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onItemDragOver(p.id, status, e)}
                      onDrop={(e) => onZoneDrop(status, e)}
                    >
                      <RosterPlayerCard
                        player={p}
                        countOnField={countOnField}
                        showStatusTags={false}
                        showSortControls
                        canMoveUp={index > 0}
                        canMoveDown={index < list.length - 1}
                        onMoveUp={() => onMoveInZone(status, p.id, 'up')}
                        onMoveDown={() => onMoveInZone(status, p.id, 'down')}
                        onNameCommit={(name) => onNameCommit(p.id, name)}
                        onStatusChange={() => {}}
                        onRemove={() => onRemove(p.id)}
                        onDragHandlePointerDown={(e) => onHandlePointerDown(p.id, e)}
                        isDragging={draggingId === p.id}
                      />
                    </li>
                  );
                })
              )}
              {list.length > 0 ? (
                <li
                  className="roster-drag-zone-append"
                  data-roster-drop-target=""
                  onDragOver={(e) => onZoneDragOver(status, e)}
                  onDrop={(e) => onZoneDrop(status, e)}
                  aria-hidden
                />
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
