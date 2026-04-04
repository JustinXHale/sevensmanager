import type { MatchClockDisplayMode, PeriodClockDisplayMode } from '@/domain/match';
import { formatClock } from '@/domain/matchClock';

const NUDGE_MS = 5_000;

type Props = {
  period: number;
  matchClockMode: MatchClockDisplayMode;
  periodClockMode: PeriodClockDisplayMode;
  /** Match row (elapsed or remaining). */
  matchDisplayMs: number;
  /** Current period row (elapsed or remaining). */
  periodDisplayMs: number;
  shouldBlink: boolean;
  running: boolean;
  halfTimeActive: boolean;
  halfTimeElapsedMs: number;
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
  shouldBlink,
  running,
  halfTimeActive,
  halfTimeElapsedMs,
  ourScore,
  opponentScore,
  ourLabel,
  opponentLabel,
  onToggle,
  onAdjust,
  onAdvancePeriod,
  onHalftime,
  onResumeFromHalftime,
  onOpenClockSettings,
}: Props) {
  const warn = shouldBlink ? ' ref-clk-digits--warn' : '';
  const matchLabel = matchClockMode === 'down' ? 'Match ↓' : 'Match';
  const periodLabel = periodClockMode === 'down' ? `P${period} ↓` : `P${period}`;

  return (
    <div className={`ref-clock-wrap${halfTimeActive ? ' ref-clock-wrap--halftime' : ''}`}>
      <div
        className={`ref-clock-bar ref-clock-two-line ref-clock-bar--with-scores${
          halfTimeActive ? ' ref-clock-bar--dimmed' : ''
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
                  className={`ref-clk-digits${warn}${matchDisplayMs < 0 ? ' ref-clk-digits--neg' : ''}`}
                  aria-live="polite"
                >
                  {formatClock(matchDisplayMs)}
                </span>
              </div>
              <button
                type="button"
                className="ref-clk-tap ref-clk-tap--split"
                title={running ? 'Pause' : 'Start'}
                aria-label={running ? 'Pause clock' : 'Start clock'}
                disabled={halfTimeActive}
                onClick={onToggle}
              >
                {running ? '⏸' : '▶'}
              </button>
              <div className="ref-clk-block ref-clk-block--period">
                <span className="ref-clk-block-label" title="Current period; Next advances segment">
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
                disabled={halfTimeActive}
                onClick={() => onAdjust(-NUDGE_MS)}
              >
                −5s
              </button>
              <button
                type="button"
                className="ref-tool-btn ref-tool-nudge"
                disabled={halfTimeActive}
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
              disabled={halfTimeActive}
              onClick={onAdvancePeriod}
            >
              Next
            </button>
            <button
              type="button"
              className="ref-tool-btn ref-tool-halftime"
              title="Halftime — advance period, pause match and film clocks"
              aria-label="Halftime"
              disabled={halfTimeActive}
              onClick={onHalftime}
            >
              HT
            </button>
            <button
              type="button"
              className="ref-tool-btn ref-tool-edit"
              title="Edit clock settings and set times"
              aria-label="Clock settings"
              disabled={halfTimeActive}
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
