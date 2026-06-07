type Props = {
  disabled?: boolean;
  starCount: number;
  onStar: () => void;
};

/** One-tap bookmark for film review — logs match + film clock at tap time. */
export function StarMomentButton({ disabled, starCount, onStar }: Props) {
  return (
    <button
      type="button"
      className="btn btn-primary tracking-star-moment-btn"
      disabled={disabled}
      onClick={onStar}
      aria-label="Star this moment for film review"
    >
      ★ Star moment{starCount > 0 ? ` (${starCount})` : ''}
    </button>
  );
}
