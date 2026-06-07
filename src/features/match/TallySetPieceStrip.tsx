import type { MatchEventKind, PlayPhaseContext } from '@/domain/matchEvent';

export type TallySetPieceChoice =
  | 'won'
  | 'lost'
  | 'free_kick'
  | 'penalty_awarded'
  | 'penalty_conceded';

const SET_PIECE_KINDS: { kind: MatchEventKind; label: string }[] = [
  { kind: 'lineout', label: 'Lineout' },
  { kind: 'restart', label: 'Restart' },
  { kind: 'ruck', label: 'Ruck' },
  { kind: 'scrum', label: 'Scrum' },
];

const OUTCOME_BUTTONS: {
  choice: TallySetPieceChoice;
  label: string;
  title: string;
  className?: string;
}[] = [
  { choice: 'won', label: 'W', title: 'Won' },
  { choice: 'lost', label: 'L', title: 'Lost', className: 'tally-setpiece-btn--lost' },
  { choice: 'free_kick', label: 'FK', title: 'Free kick', className: 'tally-setpiece-btn--fk' },
  {
    choice: 'penalty_awarded',
    label: 'P+',
    title: 'Penalty awarded (won)',
    className: 'tally-setpiece-btn--pen-plus',
  },
  {
    choice: 'penalty_conceded',
    label: 'P−',
    title: 'Penalty conceded (lost)',
    className: 'tally-setpiece-btn--pen-minus',
  },
];

type Props = {
  phase: PlayPhaseContext;
  onChoice: (kind: MatchEventKind, choice: TallySetPieceChoice, phase: PlayPhaseContext) => void;
};

function tapThenBlur(ev: React.MouseEvent<HTMLButtonElement>, run: () => void) {
  run();
  requestAnimationFrame(() => ev.currentTarget.blur());
}

export function TallySetPieceStrip({ phase, onChoice }: Props) {
  return (
    <div className="tally-setpiece-strip" aria-label={`Set pieces (${phase})`}>
      {SET_PIECE_KINDS.map(({ kind, label }) => (
        <div key={kind} className="tally-setpiece-group">
          <span className="tally-setpiece-kind">{label}</span>
          <div className="tally-setpiece-btns" role="group" aria-label={label}>
            {OUTCOME_BUTTONS.map(({ choice, label: btnLabel, title, className }) => (
              <button
                key={choice}
                type="button"
                className={`tally-setpiece-btn${className ? ` ${className}` : ''}`}
                title={title}
                aria-label={`${label} · ${title}`}
                onClick={(e) => tapThenBlur(e, () => onChoice(kind, choice, phase))}
              >
                {btnLabel}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
