import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  FIELD_LENGTH_BAND_IDS,
  fieldLengthBandShortLabel,
  type ConversionOutcome,
  type FieldLengthBandId,
  type MatchEventRecord,
  type OffloadTone,
  type PenaltyCard,
} from '@/domain/matchEvent';
import { formatClock, parseMmSsToMs } from '@/domain/matchClock';
import { ZONE_IDS, type ZoneId } from '@/domain/zone';
import { updateMatchEvent } from '@/repos/matchEventsRepo';

type Props = {
  event: MatchEventRecord | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function MatchEventEditDialog({ event, open, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [timeStr, setTimeStr] = useState('0:00');
  const [periodStr, setPeriodStr] = useState('1');
  const [zoneValue, setZoneValue] = useState<string>('');
  const [bandValue, setBandValue] = useState<string>('');
  const [passDeliveryValue, setPassDeliveryValue] = useState<string>('');
  const [offloadToneValue, setOffloadToneValue] = useState<string>('');
  const [conversionOutcomeValue, setConversionOutcomeValue] = useState<string>('');
  const [opponentCardValue, setOpponentCardValue] = useState<string>('yellow');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !event) return;
    setTimeStr(formatClock(event.matchTimeMs));
    setPeriodStr(String(event.period));
    setZoneValue(event.zoneId ?? '');
    setBandValue(event.fieldLengthBand ?? '');
    if (event.kind === 'pass' || event.kind === 'line_break') {
      const delivery =
        event.passVariant === 'standard'
          ? 'standard'
          : event.passVariant === 'offload' || event.offloadTone
            ? 'offload'
            : 'legacy';
      setPassDeliveryValue(delivery);
      setOffloadToneValue(event.offloadTone ?? 'neutral');
    } else {
      setPassDeliveryValue('');
      setOffloadToneValue('');
    }
    setConversionOutcomeValue(
      event.kind === 'conversion' || event.kind === 'opponent_conversion'
        ? (event.conversionOutcome ?? '')
        : '',
    );
    setOpponentCardValue(event.kind === 'opponent_card' ? (event.penaltyCard ?? 'yellow') : 'yellow');
    setFormError(null);
  }, [open, event]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!event) return;
    const matchTimeMs = parseMmSsToMs(timeStr.trim());
    if (matchTimeMs === null) {
      setFormError('Use match time like 7:00 or 0:45.');
      return;
    }
    const period = Number.parseInt(periodStr, 10);
    if (!Number.isFinite(period) || period < 1 || period > 99) {
      setFormError('Period must be between 1 and 99.');
      return;
    }
    const zoneId: ZoneId | null | undefined =
      zoneValue === '' ? null : (zoneValue as ZoneId);
    const showBand =
      event.kind === 'pass' ||
      event.kind === 'try' ||
      event.kind === 'conversion' ||
      event.kind === 'opponent_try' ||
      event.kind === 'opponent_conversion' ||
      event.kind === 'tackle' ||
      event.kind === 'line_break';
    const fieldLengthBand: FieldLengthBandId | null | undefined = showBand
      ? bandValue === ''
        ? null
        : (bandValue as FieldLengthBandId)
      : undefined;

    const passOrLb = event.kind === 'pass' || event.kind === 'line_break';
    if (passOrLb && passDeliveryValue === 'offload' && !offloadToneValue) {
      setFormError('Choose offload quality (Neg / Neu / Pos).');
      return;
    }

    setSaving(true);
    try {
      await updateMatchEvent(event.id, {
        matchTimeMs,
        period,
        zoneId,
        ...(showBand ? { fieldLengthBand } : {}),
        ...(passOrLb && passDeliveryValue === 'standard'
          ? { passVariant: 'standard' as const, offloadTone: null }
          : passOrLb && passDeliveryValue === 'offload'
            ? {
                passVariant: 'offload' as const,
                offloadTone: offloadToneValue as OffloadTone,
              }
            : passOrLb && passDeliveryValue === 'legacy'
              ? {}
              : {}),
        ...(event.kind === 'conversion' || event.kind === 'opponent_conversion'
          ? {
              conversionOutcome:
                conversionOutcomeValue === ''
                  ? null
                  : (conversionOutcomeValue as ConversionOutcome),
            }
          : {}),
        ...(event.kind === 'opponent_card'
          ? { penaltyCard: opponentCardValue as PenaltyCard }
          : {}),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="roster-dialog match-event-edit-dialog" onClose={onClose}>
      <form className="roster-dialog-inner" onSubmit={(e) => void onSubmit(e)}>
        <h2 className="roster-dialog-title">Edit event</h2>
        <p className="muted roster-dialog-lead">
          Adjust logged match time, period, and zone. Player and penalty details are unchanged.
        </p>

        <div className="field">
          <span>Match time (m:ss)</span>
          <input
            type="text"
            className="filter-select"
            inputMode="numeric"
            autoComplete="off"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            aria-invalid={!!formError}
            aria-label="Match time"
          />
        </div>

        <div className="field">
          <span>Period number</span>
          <input
            type="number"
            className="filter-select"
            min={1}
            max={99}
            value={periodStr}
            onChange={(e) => setPeriodStr(e.target.value)}
            aria-label="Period number"
          />
        </div>

        <div className="field">
          <span>Zone (optional)</span>
          <select
            className="filter-select"
            value={zoneValue}
            onChange={(e) => setZoneValue(e.target.value)}
            aria-label="Field zone"
          >
            <option value="">No zone</option>
            {ZONE_IDS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        {event &&
        (event.kind === 'pass' ||
          event.kind === 'try' ||
          event.kind === 'conversion' ||
          event.kind === 'opponent_try' ||
          event.kind === 'opponent_conversion' ||
          event.kind === 'tackle' ||
          event.kind === 'line_break') ? (
          <div className="field">
            <span>Length (optional)</span>
            <select
              className="filter-select"
              value={bandValue}
              onChange={(e) => setBandValue(e.target.value)}
              aria-label="Pitch length band"
            >
              <option value="">No band</option>
              {FIELD_LENGTH_BAND_IDS.map((id) => (
                <option key={id} value={id}>
                  {fieldLengthBandShortLabel(id)} —{' '}
                  {id === 'own_22'
                    ? 'Inside own 22'
                    : id === 'own_half'
                      ? 'Own half'
                      : id === 'opp_half'
                        ? 'Opponent half'
                        : 'Inside opponent 22'}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {event?.kind === 'conversion' || event?.kind === 'opponent_conversion' ? (
          <div className="field">
            <span>Conversion result</span>
            <select
              className="filter-select"
              value={conversionOutcomeValue}
              onChange={(e) => setConversionOutcomeValue(e.target.value)}
              aria-label="Conversion made or missed"
            >
              <option value="">Unspecified (legacy)</option>
              <option value="made">Made</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        ) : null}

        {event?.kind === 'opponent_card' ? (
          <div className="field">
            <span>Card</span>
            <select
              className="filter-select"
              value={opponentCardValue}
              onChange={(e) => setOpponentCardValue(e.target.value)}
              aria-label="Yellow or red card"
            >
              <option value="yellow">Yellow</option>
              <option value="red">Red</option>
            </select>
          </div>
        ) : null}

        {event && (event.kind === 'pass' || event.kind === 'line_break') ? (
          <>
            <div className="field">
              <span>Pass delivery</span>
              <select
                className="filter-select"
                value={passDeliveryValue}
                onChange={(e) => setPassDeliveryValue(e.target.value)}
                aria-label="Standard pass or offload"
              >
                <option value="legacy">Legacy (unspecified)</option>
                <option value="standard">Standard (no offload quality)</option>
                <option value="offload">Offload (Neg / Neu / Pos)</option>
              </select>
            </div>
            {passDeliveryValue === 'offload' ? (
              <div className="field">
                <span>Offload quality</span>
                <select
                  className="filter-select"
                  value={offloadToneValue}
                  onChange={(e) => setOffloadToneValue(e.target.value)}
                  aria-label="Offload quality"
                >
                  <option value="negative">Negative</option>
                  <option value="neutral">Neutral</option>
                  <option value="positive">Positive</option>
                </select>
              </div>
            ) : null}
          </>
        ) : null}

        {formError ? <p className="error-text" role="alert">{formError}</p> : null}

        <div className="roster-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
