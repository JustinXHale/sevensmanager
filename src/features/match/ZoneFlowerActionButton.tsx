import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FIELD_LENGTH_BAND_IDS,
  FIELD_LENGTH_BAND_PILL_CLASSNAMES,
  fieldLengthBandShortLabel,
  NEGATIVE_ACTION_RING,
  type ConversionOutcome,
  type FieldLengthBandId,
  type NegativeActionId,
  type OffloadTone,
  type PassVariant,
  type TackleQuality,
  type ZoneFlowerPick,
  WIDTH_LEVEL_LABELS,
} from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import { fieldLengthBandIdFromIndex, semicirclePillOffset, zoneIdFromIndex } from './zoneFlowerGeometry';

/** Arc radius — larger = more space between Z1–Z6 (wider HUD). */
const RADIUS_W = 96;
const RADIUS_B = 90;
const RADIUS_TQ = 88;
const RADIUS_DELIVERY = 82;
const RADIUS_NEG = 84;

const HUD_APPROX_HEIGHT_PX = 168;
const ANCHOR_GAP_PX = 6;

/** Conversion: same location as paired try — user only picks result. */
const CONVERSION_OUTCOME_RING: { id: ConversionOutcome; label: string; title: string; toneClass: string }[] = [
  { id: 'made', label: 'Made', title: 'Conversion made', toneClass: 'live-zone-flower-pill--tone-good' },
  { id: 'missed', label: 'Missed', title: 'Conversion missed', toneClass: 'live-zone-flower-pill--tone-bad' },
];

/** Order: Passive (red) → Neutral (gray) → Dominant (green). */
const TACKLE_QUALITY_RING: { id: TackleQuality; label: string; title: string; toneClass: string }[] = [
  { id: 'passive', label: 'Pas', title: 'Passive', toneClass: 'live-zone-flower-pill--tone-bad' },
  { id: 'neutral', label: 'Neu', title: 'Neutral', toneClass: 'live-zone-flower-pill--tone-mid' },
  { id: 'dominant', label: 'Dom', title: 'Dominant', toneClass: 'live-zone-flower-pill--tone-good' },
];

/** Order: Negative (red) → Neutral (gray) → Positive (green). */
const OFFLOAD_RING: { id: OffloadTone; label: string; title: string; toneClass: string }[] = [
  { id: 'negative', label: 'Neg', title: 'Negative', toneClass: 'live-zone-flower-pill--tone-bad' },
  { id: 'neutral', label: 'Neu', title: 'Neutral', toneClass: 'live-zone-flower-pill--tone-mid' },
  { id: 'positive', label: 'Pos', title: 'Positive', toneClass: 'live-zone-flower-pill--tone-good' },
];

/** First step for pass / line_break: Standard vs Offload (then Location → Area → optional offload quality). */
const PASS_DELIVERY: { id: PassVariant; label: string; title: string; toneClass: string }[] = [
  { id: 'standard', label: 'Standard', title: 'Standard pass', toneClass: 'live-zone-flower-pill--tone-mid' },
  { id: 'offload', label: 'Offload', title: 'Offload', toneClass: 'live-zone-flower-pill--tone-good' },
];

/** Pass / try / conversion / defensive tackle / line break — try skips length; pass & line_break add delivery + optional offload quality. */
export type ZoneFlowerActionKind =
  | 'pass'
  | 'try'
  | 'conversion'
  | 'opponent_try'
  | 'opponent_conversion'
  | 'line_break'
  | 'tackle_made'
  | 'tackle_missed'
  | 'negative_action';

function isConversionZoneKind(k: ZoneFlowerActionKind): k is 'conversion' | 'opponent_conversion' {
  return k === 'conversion' || k === 'opponent_conversion';
}

function isTryZoneKind(k: ZoneFlowerActionKind): k is 'try' | 'opponent_try' {
  return k === 'try' || k === 'opponent_try';
}

type FlowerSession = {
  kind: ZoneFlowerActionKind;
  playerId: string;
  anchorX: number;
  anchorTop: number;
};

type FlowerPhase = 'neg_type' | 'delivery' | 'conv_outcome' | 'tq' | 'l1' | 'l2' | 'l4_offload';

function needsLengthLevel(k: ZoneFlowerActionKind): boolean {
  return !isTryZoneKind(k) && k !== 'negative_action' && !isConversionZoneKind(k);
}

type Props = {
  kind: ZoneFlowerActionKind;
  abbr: string;
  title: string;
  playerLabelForAria: string;
  playerId: string;
  disabled: boolean;
  roundClassName?: string;
  /** When `kind === 'conversion'` or `opponent_conversion`: zone/length from the paired try (no location pick). */
  conversionKick?: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null;
  onAction: (kind: ZoneFlowerActionKind, playerId: string, pick?: ZoneFlowerPick) => void;
};

export function ZoneFlowerActionButton({
  kind,
  abbr,
  title,
  playerLabelForAria,
  playerId,
  disabled,
  roundClassName,
  conversionKick,
  onAction,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const flowerSessionRef = useRef<FlowerSession | null>(null);
  const phaseRef = useRef<FlowerPhase>('l1');
  const pendingTackleQualityRef = useRef<TackleQuality | null>(null);

  const [flower, setFlower] = useState<FlowerSession | null>(null);
  const [phase, setPhase] = useState<FlowerPhase>('l1');
  const [l1HoverIdx, setL1HoverIdx] = useState<number | null>(null);
  const [widthPickIdx, setWidthPickIdx] = useState<number | null>(null);
  const [bandPreviewIdx, setBandPreviewIdx] = useState<number | null>(null);
  /** Pass / line_break: Standard vs Offload chosen on first step (before Location). */
  const [passFlowKind, setPassFlowKind] = useState<PassVariant | null>(null);
  /** After Area for offload: zone + band index before Neg/Neu/Pos ring. */
  const [passLinePending, setPassLinePending] = useState<{ zIdx: number; bIdx: number } | null>(null);
  /** negative_action: error type before Location. */
  const [negativeTypePicked, setNegativeTypePicked] = useState<NegativeActionId | null>(null);

  const hintId = useId();
  const flowerOpen = flower !== null;

  const closeFlower = useCallback(() => {
    flowerSessionRef.current = null;
    phaseRef.current = 'l1';
    pendingTackleQualityRef.current = null;
    setFlower(null);
    setPhase('l1');
    setL1HoverIdx(null);
    setWidthPickIdx(null);
    setBandPreviewIdx(null);
    setPassFlowKind(null);
    setPassLinePending(null);
    setNegativeTypePicked(null);
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!flower) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeFlower();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flower, closeFlower]);

  function completeConversion(fs: FlowerSession, kick: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId }, outcome: ConversionOutcome) {
    const pick: ZoneFlowerPick = {
      zoneId: kick.zoneId,
      fieldLengthBand: kick.fieldLengthBand,
      conversionOutcome: outcome,
    };
    onAction(fs.kind, fs.playerId, pick);
    closeFlower();
  }

  function openFlower() {
    const el = btnRef.current;
    if (!el || disabled) return;
    if (isConversionZoneKind(kind) && !conversionKick) return;
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
    const session: FlowerSession = { kind, playerId, anchorX, anchorTop };
    flowerSessionRef.current = session;
    const startPhase: FlowerPhase =
      isConversionZoneKind(kind)
        ? 'conv_outcome'
        : kind === 'tackle_made'
          ? 'tq'
          : kind === 'pass' || kind === 'line_break'
            ? 'delivery'
            : kind === 'negative_action'
              ? 'neg_type'
              : 'l1';
    phaseRef.current = startPhase;
    pendingTackleQualityRef.current = null;
    setPhase(startPhase);
    setL1HoverIdx(null);
    setWidthPickIdx(null);
    setBandPreviewIdx(null);
    setPassFlowKind(null);
    setPassLinePending(null);
    setNegativeTypePicked(null);
    setFlower(session);
  }

  function completePickWithLength(fs: FlowerSession, zIdx: number, bIdx: number, extra: Partial<ZoneFlowerPick>) {
    const pick: ZoneFlowerPick = {
      zoneId: zoneIdFromIndex(zIdx),
      fieldLengthBand: fieldLengthBandIdFromIndex(bIdx),
      ...extra,
    };
    onAction(fs.kind, fs.playerId, pick);
    closeFlower();
  }

  function completeTryOnly(fs: FlowerSession, zIdx: number) {
    const pick: ZoneFlowerPick = { zoneId: zoneIdFromIndex(zIdx) };
    onAction(fs.kind, fs.playerId, pick);
    closeFlower();
  }

  function completeNegativePlay(fs: FlowerSession, zIdx: number, nid: NegativeActionId) {
    const pick: ZoneFlowerPick = { zoneId: zoneIdFromIndex(zIdx), negativeActionId: nid };
    onAction(fs.kind, fs.playerId, pick);
    closeFlower();
  }

  function completePassLineBreakStandard(fs: FlowerSession, zIdx: number, bIdx: number) {
    const pick: ZoneFlowerPick = {
      zoneId: zoneIdFromIndex(zIdx),
      fieldLengthBand: fieldLengthBandIdFromIndex(bIdx),
      passVariant: 'standard',
    };
    onAction(fs.kind, fs.playerId, pick);
    closeFlower();
  }

  function completeAfterOffloadTone(fs: FlowerSession, zIdx: number, bIdx: number, tone: OffloadTone) {
    const pick: ZoneFlowerPick = {
      zoneId: zoneIdFromIndex(zIdx),
      fieldLengthBand: fieldLengthBandIdFromIndex(bIdx),
      passVariant: 'offload',
      offloadTone: tone,
    };
    onAction(fs.kind, fs.playerId, pick);
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

  const triggerTitle =
    isTryZoneKind(kind)
      ? `${title} — press to choose location (Z1–Z6)`
      : isConversionZoneKind(kind)
        ? conversionKick
          ? `${title} — same location as try; choose Made or Missed`
          : `${title} — unavailable (no paired try location)`
        : kind === 'negative_action'
          ? `${title} — choose error type, then location (Z1–Z6)`
          : kind === 'pass' || kind === 'line_break'
            ? `${title} — press to choose Standard or Offload first, then location, area, and offload quality if Offload`
            : `${title} — press to choose location and area`;

  const hintPrimary =
    isTryZoneKind(kind)
      ? 'Press to open the zone picker, then choose Location (Z1–Z6). Press Escape or tap outside to cancel.'
      : isConversionZoneKind(kind)
        ? 'Location matches the try. Choose Made or Missed. Press Escape or tap outside to cancel.'
        : kind === 'negative_action'
          ? 'Choose error type first, then Location (Z1–Z6). Press Escape or tap outside to cancel.'
          : kind === 'tackle_made'
            ? 'Choose tackle type (Pas / Neu / Dom), then location and area. Press Escape or tap outside to cancel.'
            : kind === 'pass' || kind === 'line_break'
              ? 'Choose Standard or Offload first, then Location and Area; if Offload, choose quality (Neg / Neu / Pos). Press Escape or tap outside to cancel.'
              : 'Choose location and area. Press Escape or tap outside to cancel.';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`live-action-round live-action-round--zone-flower${roundClassName ? ` ${roundClassName}` : ''}`}
        disabled={disabled || (isConversionZoneKind(kind) && !conversionKick)}
        title={triggerTitle}
        aria-label={`${title} — ${playerLabelForAria}`}
        aria-describedby={hintId}
        aria-haspopup="dialog"
        aria-expanded={flowerOpen}
        onClick={handleTriggerClick}
      >
        {abbr}
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
                aria-label="Close zone picker"
                onClick={closeFlower}
              />
              <div
                className="live-zone-flower-hud live-zone-flower-hud--anchor"
                style={{ left: `${flower.anchorX}px`, top: `${flower.anchorTop}px` }}
              >
                {phase === 'conv_outcome' && isConversionZoneKind(flower.kind) && conversionKick ? (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Conversion result"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Kick
                    </span>
                    {CONVERSION_OUTCOME_RING.map((opt, i) => {
                      const { x, y } = semicirclePillOffset(i, CONVERSION_OUTCOME_RING.length, RADIUS_DELIVERY);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          title={opt.title}
                          className={`live-zone-flower-pill live-zone-flower-pill--pass-delivery live-zone-flower-pill--band live-zone-flower-pill-btn ${opt.toneClass}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onClick={() => {
                            completeConversion(flower, conversionKick, opt.id);
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : phase === 'neg_type' && flower.kind === 'negative_action' ? (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Error type"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Error
                    </span>
                    {NEGATIVE_ACTION_RING.map((opt, i) => {
                      const { x, y } = semicirclePillOffset(i, NEGATIVE_ACTION_RING.length, RADIUS_NEG);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          title={opt.title}
                          className={`live-zone-flower-pill live-zone-flower-pill--negative-type live-zone-flower-pill--band live-zone-flower-pill-btn ${opt.toneClass}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onClick={() => {
                            setNegativeTypePicked(opt.id);
                            setPhase('l1');
                            phaseRef.current = 'l1';
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : phase === 'delivery' && (flower.kind === 'pass' || flower.kind === 'line_break') ? (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Pass type"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Pass
                    </span>
                    {PASS_DELIVERY.map((opt, i) => {
                      const { x, y } = semicirclePillOffset(i, PASS_DELIVERY.length, RADIUS_DELIVERY);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          title={opt.title}
                          className={`live-zone-flower-pill live-zone-flower-pill--pass-delivery live-zone-flower-pill--band live-zone-flower-pill-btn ${opt.toneClass}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onClick={() => {
                            setPassFlowKind(opt.id);
                            setPhase('l1');
                            phaseRef.current = 'l1';
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : phase === 'tq' ? (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Tackle type"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Type
                    </span>
                    {TACKLE_QUALITY_RING.map((q, i) => {
                      const { x, y } = semicirclePillOffset(i, 3, RADIUS_TQ);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          title={q.title}
                          className={`live-zone-flower-pill live-zone-flower-pill-btn ${q.toneClass}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onClick={() => {
                            pendingTackleQualityRef.current = q.id;
                            setPhase('l1');
                            phaseRef.current = 'l1';
                          }}
                        >
                          {q.label}
                        </button>
                      );
                    })}
                  </div>
                ) : phase === 'l4_offload' && passLinePending ? (
                  <div
                    className="live-zone-flower-ring live-zone-flower-ring--semi"
                    role="group"
                    aria-label="Offload quality"
                  >
                    <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                      Offload
                    </span>
                    {OFFLOAD_RING.map((opt, i) => {
                      const { x, y } = semicirclePillOffset(i, 3, RADIUS_B);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          title={opt.title}
                          className={`live-zone-flower-pill live-zone-flower-pill--band live-zone-flower-pill-btn ${opt.toneClass}`}
                          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                          onClick={() => {
                            completeAfterOffloadTone(flower, passLinePending.zIdx, passLinePending.bIdx, opt.id);
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : phase === 'l1' ? (
                  <>
                    <div
                      className="live-zone-flower-ring live-zone-flower-ring--semi"
                      role="group"
                      aria-label="Location"
                    >
                      <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                        Location
                      </span>
                      {WIDTH_LEVEL_LABELS.map((label, i) => {
                        const { x, y } = semicirclePillOffset(i, 6, RADIUS_W);
                        const on = l1HoverIdx === i;
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`live-zone-flower-pill live-zone-flower-pill-btn${on ? ' live-zone-flower-pill--on' : ''}`}
                            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                            onPointerEnter={() => setL1HoverIdx(i)}
                            onPointerLeave={() => setL1HoverIdx((h) => (h === i ? null : h))}
                            onClick={() => {
                              if (!needsLengthLevel(flower.kind)) {
                                if (isTryZoneKind(flower.kind)) {
                                  completeTryOnly(flower, i);
                                  return;
                                }
                                if (flower.kind === 'negative_action' && negativeTypePicked) {
                                  completeNegativePlay(flower, i, negativeTypePicked);
                                  return;
                                }
                                return;
                              }
                              setWidthPickIdx(i);
                              setPhase('l2');
                              phaseRef.current = 'l2';
                              setBandPreviewIdx(null);
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="live-zone-flower-ring live-zone-flower-ring--semi"
                      role="group"
                      aria-label="Area"
                    >
                      <span className="live-zone-flower-hint live-zone-flower-hint--inside muted" aria-hidden>
                        Area
                      </span>
                      {bandShortLabels.map((label, i) => {
                        const { x, y } = semicirclePillOffset(i, 4, RADIUS_B);
                        const on = bandPreviewIdx === i;
                        const fieldClass = FIELD_LENGTH_BAND_PILL_CLASSNAMES[i] ?? '';
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`live-zone-flower-pill live-zone-flower-pill--band live-zone-flower-pill-btn ${fieldClass}${on ? ' live-zone-flower-pill--on' : ''}`}
                            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                            onPointerEnter={() => setBandPreviewIdx(i)}
                            onPointerLeave={() => setBandPreviewIdx((h) => (h === i ? null : h))}
                            onClick={() => {
                              if (widthPickIdx === null) return;
                              if (flower.kind === 'pass' || flower.kind === 'line_break') {
                                if (passFlowKind === 'standard') {
                                  completePassLineBreakStandard(flower, widthPickIdx, i);
                                  return;
                                }
                                if (passFlowKind === 'offload') {
                                  setPassLinePending({ zIdx: widthPickIdx, bIdx: i });
                                  setPhase('l4_offload');
                                  phaseRef.current = 'l4_offload';
                                  return;
                                }
                                return;
                              }
                              const tq = pendingTackleQualityRef.current ?? 'neutral';
                              const extra: Partial<ZoneFlowerPick> =
                                flower.kind === 'tackle_made' ? { tackleQuality: tq } : {};
                              completePickWithLength(flower, widthPickIdx, i, extra);
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
