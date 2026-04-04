import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FIELD_LENGTH_BAND_IDS,
  FIELD_LENGTH_BAND_PILL_CLASSNAMES,
  fieldLengthBandShortLabel,
  type FieldLengthBandId,
  type SetPieceOutcome,
} from '@/domain/matchEvent';
import { fieldLengthBandIdFromIndex, semicirclePillOffset } from './zoneFlowerGeometry';

const RADIUS_AREA = 90;
const RADIUS_OUTCOME = 96;

const HUD_APPROX_HEIGHT_PX = 168;
const ANCHOR_GAP_PX = 6;

export type SetPieceFlowerKind = 'scrum' | 'lineout' | 'ruck';

type FlowerSession = {
  kind: SetPieceFlowerKind;
  anchorX: number;
  anchorTop: number;
};

type Phase = 'l1_area' | 'l2_outcome';

const OUTCOME_STEPS: { outcome: SetPieceOutcome; label: string; aria: string }[] = [
  { outcome: 'won', label: 'Won', aria: 'Won' },
  { outcome: 'lost', label: 'Lost', aria: 'Lost' },
  { outcome: 'penalized', label: 'Pen.', aria: 'Penalized' },
];

type Props = {
  kind: SetPieceFlowerKind;
  /** Visible chip label, e.g. "Scrum", "Lineout", "Ruck". */
  label: string;
  disabled?: boolean;
  /** Extra classes on the chip (e.g. `live-chip-tertiary` for Ruck). */
  chipClassName?: string;
  onComplete: (payload: {
    kind: SetPieceFlowerKind;
    outcome: SetPieceOutcome;
    pick: { fieldLengthBand: FieldLengthBandId };
  }) => void;
};

export function SetPieceFlowerButton({
  kind,
  label,
  disabled,
  chipClassName,
  onComplete,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const [flower, setFlower] = useState<FlowerSession | null>(null);
  const [phase, setPhase] = useState<Phase>('l1_area');
  const [areaHoverIdx, setAreaHoverIdx] = useState<number | null>(null);
  const [areaPickIdx, setAreaPickIdx] = useState<number | null>(null);
  const [outcomeHoverIdx, setOutcomeHoverIdx] = useState<number | null>(null);

  const hintId = useId();
  const flowerOpen = flower !== null;

  const closeFlower = useCallback(() => {
    setFlower(null);
    setPhase('l1_area');
    setAreaHoverIdx(null);
    setAreaPickIdx(null);
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
    const session: FlowerSession = { kind, anchorX, anchorTop };
    setPhase('l1_area');
    setAreaHoverIdx(null);
    setAreaPickIdx(null);
    setOutcomeHoverIdx(null);
    setFlower(session);
  }

  function completeOutcome(fs: FlowerSession, bandIdx: number, outcomeIdx: number) {
    const o = OUTCOME_STEPS[outcomeIdx];
    if (!o) return;
    onComplete({
      kind: fs.kind,
      outcome: o.outcome,
      pick: { fieldLengthBand: fieldLengthBandIdFromIndex(bandIdx) },
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

  const bandShortLabels = FIELD_LENGTH_BAND_IDS.map((id) => fieldLengthBandShortLabel(id));

  const hintPrimary =
    'Press to open the set-piece picker: choose Area (22, H, OH, O22), then Outcome (Won, Lost, Penalized). Press Escape or tap outside to cancel.';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`live-chip-btn live-setpiece-chip-trigger${chipClassName ? ` ${chipClassName}` : ''}`}
        disabled={disabled}
        title={`${label} — choose area and outcome`}
        aria-label={`${label} — set piece`}
        aria-describedby={hintId}
        aria-haspopup="dialog"
        aria-expanded={flowerOpen}
        onClick={handleTriggerClick}
      >
        {label}
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
                aria-label="Close set-piece picker"
                onClick={closeFlower}
              />
              <div
                className="live-zone-flower-hud live-zone-flower-hud--anchor"
                style={{ left: `${flower.anchorX}px`, top: `${flower.anchorTop}px` }}
              >
                {phase === 'l1_area' ? (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Area"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Area
                    </span>
                    {bandShortLabels.map((bandLbl, i) => {
                      const { x, y } = semicirclePillOffset(i, 4, RADIUS_AREA);
                      const on = areaHoverIdx === i;
                      const fieldClass = FIELD_LENGTH_BAND_PILL_CLASSNAMES[i] ?? '';
                      return (
                        <button
                          key={bandLbl}
                          type="button"
                          className={`live-zone-flower-pill live-zone-flower-pill-btn live-zone-flower-pill--band ${fieldClass}${on ? ' live-zone-flower-pill--on' : ''}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onPointerEnter={() => setAreaHoverIdx(i)}
                          onPointerLeave={() => setAreaHoverIdx((h) => (h === i ? null : h))}
                          onClick={() => {
                            setAreaPickIdx(i);
                            setPhase('l2_outcome');
                            setOutcomeHoverIdx(null);
                          }}
                        >
                          {bandLbl}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Outcome"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Outcome
                    </span>
                    {OUTCOME_STEPS.map((step, i) => {
                      const { x, y } = semicirclePillOffset(i, OUTCOME_STEPS.length, RADIUS_OUTCOME);
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
                            if (areaPickIdx === null) return;
                            completeOutcome(flower, areaPickIdx, i);
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
