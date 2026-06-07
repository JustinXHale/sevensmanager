import { useState } from 'react';
import {
  penaltyDirectionLabel,
  penaltyTypesForPicker,
  penaltyTypesForSetPiecePicker,
  type PenaltyCard,
  type PenaltyDirection,
  type PenaltyTypeId,
  type PlayPhaseContext,
  type SetPiecePenaltyContext,
  type TeamPenaltyPayload,
} from '@/domain/matchEvent';

export type TallyPenaltyInfractionPick = Pick<
  TeamPenaltyPayload,
  'penaltyType' | 'penaltyDetail' | 'penaltyCard'
>;

type Props = {
  phase: PlayPhaseContext;
  direction: PenaltyDirection;
  /** When set, uses restart/ruck/scrum/lineout infraction lists instead of open-play lists. */
  setPieceKind?: SetPiecePenaltyContext;
  contextLabel?: string;
  onSubmit: (payload: TallyPenaltyInfractionPick) => void;
  onCancel: () => void;
};

export function TallyPenaltyInfractionPicker({
  phase,
  direction,
  setPieceKind,
  contextLabel,
  onSubmit,
  onCancel,
}: Props) {
  const infractionTypes = setPieceKind
    ? penaltyTypesForSetPiecePicker(setPieceKind, phase, direction)
    : penaltyTypesForPicker(phase, direction);
  const showOther = setPieceKind == null;

  const [card, setCard] = useState<PenaltyCard | null>(null);
  const [otherText, setOtherText] = useState('');
  const [otherError, setOtherError] = useState<string | null>(null);

  function submit(penaltyType: PenaltyTypeId, penaltyDetail?: string) {
    onSubmit({
      penaltyType,
      penaltyDetail,
      penaltyCard: card ?? undefined,
    });
  }

  function logStandard(penaltyType: PenaltyTypeId) {
    submit(penaltyType);
  }

  function logOther() {
    const detail = otherText.trim();
    if (!detail) {
      setOtherError('Enter a description first.');
      return;
    }
    setOtherError(null);
    submit('other', detail);
    setOtherText('');
  }

  return (
    <div className="tally-penalty-pick" onClick={(e) => e.stopPropagation()}>
      <div className="tally-penalty-pick-head">
        <p className="tally-penalty-pick-title">
          {penaltyDirectionLabel(direction)}
          {contextLabel ? ` · ${contextLabel}` : ''}
        </p>
        <button type="button" className="btn btn-ghost btn-small tally-penalty-pick-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="live-penalty-cards" role="group" aria-label="Discipline card (optional)">
        <button
          type="button"
          className={`live-penalty-card live-penalty-card-yc${card === 'yellow' ? ' live-penalty-card-pressed' : ''}`}
          aria-pressed={card === 'yellow'}
          title="Yellow card"
          onClick={(e) => {
            e.stopPropagation();
            setCard((c) => (c === 'yellow' ? null : 'yellow'));
          }}
        >
          Yellow card
        </button>
        <button
          type="button"
          className={`live-penalty-card live-penalty-card-rc${card === 'red' ? ' live-penalty-card-pressed' : ''}`}
          aria-pressed={card === 'red'}
          title="Red card"
          onClick={(e) => {
            e.stopPropagation();
            setCard((c) => (c === 'red' ? null : 'red'));
          }}
        >
          Red card
        </button>
      </div>
      <p className="muted tally-penalty-pick-hint">Choose infraction</p>
      <div className="live-penalty-type-grid">
        {infractionTypes.map((pt) => (
          <button
            key={pt.id}
            type="button"
            className="live-penalty-type-btn"
            onClick={(e) => {
              e.stopPropagation();
              logStandard(pt.id);
            }}
          >
            {pt.label}
          </button>
        ))}
      </div>
      {showOther ? (
        <div className="live-penalty-other">
          <span className="live-penalty-other-heading">Other</span>
          <input
            type="text"
            className="live-penalty-other-input"
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              setOtherError(null);
            }}
            placeholder="Type the infraction…"
            autoComplete="off"
            aria-label="Penalty detail"
            onClick={(e) => e.stopPropagation()}
          />
          {otherError ? (
            <p className="error-text live-penalty-other-error" role="alert">
              {otherError}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary live-penalty-other-log"
            onClick={(e) => {
              e.stopPropagation();
              logOther();
            }}
          >
            Log other
          </button>
        </div>
      ) : null}
    </div>
  );
}
