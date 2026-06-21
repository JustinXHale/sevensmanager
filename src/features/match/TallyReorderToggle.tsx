type Props = {
  active: boolean;
  onToggle: () => void;
};

function GripIcon() {
  return (
    <svg className="tracking-reorder-icon-svg" viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      <circle cx="5" cy="4" r="1.25" fill="currentColor" />
      <circle cx="11" cy="4" r="1.25" fill="currentColor" />
      <circle cx="5" cy="8" r="1.25" fill="currentColor" />
      <circle cx="11" cy="8" r="1.25" fill="currentColor" />
      <circle cx="5" cy="12" r="1.25" fill="currentColor" />
      <circle cx="11" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="tracking-reorder-icon-svg" viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Toggle drag-and-drop reorder mode for Tally counters. */
export function TallyReorderToggle({ active, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`tracking-reorder-icon-btn${active ? ' tracking-reorder-icon-btn--active' : ''}`}
      aria-pressed={active}
      aria-label={active ? 'Done reordering tally buttons' : 'Reorder tally buttons'}
      title={active ? 'Done reordering' : 'Reorder buttons'}
      onClick={onToggle}
    >
      {active ? <CheckIcon /> : <GripIcon />}
    </button>
  );
}
