import type { MatchClockDisplayMode, PeriodClockDisplayMode } from '@/domain/match';
import { formatClock } from '@/domain/matchClock';

const NUDGE_MS = 5_000;
const VIDEO_NUDGE_MS = [30_000, 60_000, 120_000] as const;

type Props = {
  period: number;
  matchClockMode: MatchClockDisplayMode;
  periodClockMode: PeriodClockDisplayMode;
  /** Match row (elapsed or remaining). */
  matchDisplayMs: number;
  /** Current period row (elapsed or remaining). */
  periodDisplayMs: number;
  /** Video player position (match elapsed + film offset). Shown beside match when offset is set. */
  filmTimeOffsetMs?: number;
  videoDisplayMs?: number;
  shouldBlink: boolean;
  running: boolean;
  halfTimeActive: boolean;
  halfTimeElapsedMs: number;
  refStoppageActive: boolean;
  matchComplete: boolean;
  /** Own team points (from logged tries / conversions). */
  ourScore: number;
  /** Opponent points (from logged opponent tries / conversions). */
  opponentScore: number;
  /** Short label left pillar (e.g. team name or “Us”). */
  ourLabel: string;
  /** Short label right pillar (e.g. opponent or “Opp”). */
  opponentLabel: string;
  onToggle: () => void;
  onAdjust: (deltaMs: number) => void;
  onAdvancePeriod: () => void;
  onHalftime: () => void;
  onResumeFromHalftime: () => void;
  onToggleRefStoppage: () => void;
  onNudgeVideoTime: (deltaMs: number) => void;
  onEndMatch: () => void;
  onOpenClockSettings: () => void;
};

/**
 * Match clock: match | play | period (RefLog-style split), tools row, halftime overlay.
 */
export function RefClockBar({
  period,
  matchClockMode,
  periodClockMode,
  matchDisplayMs,
  periodDisplayMs,
  filmTimeOffsetMs = 0,
  videoDisplayMs = 0,
  shouldBlink,
  running,
  halfTimeActive,
  halfTimeElapsedMs,
  refStoppageActive,
  matchComplete,
  ourScore,
  opponentScore,
  ourLabel,
  opponentLabel,
  onToggle,
  onAdjust,
  onAdvancePeriod,
  onHalftime,
  onResumeFromHalftime,
  onToggleRefStoppage,
  onNudgeVideoTime,
  onEndMatch,
  onOpenClockSettings,
}: Props) {
  const warn = shouldBlink ? ' ref-clk-digits--warn' : '';
  const matchLabel = matchClockMode === 'down' ? 'Match ↓' : 'Match';
  const periodLabel = periodClockMode === 'down' ? `P${period} ↓` : `P${period}`;
  const clockLocked = halfTimeActive || matchComplete;
  const showVideoTime = filmTimeOffsetMs > 0 || refStoppageActive || videoDisplayMs > matchDisplayMs;

  return (
    <div
      className={`ref-clock-wrap${halfTimeActive ? ' ref-clock-wrap--halftime' : ''}${
        refStoppageActive ? ' ref-clock-wrap--stoppage' : ''
      }${matchComplete ? ' ref-clock-wrap--complete' : ''}`}
    >
      <div
        className={`ref-clock-bar ref-clock-two-line ref-clock-bar--with-scores${
          clockLocked ? ' ref-clock-bar--dimmed' : ''
        }`}
      >
        <div className="ref-clock-score-pillar ref-clock-score-pillar--us">
          <span className="ref-clock-score-label" title="Your team (from tries & conversions)">
            {ourLabel}
          </span>
          <span className="ref-clock-score-num" aria-label={`Our score ${ourScore}`}>
            {ourScore}
          </span>
        </div>

        <div className="ref-clock-center">
          <div className="ref-clock-track">
            <div className="ref-clk-split">
              <div className="ref-clk-block ref-clk-block--match">
                <span className="ref-clk-block-label">{matchLabel}</span>
                <span
                  className={`ref-clk-digits-row${warn}${matchDisplayMs < 0 ? ' ref-clk-digits--neg' : ''}`}
                  aria-live="polite"
                  title={showVideoTime ? 'Match time (video time in parentheses)' : undefined}
                >
                  <span className="ref-clk-digits">{formatClock(matchDisplayMs)}</span>
                  {showVideoTime ? (
                    <span className="ref-clk-digits ref-clk-digits--video" aria-label={`Video time ${formatClock(videoDisplayMs)}`}>
                      ({formatClock(videoDisplayMs)})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="ref-clk-controls">
                <button
                  type="button"
                  className="ref-clk-tap ref-clk-tap--split"
                  title={running ? 'Pause' : 'Start'}
                  aria-label={running ? 'Pause clock' : 'Start clock'}
                  disabled={clockLocked}
                  onClick={onToggle}
                >
                  {running ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  className={`ref-clk-tap ref-clk-tap--split ref-clk-tap--whistle${
                    refStoppageActive ? ' ref-clk-tap--whistle-active' : ''
                  }`}
                  title={
                    refStoppageActive
                      ? 'End ref stoppage — match clock resumes'
                      : 'Ref stoppage — pause match clock; film time keeps running'
                  }
                  aria-label={refStoppageActive ? 'End ref stoppage' : 'Ref stoppage whistle'}
                  aria-pressed={refStoppageActive}
                  disabled={clockLocked}
                  onClick={onToggleRefStoppage}
                >
                  <svg className="ref-clk-whistle-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <ellipse cx="6.5" cy="10" rx="4" ry="3" fill="currentColor" />
                    <rect x="10" y="8.75" width="7" height="2.5" rx="0.5" fill="currentColor" />
                    <circle cx="18.25" cy="10" r="1.25" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <div className="ref-clk-block ref-clk-block--period">
                <span className="ref-clk-block-label" title="Current period; Next advances period">
                  {periodLabel}
                </span>
                <span
                  className={`ref-clk-digits ref-clk-digits--period${warn}${
                    periodDisplayMs < 0 ? ' ref-clk-digits--neg' : ''
                  }`}
                  aria-live="polite"
                >
                  {formatClock(periodDisplayMs)}
                </span>
              </div>
            </div>
          </div>

          <div className="ref-clock-tools">
            <span className="ref-tool-cluster" title="Nudge period clock by 5 seconds">
              <button
                type="button"
                className="ref-tool-btn ref-tool-nudge"
                disabled={clockLocked}
                onClick={() => onAdjust(-NUDGE_MS)}
              >
                −5s
              </button>
              <button
                type="button"
                className="ref-tool-btn ref-tool-nudge"
                disabled={clockLocked}
                onClick={() => onAdjust(NUDGE_MS)}
              >
                +5s
              </button>
            </span>
            <button
              type="button"
              className="ref-tool-btn ref-tool-next-period"
              title="Next period (1–10, then wraps)"
              aria-label="Advance to next period"
              disabled={clockLocked}
              onClick={onAdvancePeriod}
            >
              Next
            </button>
            <button
              type="button"
              className="ref-tool-btn ref-tool-halftime"
              title="Halftime — advance period, pause match and film clocks"
              aria-label="Halftime"
              disabled={clockLocked}
              onClick={onHalftime}
            >
              HT
            </button>
            <button
              type="button"
              className="ref-tool-btn ref-tool-end"
              title="End match — pause clocks and mark full time"
              aria-label="End match"
              disabled={clockLocked}
              onClick={onEndMatch}
            >
              FT
            </button>
            <button
              type="button"
              className="ref-tool-btn ref-tool-edit"
              title="Edit clock settings and set times"
              aria-label="Clock settings"
              disabled={clockLocked}
              onClick={onOpenClockSettings}
            >
              ✎
            </button>
          </div>
        </div>

        <div className="ref-clock-score-pillar ref-clock-score-pillar--them">
          <span
            className="ref-clock-score-label"
            title="Opponent (from logged tries and conversions on the Opp tab)"
          >
            {opponentLabel}
          </span>
          <span className="ref-clock-score-num" aria-label={`Opponent score ${opponentScore}`}>
            {opponentScore}
          </span>
        </div>
      </div>

      {refStoppageActive ? (
        <div className="ref-clock-stoppage-banner" role="status" aria-live="polite">
          <span className="ref-clock-stoppage-label">Ref stoppage</span>
          <span className="ref-clock-stoppage-video" title="Video player position (match clock is frozen)">
            Video {formatClock(videoDisplayMs)}
          </span>
          <span className="ref-clock-stoppage-cluster" title="Fast-forward video time as you scrub past injury or stoppage footage">
            {VIDEO_NUDGE_MS.map((ms) => (
              <button
                key={ms}
                type="button"
                className="ref-clock-stoppage-nudge"
                onClick={() => onNudgeVideoTime(ms)}
              >
                +{ms >= 60_000 ? `${ms / 60_000}m` : `${ms / 1000}s`}
              </button>
            ))}
          </span>
          <span className="ref-clock-stoppage-sub">Match paused</span>
        </div>
      ) : null}

      {halfTimeActive ? (
        <div className="ref-clock-halftime-overlay" role="dialog" aria-label="Halftime" aria-modal="true">
          <div className="ref-clock-halftime-banner">
            <span className="ref-clock-halftime-label">Halftime</span>
            <span className="ref-clock-halftime-elapsed" title="Time in halftime">
              {formatClock(halfTimeElapsedMs)}
            </span>
            <span className="ref-clock-halftime-sub">Elapsed</span>
          </div>
          <button type="button" className="ref-clock-halftime-resume" onClick={onResumeFromHalftime}>
            Resume match
          </button>
        </div>
      ) : null}

    </div>
  );
}
