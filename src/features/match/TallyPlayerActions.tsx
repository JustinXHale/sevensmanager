import { useMemo, useState } from 'react';
import {
  type ConversionOutcome,
  type FieldLengthBandId,
  type MatchEventKind,
  type PenaltyDirection,
  type PlayPhaseContext,
  type TackleOutcome,
  type ZoneFlowerPick,
} from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import { ZoneFlowerActionButton, type ZoneFlowerActionKind } from './ZoneFlowerActionButton';
import { TallySetPieceStrip, type TallySetPieceChoice } from './TallySetPieceStrip';

export type TallyActionKind = 'pass' | 'offload' | 'line_break' | 'try' | 'negative_action';

type TallyCounts = {
  pass: number;
  offload: number;
  line_break: number;
  try: number;
  negative_action: number;
  tackle_made: number;
  tackle_missed: number;
  penalty_conceded: number;
  penalty_awarded: number;
};

type Props = {
  counts: TallyCounts;
  owesConversion: boolean;
  owesOpponentConversion: boolean;
  pendingOpponentConversionKick: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null;
  onTallyAction: (kind: TallyActionKind) => void;
  onTallyTackle: (outcome: TackleOutcome) => void;
  onTallyConversion: (outcome: ConversionOutcome) => void;
  onTallySetPieceChoice: (kind: MatchEventKind, choice: TallySetPieceChoice, phase: PlayPhaseContext) => void;
  onTallyPenalty: (direction: PenaltyDirection, phase: PlayPhaseContext) => void;
  onOpponentScoring: (kind: 'opponent_try' | 'opponent_conversion', pick?: ZoneFlowerPick) => void;
  opponentStatBoard: {
    themLabel: string;
    usLabel: string;
    them: { subs: number; yc: number; rc: number };
    us: { subs: number; yc: number; rc: number };
    oppTries: number;
    oppConvs: number;
  };
  onOpponentStatAdjust: (row: 'subs' | 'yc' | 'rc', delta: 1 | -1) => void;
};

type PhaseMode = 'attack' | 'defense' | 'opponent';

function tapThenBlur(ev: React.MouseEvent<HTMLButtonElement>, run: () => void) {
  run();
  requestAnimationFrame(() => ev.currentTarget.blur());
}

const OPPONENT_UI_PLAYER_ID = '_opponent_';

const ATTACK_BUTTONS: { kind: TallyActionKind; label: string; countKey: keyof TallyCounts }[] = [
  { kind: 'pass', label: 'Pass', countKey: 'pass' },
  { kind: 'offload', label: 'Offload', countKey: 'offload' },
  { kind: 'line_break', label: 'Line Brk', countKey: 'line_break' },
  { kind: 'try', label: 'Try', countKey: 'try' },
  { kind: 'negative_action', label: 'Neg', countKey: 'negative_action' },
];

const DEFENSE_BUTTONS: { outcome: TackleOutcome; label: string; countKey: keyof TallyCounts }[] = [
  { outcome: 'made', label: 'Tackle M', countKey: 'tackle_made' },
  { outcome: 'missed', label: 'Tackle X', countKey: 'tackle_missed' },
];

export function TallyPlayerActions({
  counts,
  owesConversion,
  owesOpponentConversion,
  pendingOpponentConversionKick,
  onTallyAction,
  onTallyTackle,
  onTallyConversion,
  onTallySetPieceChoice,
  onTallyPenalty,
  onOpponentScoring,
  opponentStatBoard,
  onOpponentStatAdjust,
}: Props) {
  const [mode, setMode] = useState<PhaseMode>('attack');

  const opponentActions = useMemo(() => {
    return [
      owesOpponentConversion
        ? { kind: 'opponent_conversion' as ZoneFlowerActionKind, abbr: 'C', title: 'Opp conversion' }
        : { kind: 'opponent_try' as ZoneFlowerActionKind, abbr: 'Tr', title: 'Opp try' },
    ];
  }, [owesOpponentConversion]);

  const phaseContext: PlayPhaseContext = mode === 'defense' ? 'defense' : 'attack';

  return (
    <div className="on-field-actions-wrap">
      <div className="live-phase-switch" role="group" aria-label="Tally: attack, defense, or opponent">
        <button type="button" className={`live-phase-btn${mode === 'attack' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'attack'} onClick={(e) => tapThenBlur(e, () => setMode('attack'))}>Attack</button>
        <button type="button" className={`live-phase-btn${mode === 'defense' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'defense'} onClick={(e) => tapThenBlur(e, () => setMode('defense'))}>Defense</button>
        <button type="button" className={`live-phase-btn${mode === 'opponent' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'opponent'} onClick={(e) => tapThenBlur(e, () => setMode('opponent'))}>Opp</button>
      </div>

      {mode !== 'opponent' ? (
        <TallySetPieceStrip phase={phaseContext} onChoice={onTallySetPieceChoice} />
      ) : null}

      {mode === 'opponent' ? (
        <div className="live-opponent-panel" aria-label="Opponent scoring and stats">
          <div className="live-opp-score-stat muted" aria-label="Opponent tries and conversions logged">
            <span>Tr {opponentStatBoard.oppTries}</span>
            <span aria-hidden="true"> &middot; </span>
            <span>C {opponentStatBoard.oppConvs}</span>
          </div>
          <div className="live-opponent-chips" role="group" aria-label="Opponent try and conversion">
            {opponentActions.map(({ kind, abbr, title }) => (
              <ZoneFlowerActionButton
                key={`${kind}-${owesOpponentConversion ? 'c' : 't'}`}
                kind={kind}
                abbr={abbr}
                title={title}
                playerId={OPPONENT_UI_PLAYER_ID}
                playerLabelForAria="Opponent"
                disabled={false}
                conversionKick={kind === 'opponent_conversion' ? pendingOpponentConversionKick : undefined}
                onAction={(k, _pid, pick) => {
                  if (k === 'opponent_try' || k === 'opponent_conversion') onOpponentScoring(k, pick);
                }}
              />
            ))}
          </div>
          <div className="live-opp-stat-board" aria-label="Substitutions and cards by team">
            <div className="live-opp-stat-stack">
              <section className="live-opp-stat-card" aria-labelledby="tally-opp-stat-subs">
                <h3 id="tally-opp-stat-subs" className="live-opp-stat-card-title">Subs</h3>
                <div className="live-opp-stat-line">
                  <span className="live-opp-stat-team" title={opponentStatBoard.themLabel}>{opponentStatBoard.themLabel}</span>
                  <span className="live-opp-stat-delta-group">
                    <button type="button" className="live-opp-stat-delta" aria-label="Remove last opponent substitution" disabled={opponentStatBoard.them.subs === 0} onClick={(e) => tapThenBlur(e, () => onOpponentStatAdjust('subs', -1))}>−</button>
                    <span className="live-opp-stat-num">{opponentStatBoard.them.subs}</span>
                    <button type="button" className="live-opp-stat-delta" aria-label="Log opponent substitution" onClick={(e) => tapThenBlur(e, () => onOpponentStatAdjust('subs', 1))}>+</button>
                  </span>
                </div>
                <div className="live-opp-stat-line live-opp-stat-line--us">
                  <span className="live-opp-stat-team" title={opponentStatBoard.usLabel}>{opponentStatBoard.usLabel}</span>
                  <span className="live-opp-stat-num live-opp-stat-num--solo">{opponentStatBoard.us.subs}</span>
                </div>
              </section>
              <section className="live-opp-stat-card" aria-labelledby="tally-opp-stat-yc">
                <h3 id="tally-opp-stat-yc" className="live-opp-stat-card-title">YC</h3>
                <div className="live-opp-stat-line">
                  <span className="live-opp-stat-team" title={opponentStatBoard.themLabel}>{opponentStatBoard.themLabel}</span>
                  <span className="live-opp-stat-delta-group">
                    <button type="button" className="live-opp-stat-delta live-opp-stat-delta--yc" aria-label="Remove last opponent yellow card" disabled={opponentStatBoard.them.yc === 0} onClick={(e) => tapThenBlur(e, () => onOpponentStatAdjust('yc', -1))}>−</button>
                    <span className="live-opp-stat-num">{opponentStatBoard.them.yc}</span>
                    <button type="button" className="live-opp-stat-delta live-opp-stat-delta--yc" aria-label="Log opponent yellow card" onClick={(e) => tapThenBlur(e, () => onOpponentStatAdjust('yc', 1))}>+</button>
                  </span>
                </div>
                <div className="live-opp-stat-line live-opp-stat-line--us">
                  <span className="live-opp-stat-team" title={opponentStatBoard.usLabel}>{opponentStatBoard.usLabel}</span>
                  <span className="live-opp-stat-num live-opp-stat-num--solo">{opponentStatBoard.us.yc}</span>
                </div>
              </section>
              <section className="live-opp-stat-card" aria-labelledby="tally-opp-stat-rc">
                <h3 id="tally-opp-stat-rc" className="live-opp-stat-card-title">RC</h3>
                <div className="live-opp-stat-line">
                  <span className="live-opp-stat-team" title={opponentStatBoard.themLabel}>{opponentStatBoard.themLabel}</span>
                  <span className="live-opp-stat-delta-group">
                    <button type="button" className="live-opp-stat-delta live-opp-stat-delta--rc" aria-label="Remove last opponent red card" disabled={opponentStatBoard.them.rc === 0} onClick={(e) => tapThenBlur(e, () => onOpponentStatAdjust('rc', -1))}>−</button>
                    <span className="live-opp-stat-num">{opponentStatBoard.them.rc}</span>
                    <button type="button" className="live-opp-stat-delta live-opp-stat-delta--rc" aria-label="Log opponent red card" onClick={(e) => tapThenBlur(e, () => onOpponentStatAdjust('rc', 1))}>+</button>
                  </span>
                </div>
                <div className="live-opp-stat-line live-opp-stat-line--us">
                  <span className="live-opp-stat-team" title={opponentStatBoard.usLabel}>{opponentStatBoard.usLabel}</span>
                  <span className="live-opp-stat-num live-opp-stat-num--solo">{opponentStatBoard.us.rc}</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <>
          {owesConversion ? (
            <div className="tally-conversion-prompt" role="group" aria-label="Conversion attempt">
              <span className="tally-conversion-label">Conversion</span>
              <button type="button" className="tally-counter-btn tally-counter-btn--made" onClick={(e) => tapThenBlur(e, () => onTallyConversion('made'))}>Made</button>
              <button type="button" className="tally-counter-btn tally-counter-btn--missed" onClick={(e) => tapThenBlur(e, () => onTallyConversion('missed'))}>Missed</button>
            </div>
          ) : null}

          <div className="tally-grid">
            {mode === 'attack' ? (
              <>
                {ATTACK_BUTTONS.map((b) => (
                  <button key={b.kind} type="button" className="tally-counter-btn" onClick={(e) => tapThenBlur(e, () => onTallyAction(b.kind))}>
                    <span className="tally-counter-label">{b.label}</span>
                    <span className="tally-counter-badge">{counts[b.countKey]}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {DEFENSE_BUTTONS.map((b) => (
                  <button key={b.outcome} type="button" className={`tally-counter-btn${b.outcome === 'missed' ? ' tally-counter-btn--miss' : ''}`} onClick={(e) => tapThenBlur(e, () => onTallyTackle(b.outcome))}>
                    <span className="tally-counter-label">{b.label}</span>
                    <span className="tally-counter-badge">{counts[b.countKey]}</span>
                  </button>
                ))}
              </>
            )}
            <button
              type="button"
              className="tally-counter-btn tally-counter-btn--penalty tally-counter-btn--pen-minus"
              onClick={(e) => tapThenBlur(e, () => onTallyPenalty('conceded', phaseContext))}
            >
              <span className="tally-counter-label">Pen −</span>
              <span className="tally-counter-badge">{counts.penalty_conceded}</span>
            </button>
            <button
              type="button"
              className="tally-counter-btn tally-counter-btn--penalty tally-counter-btn--pen-plus"
              onClick={(e) => tapThenBlur(e, () => onTallyPenalty('awarded', phaseContext))}
            >
              <span className="tally-counter-label">Pen +</span>
              <span className="tally-counter-badge">{counts.penalty_awarded}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
