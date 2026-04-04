import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CompetitionRecord } from '@/domain/competition';

const DELETE_WIDTH_PX = 88;

type Props = {
  competition: CompetitionRecord;
  swipeOpenId: string | null;
  setSwipeOpenId: Dispatch<SetStateAction<string | null>>;
  onDelete: (id: string, label: string) => void;
  formatDate: (ts: number) => string;
};

/**
 * Swipe left to reveal Delete (mobile-first). Keyboard users: focus Delete after reveal or use browser.
 */
export function CompetitionSwipeRow({
  competition: c,
  swipeOpenId,
  setSwipeOpenId,
  onDelete,
  formatDate,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragActive = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragMoved = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (swipeOpenId !== c.id && offset !== 0 && !dragActive.current) {
      setOffset(0);
    }
  }, [swipeOpenId, c.id, offset]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (swipeOpenId != null && swipeOpenId !== c.id) {
      setSwipeOpenId(null);
    }
    dragActive.current = true;
    setDragging(true);
    dragMoved.current = false;
    startX.current = e.clientX;
    startOffset.current = offset;
    innerRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragActive.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) dragMoved.current = true;
    let next = startOffset.current + dx;
    next = Math.min(0, Math.max(-DELETE_WIDTH_PX, next));
    setOffset(next);
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragActive.current) return;
    dragActive.current = false;
    setDragging(false);
    try {
      innerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    setOffset((current) => {
      const snapOpen = current < -DELETE_WIDTH_PX / 2;
      const next = snapOpen ? -DELETE_WIDTH_PX : 0;
      queueMicrotask(() => {
        if (snapOpen) setSwipeOpenId(c.id);
        else setSwipeOpenId((prev) => (prev === c.id ? null : prev));
      });
      return next;
    });
  }

  function onLinkClick(ev: React.MouseEvent) {
    if (dragMoved.current) {
      ev.preventDefault();
      dragMoved.current = false;
    }
  }

  return (
    <li className="comp-swipe-row">
      <div
        ref={innerRef}
        className={`comp-swipe-inner${dragging ? '' : ' comp-swipe-inner--snap'}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Link to={`/competition/${c.id}`} className="comp-swipe-front match-row-main" onClick={onLinkClick}>
          <span className="match-title">{c.name}</span>
          <span className="match-meta">Updated {formatDate(c.updatedAt)}</span>
        </Link>
        <button
          type="button"
          className="comp-swipe-delete"
          tabIndex={offset < -20 ? 0 : -1}
          aria-hidden={offset === 0}
          aria-label={`Delete ${c.name}`}
          onClick={(ev) => {
            ev.stopPropagation();
            void onDelete(c.id, c.name);
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
