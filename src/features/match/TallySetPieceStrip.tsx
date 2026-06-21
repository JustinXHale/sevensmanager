import { useEffect, useState } from 'react';
import type {
  FreeKickAgainst,
  PenaltyDirection,
  PlayPhaseContext,
  RuckContest,
  SetPiecePenaltyContext,
} from '@/domain/matchEvent';
import type { TallySetPieceId } from '@/domain/tallyLayout';
import { DEFAULT_TALLY_SETPIECE_ORDER } from '@/domain/tallyLayout';
import {
  TallyPenaltyInfractionPicker,
  type TallyPenaltyInfractionPick,
} from './TallyPenaltyInfractionPicker';

export type TallySetPieceChoice = 'won' | 'lost' | 'free_kick';

export type TallySetPieceLogExtras = {
  ruckContest?: RuckContest;
  freeKickAgainst?: FreeKickAgainst;
};

const SET_PIECE_KINDS: { kind: SetPiecePenaltyContext; label: string; short: string }[] = [
  { kind: 'restart', label: 'Restart', short: 'RST' },
  { kind: 'ruck', label: 'Ruck', short: 'Ruck' },
  { kind: 'scrum', label: 'Scrum', short: 'Scr' },
  { kind: 'lineout', label: 'Lineout', short: 'LO' },
];

const OUTCOME_BUTTONS: {
  choice: TallySetPieceChoice | 'penalty_awarded' | 'penalty_conceded';
  label: string;
  title: string;
  className?: string;
}[] = [
  { choice: 'won', label: 'W', title: 'Won' },
  { choice: 'lost', label: 'L', title: 'Lost', className: 'tally-setpiece-circle--lost' },
  { choice: 'free_kick', label: 'FK', title: 'Free kick — who erred?', className: 'tally-setpiece-circle--fk' },
  {
    choice: 'penalty_awarded',
    label: 'P+',
    title: 'Penalty awarded — logs won + infraction',
    className: 'tally-setpiece-circle--pen-plus',
  },
  {
    choice: 'penalty_conceded',
    label: 'P−',
    title: 'Penalty conceded — logs lost + infraction',
    className: 'tally-setpiece-circle--pen-minus',
  },
];

const RUCK_CONTEST_BUTTONS: { contest: RuckContest; label: string; title: string }[] = [
  { contest: 'contested', label: 'Con', title: 'Contested' },
  { contest: 'uncontested', label: 'Unc', title: 'Uncontested' },
];

const FK_FAULT_BUTTONS: {
  against: FreeKickAgainst;
  label: string;
  title: string;
  className: string;
}[] = [
  {
    against: 'opponent',
    label: 'Them',
    title: 'Their error — free kick to us (e.g. restart not 10m)',
    className: 'tally-setpiece-circle--pen-plus',
  },
  {
    against: 'us',
    label: 'Us',
    title: 'Our error — free kick to them',
    className: 'tally-setpiece-circle--pen-minus',
  },
];

type PendingRuck = { choice: 'won' | 'lost'; phase: PlayPhaseContext };

type PendingFk = { kind: SetPiecePenaltyContext; phase: PlayPhaseContext };

type PendingPenalty = {
  kind: SetPiecePenaltyContext;
  direction: PenaltyDirection;
  phase: PlayPhaseContext;
};

type Props = {
  phase: PlayPhaseContext;
  setPieceOrder?: TallySetPieceId[];
  reorderMode?: boolean;
  onSetPieceReorder?: (fromIndex: number, toIndex: number) => void;
  onChoice: (
    kind: SetPiecePenaltyContext,
    choice: TallySetPieceChoice,
    phase: PlayPhaseContext,
    extras?: TallySetPieceLogExtras,
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

function circleClass(extra?: string, active?: boolean): string {
  return `tally-setpiece-circle${active ? ' tally-setpiece-circle--active' : ''}${extra ? ` ${extra}` : ''}`;
}

export function TallySetPieceStrip({
  phase,
  setPieceOrder = DEFAULT_TALLY_SETPIECE_ORDER,
  reorderMode = false,
  onSetPieceReorder,
  onChoice,
  onPenaltyChoice,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [selectedKind, setSelectedKind] = useState<SetPiecePenaltyContext | null>(null);
  const [pendingRuck, setPendingRuck] = useState<PendingRuck | null>(null);
  const [pendingFk, setPendingFk] = useState<PendingFk | null>(null);
  const [pendingPenalty, setPendingPenalty] = useState<PendingPenalty | null>(null);

  function resetFlow() {
    setSelectedKind(null);
    setPendingRuck(null);
    setPendingFk(null);
    setPendingPenalty(null);
  }

  useEffect(() => {
    resetFlow();
  }, [phase]);

  function selectKind(kind: SetPiecePenaltyContext) {
    if (selectedKind === kind && !pendingRuck && !pendingFk && !pendingPenalty) {
      setSelectedKind(null);
      return;
    }
    setSelectedKind(kind);
    setPendingRuck(null);
    setPendingFk(null);
    setPendingPenalty(null);
  }

  function backFromOutcome() {
    setSelectedKind(null);
    setPendingRuck(null);
    setPendingFk(null);
    setPendingPenalty(null);
  }

  function backFromRuckContest() {
    setPendingRuck(null);
  }

  function backFromFkFault() {
    setPendingFk(null);
  }

  function completeRuck(contest: RuckContest) {
    if (!pendingRuck) return;
    onChoice('ruck', pendingRuck.choice, pendingRuck.phase, { ruckContest: contest });
    resetFlow();
  }

  function completeFk(against: FreeKickAgainst) {
    if (!pendingFk) return;
    onChoice(pendingFk.kind, 'free_kick', pendingFk.phase, { freeKickAgainst: against });
    resetFlow();
  }

  const selectedLabel =
    selectedKind != null
      ? setPieceKindLabel(
          selectedKind,
          phase,
          SET_PIECE_KINDS.find((k) => k.kind === selectedKind)?.label ?? selectedKind,
        )
      : null;

  const fkContextLabel =
    pendingFk != null
      ? setPieceKindLabel(
          pendingFk.kind,
          pendingFk.phase,
          SET_PIECE_KINDS.find((k) => k.kind === pendingFk.kind)?.label ?? pendingFk.kind,
        )
      : null;

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
          resetFlow();
        }}
        onCancel={() => setPendingPenalty(null)}
      />
    ) : null;

  const orderedKinds = setPieceOrder
    .map((kind) => SET_PIECE_KINDS.find((k) => k.kind === kind))
    .filter((k): k is (typeof SET_PIECE_KINDS)[number] => k != null);

  return (
    <div className="tally-setpiece-wrap">
      <div className={`tally-setpiece-strip${reorderMode ? ' tally-setpiece-strip--reorder' : ''}`} aria-label={`Set pieces (${phase})`}>
        <div className="tally-setpiece-kind-row" role="group" aria-label="Set piece type">
          {orderedKinds.map(({ kind, label, short }, index) => {
            const displayShort = kind === 'restart' ? 'RST' : short;
            const active = !reorderMode && selectedKind === kind;
            let circleCls = circleClass(undefined, active);
            if (reorderMode) {
              circleCls += ' tally-counter-btn--drag';
              if (dragFrom === index) circleCls += ' tally-counter-btn--drag-source';
              if (dragOver === index && dragFrom !== index) circleCls += ' tally-counter-btn--drag-over';
            }
            return (
              <button
                key={kind}
                type="button"
                draggable={reorderMode}
                className={circleCls}
                title={reorderMode ? 'Drag to reorder' : setPieceKindLabel(kind, phase, label)}
                aria-label={setPieceKindLabel(kind, phase, label)}
                aria-pressed={active}
                disabled={reorderMode ? false : undefined}
                onClick={(e) => {
                  if (reorderMode) return;
                  tapThenBlur(e, () => selectKind(kind));
                }}
                onDragStart={(e) => {
                  if (!reorderMode) return;
                  setDragFrom(index);
                  setDragOver(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (!reorderMode) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOver !== index) setDragOver(index);
                }}
                onDragEnter={(e) => {
                  if (!reorderMode) return;
                  e.preventDefault();
                  setDragOver(index);
                }}
                onDrop={(e) => {
                  if (!reorderMode || dragFrom == null) return;
                  e.preventDefault();
                  if (dragFrom !== index) onSetPieceReorder?.(dragFrom, index);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
              >
                <span className="tally-setpiece-circle-text">{displayShort}</span>
              </button>
            );
          })}
        </div>

        {selectedKind != null && pendingPenalty == null && pendingRuck == null && pendingFk == null ? (
          <div className="tally-setpiece-layer">
            <div className="tally-setpiece-layer-head">
              <p className="tally-setpiece-layer-title">{selectedLabel}</p>
              <button
                type="button"
                className="tally-setpiece-layer-back"
                onClick={(e) => tapThenBlur(e, backFromOutcome)}
              >
                Back
              </button>
            </div>
            <div className="tally-setpiece-outcome-row" role="group" aria-label={`${selectedLabel} outcome`}>
              {OUTCOME_BUTTONS.map(({ choice, label: btnLabel, title, className }) => (
                <button
                  key={choice}
                  type="button"
                  className={circleClass(className)}
                  title={title}
                  aria-label={`${selectedLabel} · ${title}`}
                  onClick={(e) =>
                    tapThenBlur(e, () => {
                      if (!selectedKind) return;
                      if (isPenaltyChoice(choice)) {
                        setPendingRuck(null);
                        setPendingFk(null);
                        setPendingPenalty({
                          kind: selectedKind,
                          direction: choice === 'penalty_awarded' ? 'awarded' : 'conceded',
                          phase,
                        });
                        return;
                      }
                      if (choice === 'free_kick') {
                        setPendingRuck(null);
                        setPendingPenalty(null);
                        setPendingFk({ kind: selectedKind, phase });
                        return;
                      }
                      if (selectedKind === 'ruck' && (choice === 'won' || choice === 'lost')) {
                        setPendingPenalty(null);
                        setPendingFk(null);
                        setPendingRuck({ choice, phase });
                        return;
                      }
                      onChoice(selectedKind, choice, phase);
                      resetFlow();
                    })
                  }
                >
                  <span className="tally-setpiece-circle-text">{btnLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {pendingFk != null ? (
          <div className="tally-setpiece-layer">
            <div className="tally-setpiece-layer-head">
              <p className="tally-setpiece-layer-title">{fkContextLabel} · Free kick — who erred?</p>
              <button
                type="button"
                className="tally-setpiece-layer-back"
                onClick={(e) => tapThenBlur(e, backFromFkFault)}
              >
                Back
              </button>
            </div>
            {pendingFk.kind === 'restart' && pendingFk.phase === 'attack' ? (
              <p className="muted tally-setpiece-layer-hint">
                Receiving kick — <strong>Them</strong> is common (e.g. kick did not reach 10m).
              </p>
            ) : null}
            <div
              className="tally-setpiece-outcome-row tally-setpiece-outcome-row--fk"
              role="group"
              aria-label="Free kick fault"
            >
              {FK_FAULT_BUTTONS.map(({ against, label: btnLabel, title, className }) => (
                <button
                  key={against}
                  type="button"
                  className={circleClass(className)}
                  title={title}
                  aria-label={`${fkContextLabel} · ${title}`}
                  onClick={(e) => tapThenBlur(e, () => completeFk(against))}
                >
                  <span className="tally-setpiece-circle-text">{btnLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {pendingRuck != null ? (
          <div className="tally-setpiece-layer">
            <div className="tally-setpiece-layer-head">
              <p className="tally-setpiece-layer-title">
                Ruck · {pendingRuck.choice === 'won' ? 'Won' : 'Lost'} — contested?
              </p>
              <button
                type="button"
                className="tally-setpiece-layer-back"
                onClick={(e) => tapThenBlur(e, backFromRuckContest)}
              >
                Back
              </button>
            </div>
            <div
              className="tally-setpiece-outcome-row tally-setpiece-outcome-row--ruck"
              role="group"
              aria-label="Ruck contested or uncontested"
            >
              {RUCK_CONTEST_BUTTONS.map(({ contest, label: btnLabel, title }) => (
                <button
                  key={contest}
                  type="button"
                  className={circleClass('tally-setpiece-circle--ruck-contest')}
                  title={title}
                  aria-label={`Ruck · ${pendingRuck.choice === 'won' ? 'Won' : 'Lost'} · ${title}`}
                  onClick={(e) => tapThenBlur(e, () => completeRuck(contest))}
                >
                  <span className="tally-setpiece-circle-text">{btnLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {penaltyPicker}
    </div>
  );
}
