import { useCallback, useMemo, useRef } from 'react';
import type { AttackingPlayerSlot, NormPoint, PhaseTimeline } from '@/domain/attackingPlay';
import {
  ballPositionAtTime,
  clamp01,
  passSegmentEndpoints,
  playerPathForMotion,
  playerPositionAtTime,
  snapPoint,
} from '@/domain/attackingPlay';

const VB_W = 100;
const VB_H = 70;

function toSvg(n: NormPoint): { x: number; y: number } {
  return { x: n.x * VB_W, y: n.y * VB_H };
}

function toNorm(svgX: number, svgY: number): NormPoint {
  return { x: clamp01(svgX / VB_W), y: clamp01(svgY / VB_H) };
}

function clientToSvgNorm(svg: SVGSVGElement, clientX: number, clientY: number): NormPoint {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return toNorm(p.x, p.y);
}

function playersMap(players: PhaseTimeline['players']): Map<AttackingPlayerSlot, PhaseTimeline['players'][0]> {
  const m = new Map<AttackingPlayerSlot, PhaseTimeline['players'][0]>();
  for (const p of players) m.set(p.slot, p);
  return m;
}

type Props = {
  /** Phase timeline with resolved entering positions for this phase */
  phase: PhaseTimeline;
  snapStep: number | null;
  displayTimeSec: number;
  selectedSlot: AttackingPlayerSlot | null;
  editMode: 'select' | 'draw';
  focusedSlot: AttackingPlayerSlot | null;
  onSelectSlot: (slot: AttackingPlayerSlot) => void;
  onTokenMove: (slot: AttackingPlayerSlot, nextCenter: NormPoint) => void;
  onCommitStroke: (slot: AttackingPlayerSlot, strokePoints: NormPoint[]) => void;
  onBackgroundPointerDown?: () => void;
  /** Double-tap on a token (select mode) requests focus / zoom for that player */
  onRequestFocusSlot?: (slot: AttackingPlayerSlot) => void;
};

export function PlayFieldCanvas({
  phase,
  snapStep,
  displayTimeSec,
  selectedSlot,
  editMode,
  focusedSlot,
  onSelectSlot,
  onTokenMove,
  onCommitStroke,
  onBackgroundPointerDown,
  onRequestFocusSlot,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ slot: AttackingPlayerSlot; start: NormPoint; origin: NormPoint } | null>(null);
  const strokeRef = useRef<NormPoint[] | null>(null);
  const lastTapRef = useRef<{ slot: AttackingPlayerSlot; t: number } | null>(null);

  const bySlot = useMemo(() => playersMap(phase.players), [phase.players]);

  const viewBox = useMemo(() => {
    if (focusedSlot == null) return `0 0 ${VB_W} ${VB_H}`;
    const p = bySlot.get(focusedSlot);
    if (!p) return `0 0 ${VB_W} ${VB_H}`;
    const path = playerPathForMotion(p);
    let minX = p.position.x;
    let minY = p.position.y;
    let maxX = p.position.x;
    let maxY = p.position.y;
    for (const q of path) {
      minX = Math.min(minX, q.x);
      minY = Math.min(minY, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
    const padN = 0.12;
    const minXN = clamp01(minX - padN);
    const minYN = clamp01(minY - padN);
    const maxXN = clamp01(maxX + padN);
    const maxYN = clamp01(maxY + padN);
    const w = Math.max(0.2, maxXN - minXN) * VB_W;
    const h = Math.max(0.2, maxYN - minYN) * VB_H;
    const x = minXN * VB_W;
    const y = minYN * VB_H;
    return `${x} ${y} ${w} ${h}`;
  }, [bySlot, focusedSlot]);

  const ballPos = useMemo(() => {
    const m = new Map<AttackingPlayerSlot, PhaseTimeline['players'][0]>();
    for (const pl of phase.players) m.set(pl.slot, pl);
    return ballPositionAtTime(phase, displayTimeSec, m);
  }, [phase, displayTimeSec]);

  const passLines = useMemo(() => {
    const times = phase.passArrivalTimeSec;
    const lines: { from: NormPoint; to: NormPoint; key: string }[] = [];
    for (let i = 0; i < times.length; i++) {
      const ends = passSegmentEndpoints(phase, i, bySlot);
      if (!ends) continue;
      const a = phase.possessionChain[i]!;
      const b = phase.possessionChain[i + 1]!;
      lines.push({ ...ends, key: `${i}-${a}-${b}` });
    }
    return lines;
  }, [bySlot, phase]);

  const onPointerDownToken = useCallback(
    (e: React.PointerEvent, slot: AttackingPlayerSlot) => {
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;

      if (editMode === 'draw') {
        onSelectSlot(slot);
        const cur = bySlot.get(slot);
        if (!cur) return;
        const pos0 = playerPositionAtTime(cur, displayTimeSec);
        strokeRef.current = [snapPoint(pos0, snapStep)];
        svg.setPointerCapture(e.pointerId);
        return;
      }

      (e.target as Element).setPointerCapture?.(e.pointerId);
      const cur = bySlot.get(slot);
      if (!cur) return;
      const pos = playerPositionAtTime(cur, displayTimeSec);
      const p = clientToSvgNorm(svg, e.clientX, e.clientY);
      dragRef.current = { slot, start: p, origin: pos };
      onSelectSlot(slot);

      const now = performance.now();
      const prev = lastTapRef.current;
      if (prev && prev.slot === slot && now - prev.t < 320) {
        lastTapRef.current = null;
        onRequestFocusSlot?.(slot);
      } else {
        lastTapRef.current = { slot, t: now };
      }
    },
    [bySlot, displayTimeSec, editMode, onRequestFocusSlot, onSelectSlot, snapStep],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      if (dragRef.current && editMode === 'select') {
        const { slot, start, origin } = dragRef.current;
        const p = clientToSvgNorm(svg, e.clientX, e.clientY);
        const next: NormPoint = {
          x: clamp01(origin.x + (p.x - start.x)),
          y: clamp01(origin.y + (p.y - start.y)),
        };
        onTokenMove(slot, snapPoint(next, snapStep));
        return;
      }
      if (strokeRef.current != null && editMode === 'draw' && selectedSlot) {
        const p = snapPoint(clientToSvgNorm(svg, e.clientX, e.clientY), snapStep);
        const arr = strokeRef.current;
        const last = arr[arr.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.008) {
          arr.push(p);
        }
      }
    },
    [editMode, onTokenMove, selectedSlot, snapStep],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        dragRef.current = null;
        try {
          (e.target as Element).releasePointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (strokeRef.current != null && selectedSlot) {
        const pts = strokeRef.current;
        strokeRef.current = null;
        if (pts.length >= 1) {
          onCommitStroke(selectedSlot, pts);
        }
      }
    },
    [onCommitStroke, selectedSlot],
  );

  const onPointerDownField = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg || editMode !== 'draw' || !selectedSlot) return;
      const p = snapPoint(clientToSvgNorm(svg, e.clientX, e.clientY), snapStep);
      strokeRef.current = [p];
      svg.setPointerCapture(e.pointerId);
    },
    [editMode, selectedSlot, snapStep],
  );

  return (
    <div className="playbook-field-wrap">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        role="img"
        aria-label="Attacking quarter field"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(ev) => {
          if (!strokeRef.current) return;
          onPointerUp(ev);
        }}
      >
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="#2d4a2d" pointerEvents="none" />
        <rect x={0} y={0} width={VB_W} height={8} fill="rgba(0,0,0,0.12)" pointerEvents="none" />
        <line
          x1={0}
          y1={8}
          x2={VB_W}
          y2={8}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={0.35}
          pointerEvents="none"
        />
        {snapStep != null
          ? Array.from({ length: Math.floor(1 / snapStep) + 1 }).map((_, i) => {
              const g = i * snapStep! * VB_W;
              return (
                <line
                  key={`gv-${i}`}
                  x1={g}
                  y1={0}
                  x2={g}
                  y2={VB_H}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={0.2}
                  pointerEvents="none"
                />
              );
            })
          : null}

        <rect
          x={0}
          y={0}
          width={VB_W}
          height={VB_H}
          fill="transparent"
          pointerEvents="all"
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (editMode === 'select') onBackgroundPointerDown?.();
            onPointerDownField(e);
          }}
        />

        {passLines.map(({ from, to, key }) => {
          const a = toSvg(from);
          const b = toSvg(to);
          return (
            <line
              key={key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={0.35}
              strokeDasharray="2 1.5"
              pointerEvents="none"
            />
          );
        })}

        {phase.players.map((pl) => {
          const path = playerPathForMotion(pl);
          if (path.length < 2) return null;
          const d = path.map((q) => `${toSvg(q).x},${toSvg(q).y}`).join(' ');
          return (
            <polyline
              key={`path-${pl.slot}`}
              fill="none"
              stroke={selectedSlot === pl.slot ? '#c5e86c' : 'rgba(255,255,255,0.85)'}
              strokeWidth={0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={d}
              pointerEvents="none"
            />
          );
        })}

        {phase.players.map((pl) => {
          const pos = playerPositionAtTime(pl, displayTimeSec);
          const c = toSvg(pos);
          const r = 2.8;
          const hitR = 5;
          const sel = selectedSlot === pl.slot;
          return (
            <g key={`tok-${pl.slot}`}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hitR}
                fill="transparent"
                stroke="none"
                style={{ cursor: editMode === 'select' ? 'grab' : 'default' }}
                onPointerDown={(ev) => onPointerDownToken(ev, pl.slot)}
              />
              <circle
                cx={c.x}
                cy={c.y}
                r={r}
                fill="#111"
                stroke={sel ? '#c5e86c' : 'rgba(255,255,255,0.5)'}
                strokeWidth={sel ? 0.5 : 0.25}
                pointerEvents="none"
              />
              <text
                x={c.x}
                y={c.y + 0.9}
                textAnchor="middle"
                fill="#fff"
                fontSize={3.2}
                fontWeight={700}
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {pl.slot}
              </text>
            </g>
          );
        })}

        <circle
          cx={toSvg(ballPos).x}
          cy={toSvg(ballPos).y}
          r={1.6}
          fill="#f5e6c8"
          stroke="#8a6d3b"
          strokeWidth={0.25}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
