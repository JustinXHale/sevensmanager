type Props = {
  ourScore: number;
  opponentScore: number;
  ourLabel: string;
  opponentLabel: string;
  onResume: () => void;
};

export function MatchCompleteOverlay({
  ourScore,
  opponentScore,
  ourLabel,
  opponentLabel,
  onResume,
}: Props) {
  return (
    <div className="ref-clock-complete-overlay" role="dialog" aria-label="Full time" aria-modal="true">
      <span className="ref-clock-complete-label">Full time</span>
      <div
        className="ref-clock-complete-scoreboard"
        aria-label={`Final score ${ourScore} to ${opponentScore}`}
      >
        <span className="ref-clock-complete-team">{ourLabel}</span>
        <span className="ref-clock-complete-points">{ourScore}</span>
        <span className="ref-clock-complete-sep" aria-hidden>
          –
        </span>
        <span className="ref-clock-complete-points">{opponentScore}</span>
        <span className="ref-clock-complete-team">{opponentLabel}</span>
      </div>
      <button type="button" className="ref-clock-halftime-resume" onClick={onResume}>
        Resume match
      </button>
    </div>
  );
}
