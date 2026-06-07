import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MatchClockDisplayMode, MatchSessionRecord, PeriodClockDisplayMode } from '@/domain/match';
import { SESSION_PERIOD_MAX } from '@/domain/match';
import {
  applyClockDisplaySettings,
  bankedMatchMsBeforeCurrentPeriod,
  cumulativeMatchTimeMs,
  currentGameElapsedDisplayMs,
  currentMatchDisplayForUi,
  currentPeriodDisplayForUi,
  currentPeriodElapsedDisplayMs,
  DEFAULT_MATCH_COUNTDOWN_MS,
  filmTimeOffsetMs,
  formatClock,
  parseMmSsToMs,
} from '@/domain/matchClock';

export type ClockSettingsApplyPayload = {
  period: number;
  matchClockDisplayMode: MatchClockDisplayMode;
  matchCountdownLengthMs: number;
  periodClockDisplayMode: PeriodClockDisplayMode;
  periodCountdownLengthMs: number;
  matchDisplayedMs: number;
  periodDisplayedMs: number;
  filmTimeOffsetMs: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  session: MatchSessionRecord | null;
  nowMs: number;
  onApply: (payload: ClockSettingsApplyPayload) => Promise<void>;
  onReset: () => Promise<void>;
};

const PERIOD_OPTIONS = Array.from({ length: SESSION_PERIOD_MAX }, (_, i) => i + 1);

export function RefClockSettingsDialog({ open, onClose, session, nowMs, onApply, onReset }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [matchMode, setMatchMode] = useState<MatchClockDisplayMode>('up');
  const [matchLenStr, setMatchLenStr] = useState('14:00');
  const [periodMode, setPeriodMode] = useState<PeriodClockDisplayMode>('up');
  const [countdownLenStr, setCountdownLenStr] = useState('7:00');
  const [matchStr, setMatchStr] = useState('0:00');
  const [periodStr, setPeriodStr] = useState('0:00');
  const [periodSegment, setPeriodSegment] = useState(1);
  const [filmOffsetStr, setFilmOffsetStr] = useState('0:00');
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
    if (!open || !session) return;
    setMatchMode(session.matchClockDisplayMode ?? 'up');
    setMatchLenStr(formatClock(session.matchCountdownLengthMs ?? DEFAULT_MATCH_COUNTDOWN_MS));
    setPeriodMode(session.periodClockDisplayMode ?? 'up');
    const len = session.periodCountdownLengthMs ?? 7 * 60 * 1000;
    setCountdownLenStr(formatClock(len));
    setMatchStr(formatClock(currentMatchDisplayForUi(session, nowMs)));
    setPeriodStr(formatClock(currentPeriodDisplayForUi(session, nowMs)));
    setPeriodSegment(session.period);
    setFilmOffsetStr(formatClock(filmTimeOffsetMs(session)));
    setFormError(null);
  }, [open, session, nowMs]);

  function syncMatchFieldToMode(nextMode: MatchClockDisplayMode) {
    if (!session) return;
    if (nextMode === 'up') {
      setMatchStr(formatClock(cumulativeMatchTimeMs(session, nowMs)));
      return;
    }
    const asDown = applyClockDisplaySettings(session, { matchClockDisplayMode: 'down' });
    setMatchStr(formatClock(currentMatchDisplayForUi(asDown, nowMs)));
  }

  function syncPeriodFieldToMode(nextMode: PeriodClockDisplayMode) {
    if (!session) return;
    if (nextMode === 'up') {
      setPeriodStr(formatClock(currentPeriodElapsedDisplayMs(session, nowMs)));
      return;
    }
    const asDown = applyClockDisplaySettings(session, { periodClockDisplayMode: 'down' });
    setPeriodStr(formatClock(currentPeriodDisplayForUi(asDown, nowMs)));
  }

  const bankedMs = session ? bankedMatchMsBeforeCurrentPeriod(session) : 0;
  const filmOffsetPreviewMs = session
    ? parseMmSsToMs(filmOffsetStr) ?? filmTimeOffsetMs(session)
    : 0;
  const videoNowMs = session
    ? currentGameElapsedDisplayMs(session, nowMs) + filmOffsetPreviewMs
    : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const lenMs = parseMmSsToMs(countdownLenStr);
    if (lenMs === null || lenMs <= 0) {
      setFormError('Period length must be positive (e.g. 7:00).');
      return;
    }
    const matchLenParsed = parseMmSsToMs(matchLenStr);
    if (matchMode === 'down') {
      if (matchLenParsed === null || matchLenParsed <= 0) {
        setFormError('Match countdown length must be positive (e.g. 14:00).');
        return;
      }
    }
    const matchMs = parseMmSsToMs(matchStr);
    const periodMs = parseMmSsToMs(periodStr);
    if (matchMs === null) {
      setFormError('Match time must look like 12:34 or -1:30 when counting down.');
      return;
    }
    if (matchMode === 'up' && matchMs < 0) {
      setFormError('Match elapsed can’t be negative when counting up.');
      return;
    }
    if (periodMs === null) {
      setFormError('Period time must look like 5:00 or -1:30 (minutes:seconds).');
      return;
    }
    const filmOffsetParsed = parseMmSsToMs(filmOffsetStr);
    if (filmOffsetParsed === null || filmOffsetParsed < 0) {
      setFormError('Video offset must be zero or positive (e.g. 0:48).');
      return;
    }
    const pSeg = Math.round(periodSegment);
    if (!Number.isFinite(pSeg) || pSeg < 1 || pSeg > SESSION_PERIOD_MAX) {
      setFormError(`Period must be from 1 to ${SESSION_PERIOD_MAX}.`);
      return;
    }
    setFormError(null);
    const matchCountdownLen =
      matchLenParsed ??
      session.matchCountdownLengthMs ??
      DEFAULT_MATCH_COUNTDOWN_MS;
    const payload: ClockSettingsApplyPayload = {
      period: pSeg,
      matchClockDisplayMode: matchMode,
      matchCountdownLengthMs: matchCountdownLen,
      periodClockDisplayMode: periodMode,
      periodCountdownLengthMs: lenMs,
      matchDisplayedMs: matchMs,
      periodDisplayedMs: periodMs,
      filmTimeOffsetMs: filmOffsetParsed,
    };
    setSaving(true);
    try {
      await onApply(payload);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not apply settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setFormError(null);
    try {
      await onReset();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not reset.');
    }
  }

  return (
    <dialog ref={ref} className="roster-dialog ref-clock-settings-dialog" onClose={onClose}>
      <form className="roster-dialog-inner ref-clock-settings-inner" onSubmit={(e) => void handleSubmit(e)}>
        <h2 className="roster-dialog-title ref-clock-settings-title">Clock settings</h2>
        <p className="muted roster-dialog-lead ref-clock-settings-lead">
          Choose which side counts <strong>up</strong> (elapsed) or <strong>down</strong> (remaining). Match and period
          are independent. After full time, countdown can show negative (overtime).
        </p>

        <fieldset className="ref-clock-settings-fieldset">
          <legend className="ref-clock-settings-legend">Match timer</legend>
          <label className="ref-clock-settings-radio">
            <input
              type="radio"
              name="matchMode"
              checked={matchMode === 'up'}
              onChange={() => {
                setMatchMode('up');
                syncMatchFieldToMode('up');
              }}
            />
            Count up (total elapsed)
          </label>
          <label className="ref-clock-settings-radio">
            <input
              type="radio"
              name="matchMode"
              checked={matchMode === 'down'}
              onChange={() => {
                setMatchMode('down');
                syncMatchFieldToMode('down');
              }}
            />
            Count down (remaining vs length below)
          </label>
        </fieldset>

        {matchMode === 'down' ? (
          <div className="field ref-clock-settings-field">
            <span>Match countdown length</span>
            <input
              type="text"
              className="filter-select"
              inputMode="numeric"
              value={matchLenStr}
              onChange={(e) => setMatchLenStr(e.target.value)}
              placeholder="14:00"
              aria-label="Match regulation length m:ss"
            />
          </div>
        ) : null}

        <fieldset className="ref-clock-settings-fieldset">
          <legend className="ref-clock-settings-legend">Period timer</legend>
          <label className="ref-clock-settings-radio">
            <input
              type="radio"
              name="periodMode"
              checked={periodMode === 'up'}
              onChange={() => {
                setPeriodMode('up');
                syncPeriodFieldToMode('up');
              }}
            />
            Count up (elapsed in this period)
          </label>
          <label className="ref-clock-settings-radio">
            <input
              type="radio"
              name="periodMode"
              checked={periodMode === 'down'}
              onChange={() => {
                setPeriodMode('down');
                syncPeriodFieldToMode('down');
              }}
            />
            Count down (time remaining in period)
          </label>
        </fieldset>

        <div className="field ref-clock-settings-field">
          <span>Period length (for period countdown)</span>
          <input
            type="text"
            className="filter-select"
            inputMode="numeric"
            value={countdownLenStr}
            onChange={(e) => setCountdownLenStr(e.target.value)}
            placeholder="7:00"
            aria-label="Period length m:ss"
          />
        </div>

        <div className="field ref-clock-settings-field">
          <span>{matchMode === 'up' ? 'Match elapsed (total)' : 'Match time remaining'}</span>
          <input
            type="text"
            className="filter-select"
            inputMode="numeric"
            value={matchStr}
            onChange={(e) => setMatchStr(e.target.value)}
            placeholder={matchMode === 'up' ? '0:00' : '-0:30'}
            aria-label="Match time"
          />
          {session && bankedMs > 0 ? (
            <p className="muted ref-clock-settings-hint">
              <strong>{formatClock(bankedMs)}</strong> is already counted from before this period (Next / Halftime).
              Match total can’t go below that when counting up.
            </p>
          ) : (
            <p className="muted ref-clock-settings-hint">
              When counting up, minimum match total is any time stored from earlier periods (Next / Halftime).
            </p>
          )}
        </div>

        <div className="field ref-clock-settings-field">
          <span>{periodMode === 'up' ? 'Period elapsed' : 'Period time remaining'}</span>
          <input
            type="text"
            className="filter-select"
            inputMode="numeric"
            value={periodStr}
            onChange={(e) => setPeriodStr(e.target.value)}
            placeholder={periodMode === 'up' ? '0:00' : '-0:30'}
            aria-label="Period time"
          />
        </div>

        <fieldset className="ref-clock-settings-fieldset">
          <legend className="ref-clock-settings-legend">Film / video sync</legend>
          <p className="muted ref-clock-settings-hint">
            When match time is <strong>0:00</strong>, where does kickoff sit on your video file? Starred moments and
            film bookmarks show <strong>video time</strong> (match film clock + this offset).
          </p>
          <div className="field ref-clock-settings-field">
            <span>Video time at match 0:00</span>
            <input
              type="text"
              className="filter-select"
              inputMode="numeric"
              value={filmOffsetStr}
              onChange={(e) => setFilmOffsetStr(e.target.value)}
              placeholder="0:48"
              aria-label="Video time at match zero m:ss"
            />
          </div>
          {session ? (
            <p className="muted ref-clock-settings-hint" aria-live="polite">
              Video position now: <strong>{formatClock(videoNowMs)}</strong>
            </p>
          ) : null}
        </fieldset>

        <div className="field ref-clock-settings-field">
          <span>Period (1–{SESSION_PERIOD_MAX})</span>
          <select
            className="filter-select"
            value={periodSegment}
            onChange={(e) => setPeriodSegment(Number(e.target.value))}
            aria-label="Period number"
          >
            {PERIOD_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Period {n}
              </option>
            ))}
          </select>
        </div>

        {formError ? <p className="error-text ref-clock-settings-error" role="alert">{formError}</p> : null}

        <div className="roster-dialog-actions ref-clock-settings-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void handleReset()}>
            Reset match clock
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
