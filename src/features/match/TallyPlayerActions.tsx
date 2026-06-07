import { useState } from 'react';
import {
  type ConversionOutcome,
  type MatchEventKind,
  type PenaltyDirection,
  type PlayPhaseContext,
  type TackleOutcome,
} from '@/domain/matchEvent';
import type { PlayerRecord } from '@/domain/player';
import { TallyRosterPick } from './TallyRosterPick';
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
  try_conceded: number;
};

type ScorerPick =
  | { type: 'try' }
  | { type: 'conversion'; outcome: ConversionOutcome };

type Props = {
  onFieldPlayers: PlayerRecord[];
  counts: TallyCounts;
  owesConversion: boolean;
  owesOpponentConversion: boolean;
  onTallyAction: (kind: TallyActionKind) => void;
  onTallyTry: (playerId: string) => void;
  onTallyTackle: (outcome: TackleOutcome) => void;
  onTallyConversion: (outcome: ConversionOutcome, playerId: string) => void;
  onTallySetPieceChoice: (kind: MatchEventKind, choice: TallySetPieceChoice, phase: PlayPhaseContext) => void;
  onTallyPenalty: (direction: PenaltyDirection, phase: PlayPhaseContext) => void;
  onTallyTryConceded: () => void;
  onTallyOpponentConversion: (outcome: ConversionOutcome) => void;
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
  onFieldPlayers,
  counts,
  owesConversion,
  owesOpponentConversion,
  onTallyAction,
  onTallyTry,
  onTallyTackle,
  onTallyConversion,
  onTallySetPieceChoice,
  onTallyPenalty,
  onTallyTryConceded,
  onTallyOpponentConversion,
  opponentStatBoard,
  onOpponentStatAdjust,
}: Props) {
  const [mode, setMode] = useState<PhaseMode>('attack');
  const [scorerPick, setScorerPick] = useState<ScorerPick | null>(null);

  const phaseContext: PlayPhaseContext = mode === 'defense' ? 'defense' : 'attack';

  function switchMode(next: PhaseMode) {
    setMode(next);
    setScorerPick(null);
  }

  function onPlayerPicked(playerId: string) {
    if (!scorerPick) return;
    if (scorerPick.type === 'try') {
      onTallyTry(playerId);
    } else {
      onTallyConversion(scorerPick.outcome, playerId);
    }
    setScorerPick(null);
  }

  return (
    <div className="on-field-actions-wrap">
      <div className="live-phase-switch" role="group" aria-label="Tally: attack, defense, or opponent">
        <button type="button" className={`live-phase-btn${mode === 'attack' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'attack'} onClick={(e) => tapThenBlur(e, () => switchMode('attack'))}>Attack</button>
        <button type="button" className={`live-phase-btn${mode === 'defense' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'defense'} onClick={(e) => tapThenBlur(e, () => switchMode('defense'))}>Defense</button>
        <button type="button" className={`live-phase-btn${mode === 'opponent' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'opponent'} onClick={(e) => tapThenBlur(e, () => switchMode('opponent'))}>Opp</button>
      </div>

      {mode !== 'opponent' ? (
        <TallySetPieceStrip phase={phaseContext} onChoice={onTallySetPieceChoice} />
      ) : null}

      {mode === 'opponent' ? (
        <div className="live-opponent-panel" aria-label="Opponent substitutions and cards">
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
          {mode === 'attack' && owesConversion ? (
            <div className="tally-conversion-prompt" role="group" aria-label="Conversion attempt">
              <span className="tally-conversion-label">Conversion</span>
              <button
                type="button"
                className={`tally-counter-btn tally-counter-btn--made${scorerPick?.type === 'conversion' && scorerPick.outcome === 'made' ? ' tally-counter-btn--active' : ''}`}
                onClick={(e) => tapThenBlur(e, () => setScorerPick({ type: 'conversion', outcome: 'made' }))}
              >
                Made
              </button>
              <button
                type="button"
                className={`tally-counter-btn tally-counter-btn--missed${scorerPick?.type === 'conversion' && scorerPick.outcome === 'missed' ? ' tally-counter-btn--active' : ''}`}
                onClick={(e) => tapThenBlur(e, () => setScorerPick({ type: 'conversion', outcome: 'missed' }))}
              >
                Missed
              </button>
            </div>
          ) : null}

          {scorerPick ? (
            <TallyRosterPick
              heading={scorerPick.type === 'try' ? 'Who scored?' : 'Who kicked?'}
              players={onFieldPlayers}
              onSelect={onPlayerPicked}
              onCancel={() => setScorerPick(null)}
            />
          ) : null}

          {mode === 'defense' && owesOpponentConversion ? (
            <div className="tally-conversion-prompt" role="group" aria-label="Opponent conversion attempt">
              <span className="tally-conversion-label">Opp conversion</span>
              <button type="button" className="tally-counter-btn tally-counter-btn--made" onClick={(e) => tapThenBlur(e, () => onTallyOpponentConversion('made'))}>Made</button>
              <button type="button" className="tally-counter-btn tally-counter-btn--missed" onClick={(e) => tapThenBlur(e, () => onTallyOpponentConversion('missed'))}>Missed</button>
            </div>
          ) : null}

          <div className="tally-grid">
            {mode === 'attack' ? (
              <>
                {ATTACK_BUTTONS.map((b) => (
                  <button
                    key={b.kind}
                    type="button"
                    className={`tally-counter-btn${b.kind === 'try' && scorerPick?.type === 'try' ? ' tally-counter-btn--active' : ''}`}
                    disabled={b.kind === 'try' && owesConversion}
                    onClick={(e) =>
                      tapThenBlur(e, () => {
                        if (b.kind === 'try') {
                          setScorerPick({ type: 'try' });
                          return;
                        }
                        setScorerPick(null);
                        onTallyAction(b.kind);
                      })
                    }
                  >
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
                {!owesOpponentConversion ? (
                  <button
                    type="button"
                    className="tally-counter-btn tally-counter-btn--try-conceded"
                    onClick={(e) => tapThenBlur(e, () => onTallyTryConceded())}
                  >
                    <span className="tally-counter-label">Try −</span>
                    <span className="tally-counter-badge">{counts.try_conceded}</span>
                  </button>
                ) : null}
              </>
            )}
            <button
              type="button"
              className="tally-counter-btn tally-counter-btn--pen-minus"
              onClick={(e) => tapThenBlur(e, () => onTallyPenalty('conceded', phaseContext))}
            >
              <span className="tally-counter-label">Pen −</span>
              <span className="tally-counter-badge">{counts.penalty_conceded}</span>
            </button>
            <button
              type="button"
              className="tally-counter-btn tally-counter-btn--pen-plus"
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
