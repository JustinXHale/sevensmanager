type Props = {
  disabled?: boolean;
  starCount: number;
  onStar: () => void;
  /** Inline with tracking mode switch — saves vertical space on live match. */
  compact?: boolean;
};

/** One-tap bookmark for film review — logs match + film clock at tap time. */
export function StarMomentButton({ disabled, starCount, onStar, compact = false }: Props) {
  return (
    <button
      type="button"
      className={`btn btn-primary tracking-star-moment-btn${compact ? ' tracking-star-moment-btn--compact' : ''}`}
      disabled={disabled}
      onClick={onStar}
      aria-label="Star this moment for film review"
    >
      ★{compact ? '' : ' Star moment'}
      {starCount > 0 ? ` (${starCount})` : ''}
    </button>
  );
}
