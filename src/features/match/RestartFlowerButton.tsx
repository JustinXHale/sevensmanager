import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RESTART_KICK_DEPTH_IDS,
  WIDTH_LEVEL_LABELS,
  type RestartKickDepth,
  type SetPieceOutcome,
} from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import { semicirclePillOffset, zoneIdFromIndex } from './zoneFlowerGeometry';

const RADIUS_ZONE = 90;
const RADIUS_DEPTH = 88;
const RADIUS_OUTCOME = 96;

const HUD_APPROX_HEIGHT_PX = 168;
const ANCHOR_GAP_PX = 6;

const DEPTH_LABEL: Record<RestartKickDepth, string> = {
  '10m': '10m',
  '22m': '22m',
  dead: 'Dead',
};

type Phase = 'l1_zone' | 'l2_depth' | 'l3_outcome';

const RESTART_OUTCOMES: { outcome: Extract<SetPieceOutcome, 'won' | 'lost' | 'free_kick'>; label: string; aria: string }[] = [
  { outcome: 'won', label: 'Won', aria: 'Won' },
  { outcome: 'lost', label: 'Lost', aria: 'Lost' },
  { outcome: 'free_kick', label: 'FK', aria: 'Free kick' },
];

type FlowerSession = {
  anchorX: number;
  anchorTop: number;
};

type Props = {
  disabled?: boolean;
  chipClassName?: string;
  onComplete: (payload: {
    outcome: Extract<SetPieceOutcome, 'won' | 'lost' | 'free_kick'>;
    pick: { zoneId: ZoneId; restartKickDepth: RestartKickDepth };
  }) => void;
};

export function RestartFlowerButton({ disabled, chipClassName, onComplete }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [flower, setFlower] = useState<FlowerSession | null>(null);
  const [phase, setPhase] = useState<Phase>('l1_zone');
  const [zoneHoverIdx, setZoneHoverIdx] = useState<number | null>(null);
  const [zonePickIdx, setZonePickIdx] = useState<number | null>(null);
  const [depthHoverIdx, setDepthHoverIdx] = useState<number | null>(null);
  const [depthPickIdx, setDepthPickIdx] = useState<number | null>(null);
  const [outcomeHoverIdx, setOutcomeHoverIdx] = useState<number | null>(null);

  const hintId = useId();
  const flowerOpen = flower !== null;

  const closeFlower = useCallback(() => {
    setFlower(null);
    setPhase('l1_zone');
    setZoneHoverIdx(null);
    setZonePickIdx(null);
    setDepthHoverIdx(null);
    setDepthPickIdx(null);
    setOutcomeHoverIdx(null);
  }, []);

  useEffect(() => {
    if (!flower) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeFlower();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flower, closeFlower]);

  function openFlower() {
    const el = btnRef.current;
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    const anchorX =
      typeof window !== 'undefined' && window.visualViewport && window.visualViewport.width > 0
        ? window.visualViewport.offsetLeft + window.visualViewport.width / 2
        : typeof window !== 'undefined'
          ? window.innerWidth / 2
          : 200;
    let anchorTop = r.top - ANCHOR_GAP_PX;
    const minHudTop = 8;
    if (anchorTop - HUD_APPROX_HEIGHT_PX < minHudTop) {
      anchorTop = minHudTop + HUD_APPROX_HEIGHT_PX;
    }
    setPhase('l1_zone');
    setZoneHoverIdx(null);
    setZonePickIdx(null);
    setDepthHoverIdx(null);
    setDepthPickIdx(null);
    setOutcomeHoverIdx(null);
    setFlower({ anchorX, anchorTop });
  }

  function completeOutcome(zIdx: number, dIdx: number, outcomeIdx: number) {
    const o = RESTART_OUTCOMES[outcomeIdx];
    const depth = RESTART_KICK_DEPTH_IDS[dIdx];
    if (!o || !depth) return;
    onComplete({
      outcome: o.outcome,
      pick: { zoneId: zoneIdFromIndex(zIdx), restartKickDepth: depth },
    });
    closeFlower();
  }

  function handleTriggerClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    requestAnimationFrame(() => {
      openFlower();
    });
    requestAnimationFrame(() => e.currentTarget.blur());
  }

  const hintPrimary =
    'Press to log a restart: choose width zone (Z1–Z6), then depth (10m, 22m, dead), then outcome (Won, Lost, Free kick). Press Escape or tap outside to cancel.';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`live-chip-btn live-setpiece-chip-trigger${chipClassName ? ` ${chipClassName}` : ''}`}
        disabled={disabled}
        title="Restart — zone, depth, outcome"
        aria-label="Restart — set piece"
        aria-describedby={hintId}
        aria-haspopup="dialog"
        aria-expanded={flowerOpen}
        onClick={handleTriggerClick}
      >
        Restart
      </button>
      <span id={hintId} className="visually-hidden">
        {hintPrimary}
      </span>
      {flower && typeof document !== 'undefined'
        ? createPortal(
            <div className="live-zone-flower-layer" role="presentation">
              <button
                type="button"
                className="live-zone-flower-backdrop"
                aria-label="Close restart picker"
                onClick={closeFlower}
              />
              <div
                className="live-zone-flower-hud live-zone-flower-hud--anchor"
                style={{ left: `${flower.anchorX}px`, top: `${flower.anchorTop}px` }}
              >
                {phase === 'l1_zone' ? (
                  <div className="live-zone-flower-ring live-zone-flower-ring--semi" role="group" aria-label="Width">
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Width
                    </span>
                    {WIDTH_LEVEL_LABELS.map((label, i) => {
                      const { x, y } = semicirclePillOffset(i, 6, RADIUS_ZONE);
                      const on = zoneHoverIdx === i;
                      return (
                        <button
                          key={label}
                          type="button"
                          className={`live-zone-flower-pill live-zone-flower-pill-btn${on ? ' live-zone-flower-pill--on' : ''}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onPointerEnter={() => setZoneHoverIdx(i)}
                          onPointerLeave={() => setZoneHoverIdx((h) => (h === i ? null : h))}
                          onClick={() => {
                            setZonePickIdx(i);
                            setPhase('l2_depth');
                            setDepthHoverIdx(null);
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : phase === 'l2_depth' ? (
                  <div className="live-zone-flower-ring live-zone-flower-ring--semi" role="group" aria-label="Depth">
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Depth
                    </span>
                    {RESTART_KICK_DEPTH_IDS.map((id, i) => {
                      const { x, y } = semicirclePillOffset(i, RESTART_KICK_DEPTH_IDS.length, RADIUS_DEPTH);
                      const on = depthHoverIdx === i;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`live-zone-flower-pill live-zone-flower-pill-btn live-zone-flower-pill--setpiece-outcome${on ? ' live-zone-flower-pill--on' : ''}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onPointerEnter={() => setDepthHoverIdx(i)}
                          onPointerLeave={() => setDepthHoverIdx((h) => (h === i ? null : h))}
                          onClick={() => {
                            setDepthPickIdx(i);
                            setPhase('l3_outcome');
                            setOutcomeHoverIdx(null);
                          }}
                        >
                          {DEPTH_LABEL[id]}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="live-zone-flower-ring live-zone-flower-ring--semi" role="group" aria-label="Outcome">
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Outcome
                    </span>
                    {RESTART_OUTCOMES.map((step, i) => {
                      const { x, y } = semicirclePillOffset(i, RESTART_OUTCOMES.length, RADIUS_OUTCOME);
                      const on = outcomeHoverIdx === i;
                      return (
                        <button
                          key={step.outcome}
                          type="button"
                          aria-label={step.aria}
                          className={`live-zone-flower-pill live-zone-flower-pill-btn live-zone-flower-pill--setpiece-outcome${on ? ' live-zone-flower-pill--on' : ''}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onPointerEnter={() => setOutcomeHoverIdx(i)}
                          onPointerLeave={() => setOutcomeHoverIdx((h) => (h === i ? null : h))}
                          onClick={() => {
                            if (zonePickIdx === null || depthPickIdx === null) return;
                            completeOutcome(zonePickIdx, depthPickIdx, i);
                          }}
                        >
                          {step.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
