import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MatchSessionRecord } from '@/domain/match';
import {
  FIELD_LENGTH_BAND_IDS,
  NEGATIVE_ACTION_IDS,
  RESTART_KICK_DEPTH_IDS,
  fieldLengthBandShortLabel,
  freeKickAgainstLabel,
  negativeActionLabel,
  penaltyDirectionLabel,
  restartKickDepthLabel,
  resolvePenaltyDirection,
  ruckContestLabel,
  type ConversionOutcome,
  type FieldLengthBandId,
  type FreeKickAgainst,
  type MatchEventRecord,
  type NegativeActionId,
  type OffloadTone,
  type PenaltyCard,
  type PenaltyDirection,
  type PlayPhaseContext,
  type RestartKickDepth,
  type RuckContest,
  type SetPieceOutcome,
  type TackleOutcome,
  type TackleQuality,
} from '@/domain/matchEvent';
import { formatMatchEventSummary } from '@/domain/matchEventDisplay';
import { formatClock, parseMmSsToMs } from '@/domain/matchClock';
import type { PlayerRecord } from '@/domain/player';
import { ZONE_IDS, type ZoneId } from '@/domain/zone';
import { updateMatchEvent } from '@/repos/matchEventsRepo';

const SET_PIECE_KINDS = new Set(['scrum', 'lineout', 'ruck', 'restart']);

const SET_PIECE_OUTCOMES: { value: SetPieceOutcome; label: string }[] = [
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'free_kick', label: 'Free kick' },
  { value: 'penalized', label: 'Penalized' },
];

type Props = {
  event: MatchEventRecord | null;
  playersById: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function MatchEventEditDialog({
  event,
  playersById,
  filmSession = null,
  open,
  onClose,
  onSaved,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [timeStr, setTimeStr] = useState('0:00');
  const [periodStr, setPeriodStr] = useState('1');
  const [zoneValue, setZoneValue] = useState<string>('');
  const [bandValue, setBandValue] = useState<string>('');
  const [passDeliveryValue, setPassDeliveryValue] = useState<string>('');
  const [offloadToneValue, setOffloadToneValue] = useState<string>('');
  const [conversionOutcomeValue, setConversionOutcomeValue] = useState<string>('');
  const [opponentCardValue, setOpponentCardValue] = useState<string>('yellow');
  const [setPieceOutcomeValue, setSetPieceOutcomeValue] = useState<string>('');
  const [restartKickDepthValue, setRestartKickDepthValue] = useState<string>('');
  const [playPhaseContextValue, setPlayPhaseContextValue] = useState<string>('');
  const [freeKickAgainstValue, setFreeKickAgainstValue] = useState<string>('');
  const [ruckContestValue, setRuckContestValue] = useState<string>('');
  const [tackleOutcomeValue, setTackleOutcomeValue] = useState<string>('made');
  const [tackleQualityValue, setTackleQualityValue] = useState<string>('neutral');
  const [negativeActionValue, setNegativeActionValue] = useState<string>('');
  const [penaltyDirectionValue, setPenaltyDirectionValue] = useState<string>('conceded');
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
    setSetPieceOutcomeValue(event.setPieceOutcome ?? '');
    setRestartKickDepthValue(event.restartKickDepth ?? '');
    setPlayPhaseContextValue(event.playPhaseContext ?? '');
    setFreeKickAgainstValue(event.freeKickAgainst ?? '');
    setRuckContestValue(event.ruckContest ?? '');
    setTackleOutcomeValue(event.tackleOutcome ?? 'made');
    setTackleQualityValue(event.tackleQuality ?? 'neutral');
    setNegativeActionValue(
      event.kind === 'negative_action' && event.negativeActionId
        ? NEGATIVE_ACTION_IDS.includes(event.negativeActionId as NegativeActionId)
          ? event.negativeActionId
          : 'knock_on'
        : '',
    );
    setPenaltyDirectionValue(resolvePenaltyDirection(event));
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

    const isSetPiece = SET_PIECE_KINDS.has(event.kind);
    if (isSetPiece && !setPieceOutcomeValue) {
      setFormError('Choose an outcome (Won, Lost, etc.).');
      return;
    }
    if (event.kind === 'negative_action' && !negativeActionValue) {
      setFormError('Choose the negative play type.');
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
        ...(isSetPiece
          ? {
              setPieceOutcome: setPieceOutcomeValue as SetPieceOutcome,
              playPhaseContext:
                playPhaseContextValue === ''
                  ? null
                  : (playPhaseContextValue as PlayPhaseContext),
              freeKickAgainst:
                setPieceOutcomeValue === 'free_kick' && freeKickAgainstValue
                  ? (freeKickAgainstValue as FreeKickAgainst)
                  : null,
            }
          : {}),
        ...(event.kind === 'restart'
          ? {
              restartKickDepth:
                restartKickDepthValue === ''
                  ? null
                  : (restartKickDepthValue as RestartKickDepth),
            }
          : {}),
        ...(event.kind === 'ruck'
          ? {
              ruckContest:
                ruckContestValue === '' ? null : (ruckContestValue as RuckContest),
            }
          : {}),
        ...(event.kind === 'tackle'
          ? {
              tackleOutcome: tackleOutcomeValue as TackleOutcome,
              tackleQuality:
                tackleOutcomeValue === 'made'
                  ? (tackleQualityValue as TackleQuality)
                  : null,
            }
          : {}),
        ...(event.kind === 'negative_action'
          ? { negativeActionId: negativeActionValue as NegativeActionId }
          : {}),
        ...(event.kind === 'team_penalty'
          ? {
              penaltyDirection: penaltyDirectionValue as PenaltyDirection,
              playPhaseContext:
                playPhaseContextValue === ''
                  ? null
                  : (playPhaseContextValue as PlayPhaseContext),
            }
          : {}),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const eventSummary = event
    ? formatMatchEventSummary(event, playersById, filmSession, { showFilmInSummary: false })
    : '';

  const showPlayPhase =
    event &&
    (SET_PIECE_KINDS.has(event.kind) || event.kind === 'team_penalty');

  return (
    <dialog ref={ref} className="roster-dialog match-event-edit-dialog" onClose={onClose}>
      <form className="roster-dialog-inner" onSubmit={(e) => void onSubmit(e)}>
        <h2 className="roster-dialog-title">Edit event</h2>
        {eventSummary ? (
          <p className="match-event-edit-current muted">{eventSummary}</p>
        ) : null}
        <p className="muted roster-dialog-lead">
          Fix mistakes in the log — outcome, time, zone, and other details. Player assignments stay the same.
        </p>

        {event && SET_PIECE_KINDS.has(event.kind) ? (
          <>
            <div className="field">
              <span>Outcome</span>
              <select
                className="filter-select"
                value={setPieceOutcomeValue}
                onChange={(e) => setSetPieceOutcomeValue(e.target.value)}
                aria-label="Set piece outcome"
              >
                <option value="">Select outcome…</option>
                {SET_PIECE_OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {setPieceOutcomeValue === 'free_kick' ? (
              <div className="field">
                <span>Free kick against</span>
                <select
                  className="filter-select"
                  value={freeKickAgainstValue}
                  onChange={(e) => setFreeKickAgainstValue(e.target.value)}
                  aria-label="Who the free kick is against"
                >
                  <option value="">Unspecified</option>
                  <option value="opponent">{freeKickAgainstLabel('opponent')}</option>
                  <option value="us">{freeKickAgainstLabel('us')}</option>
                </select>
              </div>
            ) : null}
            {event.kind === 'restart' ? (
              <div className="field">
                <span>Kick depth</span>
                <select
                  className="filter-select"
                  value={restartKickDepthValue}
                  onChange={(e) => setRestartKickDepthValue(e.target.value)}
                  aria-label="Restart kick depth"
                >
                  <option value="">Unspecified</option>
                  {RESTART_KICK_DEPTH_IDS.map((d) => (
                    <option key={d} value={d}>
                      {restartKickDepthLabel(d)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {event.kind === 'ruck' ? (
              <div className="field">
                <span>Ruck contest</span>
                <select
                  className="filter-select"
                  value={ruckContestValue}
                  onChange={(e) => setRuckContestValue(e.target.value)}
                  aria-label="Contested or uncontested ruck"
                >
                  <option value="">Unspecified</option>
                  <option value="contested">{ruckContestLabel('contested')}</option>
                  <option value="uncontested">{ruckContestLabel('uncontested')}</option>
                </select>
              </div>
            ) : null}
          </>
        ) : null}

        {event?.kind === 'tackle' ? (
          <>
            <div className="field">
              <span>Tackle result</span>
              <select
                className="filter-select"
                value={tackleOutcomeValue}
                onChange={(e) => setTackleOutcomeValue(e.target.value)}
                aria-label="Tackle made or missed"
              >
                <option value="made">Made</option>
                <option value="missed">Missed</option>
              </select>
            </div>
            {tackleOutcomeValue === 'made' ? (
              <div className="field">
                <span>Tackle quality</span>
                <select
                  className="filter-select"
                  value={tackleQualityValue}
                  onChange={(e) => setTackleQualityValue(e.target.value)}
                  aria-label="Tackle quality"
                >
                  <option value="dominant">Dominant</option>
                  <option value="neutral">Neutral</option>
                  <option value="passive">Passive</option>
                </select>
              </div>
            ) : null}
          </>
        ) : null}

        {event?.kind === 'negative_action' ? (
          <div className="field">
            <span>Negative play</span>
            <select
              className="filter-select"
              value={negativeActionValue}
              onChange={(e) => setNegativeActionValue(e.target.value)}
              aria-label="Negative play type"
            >
              <option value="">Select type…</option>
              {NEGATIVE_ACTION_IDS.map((id) => (
                <option key={id} value={id}>
                  {negativeActionLabel(id)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {event?.kind === 'team_penalty' ? (
          <div className="field">
            <span>Penalty</span>
            <select
              className="filter-select"
              value={penaltyDirectionValue}
              onChange={(e) => setPenaltyDirectionValue(e.target.value)}
              aria-label="Penalty awarded or conceded"
            >
              <option value="awarded">{penaltyDirectionLabel('awarded')}</option>
              <option value="conceded">{penaltyDirectionLabel('conceded')}</option>
            </select>
          </div>
        ) : null}

        {showPlayPhase ? (
          <div className="field">
            <span>{event?.kind === 'restart' ? 'Kick or receive' : 'Phase when logged'}</span>
            <select
              className="filter-select"
              value={playPhaseContextValue}
              onChange={(e) => setPlayPhaseContextValue(e.target.value)}
              aria-label="Attack or defense phase"
            >
              <option value="">Unspecified</option>
              <option value="attack">
                {event?.kind === 'restart' ? 'Kick (Attack)' : 'Attack'}
              </option>
              <option value="defense">
                {event?.kind === 'restart' ? 'Receive (Defense)' : 'Defense'}
              </option>
            </select>
          </div>
        ) : null}

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
