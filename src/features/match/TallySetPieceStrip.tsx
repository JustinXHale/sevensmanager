import { useEffect, useState } from 'react';
import type { MatchEventKind, PlayPhaseContext, RuckContest } from '@/domain/matchEvent';

export type TallySetPieceChoice =
  | 'won'
  | 'lost'
  | 'free_kick'
  | 'penalty_awarded'
  | 'penalty_conceded';

const SET_PIECE_KINDS: { kind: MatchEventKind; label: string }[] = [
  { kind: 'restart', label: 'Restart' },
  { kind: 'ruck', label: 'Ruck' },
  { kind: 'scrum', label: 'Scrum' },
  { kind: 'lineout', label: 'Lineout' },
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

const RUCK_CONTEST_BUTTONS: { contest: RuckContest; label: string; title: string }[] = [
  { contest: 'contested', label: 'Con', title: 'Contested' },
  { contest: 'uncontested', label: 'Unc', title: 'Uncontested' },
];

type PendingRuck = { choice: 'won' | 'lost'; phase: PlayPhaseContext };

type Props = {
  phase: PlayPhaseContext;
  onChoice: (
    kind: MatchEventKind,
    choice: TallySetPieceChoice,
    phase: PlayPhaseContext,
    ruckContest?: RuckContest,
  ) => void;
};

function tapThenBlur(ev: React.MouseEvent<HTMLButtonElement>, run: () => void) {
  run();
  requestAnimationFrame(() => ev.currentTarget.blur());
}

function setPieceKindLabel(kind: MatchEventKind, phase: PlayPhaseContext, baseLabel: string): string {
  if (kind === 'restart') {
    return phase === 'attack' ? 'Restart (Receiving kick)' : 'Restart (Kicking off)';
  }
  return baseLabel;
}

export function TallySetPieceStrip({ phase, onChoice }: Props) {
  const [pendingRuck, setPendingRuck] = useState<PendingRuck | null>(null);

  useEffect(() => {
    setPendingRuck(null);
  }, [phase]);

  function completeRuck(contest: RuckContest) {
    if (!pendingRuck) return;
    onChoice('ruck', pendingRuck.choice, pendingRuck.phase, contest);
    setPendingRuck(null);
  }

  return (
    <div className="tally-setpiece-strip" aria-label={`Set pieces (${phase})`}>
      {SET_PIECE_KINDS.map(({ kind, label }) => {
        const displayLabel = setPieceKindLabel(kind, phase, label);
        const ruckPending = kind === 'ruck' && pendingRuck != null;
        const ruckPrompt =
          ruckPending && pendingRuck.choice === 'won'
            ? 'Won — contested?'
            : ruckPending
              ? 'Lost — contested?'
              : null;

        return (
          <div
            key={kind}
            className={`tally-setpiece-group${ruckPending ? ' tally-setpiece-group--ruck-pending' : ''}`}
          >
            <span className={`tally-setpiece-kind${kind === 'restart' ? ' tally-setpiece-kind--restart' : ''}`}>
              {displayLabel}
            </span>
            {ruckPrompt ? <span className="tally-setpiece-ruck-prompt">{ruckPrompt}</span> : null}
            <div className="tally-setpiece-btns" role="group" aria-label={displayLabel}>
              {ruckPending ? (
                <>
                  {RUCK_CONTEST_BUTTONS.map(({ contest, label: btnLabel, title }) => (
                    <button
                      key={contest}
                      type="button"
                      className="tally-setpiece-btn tally-setpiece-btn--ruck-contest"
                      title={title}
                      aria-label={`Ruck · ${pendingRuck.choice === 'won' ? 'Won' : 'Lost'} · ${title}`}
                      onClick={(e) => tapThenBlur(e, () => completeRuck(contest))}
                    >
                      {btnLabel}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="tally-setpiece-btn tally-setpiece-btn--ruck-cancel"
                    title="Cancel"
                    aria-label="Cancel ruck selection"
                    onClick={(e) => tapThenBlur(e, () => setPendingRuck(null))}
                  >
                    ×
                  </button>
                </>
              ) : (
                OUTCOME_BUTTONS.map(({ choice, label: btnLabel, title, className }) => (
                  <button
                    key={choice}
                    type="button"
                    className={`tally-setpiece-btn${className ? ` ${className}` : ''}`}
                    title={title}
                    aria-label={`${displayLabel} · ${title}`}
                    onClick={(e) =>
                      tapThenBlur(e, () => {
                        if (kind === 'ruck' && (choice === 'won' || choice === 'lost')) {
                          setPendingRuck({ choice, phase });
                          return;
                        }
                        setPendingRuck(null);
                        onChoice(kind, choice, phase);
                      })
                    }
                  >
                    {btnLabel}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
