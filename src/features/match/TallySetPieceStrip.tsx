import { useEffect, useState } from 'react';
import type {
  PenaltyDirection,
  PlayPhaseContext,
  RuckContest,
  SetPiecePenaltyContext,
} from '@/domain/matchEvent';
import {
  TallyPenaltyInfractionPicker,
  type TallyPenaltyInfractionPick,
} from './TallyPenaltyInfractionPicker';

export type TallySetPieceChoice = 'won' | 'lost' | 'free_kick';

const SET_PIECE_KINDS: { kind: SetPiecePenaltyContext; label: string }[] = [
  { kind: 'restart', label: 'Restart' },
  { kind: 'ruck', label: 'Ruck' },
  { kind: 'scrum', label: 'Scrum' },
  { kind: 'lineout', label: 'Lineout' },
];

const OUTCOME_BUTTONS: {
  choice: TallySetPieceChoice | 'penalty_awarded' | 'penalty_conceded';
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
    title: 'Penalty awarded — logs won + infraction',
    className: 'tally-setpiece-btn--pen-plus',
  },
  {
    choice: 'penalty_conceded',
    label: 'P−',
    title: 'Penalty conceded — logs lost + infraction',
    className: 'tally-setpiece-btn--pen-minus',
  },
];

const RUCK_CONTEST_BUTTONS: { contest: RuckContest; label: string; title: string }[] = [
  { contest: 'contested', label: 'Con', title: 'Contested' },
  { contest: 'uncontested', label: 'Unc', title: 'Uncontested' },
];

type PendingRuck = { choice: 'won' | 'lost'; phase: PlayPhaseContext };

type PendingPenalty = {
  kind: SetPiecePenaltyContext;
  direction: PenaltyDirection;
  phase: PlayPhaseContext;
};

type Props = {
  phase: PlayPhaseContext;
  onChoice: (
    kind: SetPiecePenaltyContext,
    choice: TallySetPieceChoice,
    phase: PlayPhaseContext,
    ruckContest?: RuckContest,
  ) => void;
  onPenaltyChoice: (
    kind: SetPiecePenaltyContext,
    direction: PenaltyDirection,
    phase: PlayPhaseContext,
    payload: TallyPenaltyInfractionPick,
  ) => void;
};

function tapThenBlur(ev: React.MouseEvent<HTMLButtonElement>, run: () => void) {
  run();
  requestAnimationFrame(() => ev.currentTarget.blur());
}

function setPieceKindLabel(kind: SetPiecePenaltyContext, phase: PlayPhaseContext, baseLabel: string): string {
  if (kind === 'restart') {
    return phase === 'attack' ? 'Restart (Receiving kick)' : 'Restart (Kicking off)';
  }
  return baseLabel;
}

function isPenaltyChoice(
  choice: TallySetPieceChoice | 'penalty_awarded' | 'penalty_conceded',
): choice is 'penalty_awarded' | 'penalty_conceded' {
  return choice === 'penalty_awarded' || choice === 'penalty_conceded';
}

export function TallySetPieceStrip({ phase, onChoice, onPenaltyChoice }: Props) {
  const [pendingRuck, setPendingRuck] = useState<PendingRuck | null>(null);
  const [pendingPenalty, setPendingPenalty] = useState<PendingPenalty | null>(null);

  useEffect(() => {
    setPendingRuck(null);
    setPendingPenalty(null);
  }, [phase]);

  function completeRuck(contest: RuckContest) {
    if (!pendingRuck) return;
    onChoice('ruck', pendingRuck.choice, pendingRuck.phase, contest);
    setPendingRuck(null);
  }

  const penaltyPicker =
    pendingPenalty != null ? (
      <TallyPenaltyInfractionPicker
        phase={pendingPenalty.phase}
        direction={pendingPenalty.direction}
        setPieceKind={pendingPenalty.kind}
        contextLabel={setPieceKindLabel(
          pendingPenalty.kind,
          pendingPenalty.phase,
          SET_PIECE_KINDS.find((k) => k.kind === pendingPenalty.kind)?.label ?? pendingPenalty.kind,
        )}
        onSubmit={(payload) => {
          onPenaltyChoice(pendingPenalty.kind, pendingPenalty.direction, pendingPenalty.phase, payload);
          setPendingPenalty(null);
        }}
        onCancel={() => setPendingPenalty(null)}
      />
    ) : null;

  return (
    <div className="tally-setpiece-wrap">
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
              <div className="tally-setpiece-row">
                <div className="tally-setpiece-label">
                  <span className={`tally-setpiece-kind${kind === 'restart' ? ' tally-setpiece-kind--restart' : ''}`}>
                    {displayLabel}
                  </span>
                  {ruckPrompt ? <span className="tally-setpiece-ruck-prompt">{ruckPrompt}</span> : null}
                </div>
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
                          if (isPenaltyChoice(choice)) {
                            setPendingRuck(null);
                            setPendingPenalty({
                              kind,
                              direction: choice === 'penalty_awarded' ? 'awarded' : 'conceded',
                              phase,
                            });
                            return;
                          }
                          if (kind === 'ruck' && (choice === 'won' || choice === 'lost')) {
                            setPendingPenalty(null);
                            setPendingRuck({ choice, phase });
                            return;
                          }
                          setPendingRuck(null);
                          setPendingPenalty(null);
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
            </div>
          );
        })}
      </div>
      {penaltyPicker}
    </div>
  );
}
