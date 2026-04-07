import { useMemo, useState } from 'react';
import {
  PENALTY_TYPES,
  type ConversionOutcome,
  type FieldLengthBandId,
  type MatchEventKind,
  type PenaltyCard,
  type PenaltyTypeId,
  type PlayPhaseContext,
  type SetPieceOutcome,
  type TackleOutcome,
  type TeamPenaltyPayload,
  type ZoneFlowerPick,
} from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import { ZoneFlowerActionButton, type ZoneFlowerActionKind } from './ZoneFlowerActionButton';

export type TallyActionKind = 'pass' | 'offload' | 'line_break' | 'try' | 'negative_action';

type TallyCounts = {
  pass: number;
  offload: number;
  line_break: number;
  try: number;
  negative_action: number;
  tackle_made: number;
  tackle_missed: number;
  penalty: number;
};

type Props = {
  counts: TallyCounts;
  owesConversion: boolean;
  owesOpponentConversion: boolean;
  pendingOpponentConversionKick: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null;
  onTallyAction: (kind: TallyActionKind) => void;
  onTallyTackle: (outcome: TackleOutcome) => void;
  onTallyConversion: (outcome: ConversionOutcome) => void;
  onTallySetPiece: (kind: MatchEventKind, outcome: SetPieceOutcome, phase: PlayPhaseContext) => void;
  onTallyPenalty: (payload: TeamPenaltyPayload) => void;
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

const STANDARD_PENALTY_TYPES = PENALTY_TYPES.filter((pt) => pt.id !== 'other');

function LivePenaltySubpanel({ onSubmit }: { onSubmit: (p: TeamPenaltyPayload) => void }) {
  const [card, setCard] = useState<PenaltyCard | null>(null);
  const [otherText, setOtherText] = useState('');
  const [otherError, setOtherError] = useState<string | null>(null);

  function logStandard(penaltyType: PenaltyTypeId) {
    onSubmit({ penaltyType, card: card ?? undefined });
  }

  function logOther() {
    const detail = otherText.trim();
    if (!detail) { setOtherError('Enter a description first.'); return; }
    setOtherError(null);
    onSubmit({ penaltyType: 'other', card: card ?? undefined, penaltyDetail: detail });
    setOtherText('');
  }

  return (
    <div className="live-penalty-pick">
      <div className="live-penalty-cards" role="group" aria-label="Discipline card (optional)">
        <button type="button" className={`live-penalty-card live-penalty-card-yc${card === 'yellow' ? ' live-penalty-card-pressed' : ''}`} aria-pressed={card === 'yellow'} title="Yellow card" onClick={(e) => { e.stopPropagation(); setCard((c) => (c === 'yellow' ? null : 'yellow')); }}>Yellow card</button>
        <button type="button" className={`live-penalty-card live-penalty-card-rc${card === 'red' ? ' live-penalty-card-pressed' : ''}`} aria-pressed={card === 'red'} title="Red card" onClick={(e) => { e.stopPropagation(); setCard((c) => (c === 'red' ? null : 'red')); }}>Red card</button>
      </div>
      <p className="muted live-penalty-pick-hint">Choose an infraction (required).</p>
      <div className="live-penalty-type-grid">
        {STANDARD_PENALTY_TYPES.map((pt) => (
          <button key={pt.id} type="button" className="live-penalty-type-btn" onClick={(e) => { e.stopPropagation(); logStandard(pt.id); requestAnimationFrame(() => e.currentTarget.blur()); }}>{pt.label}</button>
        ))}
      </div>
      <div className="live-penalty-other">
        <span className="live-penalty-other-heading">Other</span>
        <input type="text" className="live-penalty-other-input" value={otherText} onChange={(e) => { setOtherText(e.target.value); setOtherError(null); }} placeholder="Type the infraction…" autoComplete="off" aria-label="Penalty detail" onClick={(e) => e.stopPropagation()} />
        {otherError ? <p className="error-text live-penalty-other-error" role="alert">{otherError}</p> : null}
        <button type="button" className="btn btn-secondary live-penalty-other-log" onClick={(e) => { e.stopPropagation(); logOther(); }}>Log other</button>
      </div>
    </div>
  );
}

const OPPONENT_UI_PLAYER_ID = '_opponent_';

const SET_PIECE_KINDS: { kind: MatchEventKind; label: string }[] = [
  { kind: 'lineout', label: 'Lineout' },
  { kind: 'restart', label: 'Restart' },
  { kind: 'ruck', label: 'Ruck' },
  { kind: 'scrum', label: 'Scrum' },
];

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
  onTallySetPiece,
  onTallyPenalty,
  onOpponentScoring,
  opponentStatBoard,
  onOpponentStatAdjust,
}: Props) {
  const [mode, setMode] = useState<PhaseMode>('attack');
  const [penaltyOpen, setPenaltyOpen] = useState(false);

  const opponentActions = useMemo(() => {
    return [
      owesOpponentConversion
        ? { kind: 'opponent_conversion' as ZoneFlowerActionKind, abbr: 'C', title: 'Opp conversion' }
        : { kind: 'opponent_try' as ZoneFlowerActionKind, abbr: 'Tr', title: 'Opp try' },
    ];
  }, [owesOpponentConversion]);

  return (
    <div className="on-field-actions-wrap">
      <div className="live-phase-switch" role="group" aria-label="Tally: attack, defense, or opponent">
        <button type="button" className={`live-phase-btn${mode === 'attack' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'attack'} onClick={(e) => tapThenBlur(e, () => { setMode('attack'); setPenaltyOpen(false); })}>Attack</button>
        <button type="button" className={`live-phase-btn${mode === 'defense' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'defense'} onClick={(e) => tapThenBlur(e, () => { setMode('defense'); setPenaltyOpen(false); })}>Defense</button>
        <button type="button" className={`live-phase-btn${mode === 'opponent' ? ' live-phase-btn-active' : ''}`} aria-pressed={mode === 'opponent'} onClick={(e) => tapThenBlur(e, () => { setMode('opponent'); setPenaltyOpen(false); })}>Opp</button>
      </div>

      {mode !== 'opponent' ? (
        <div className="simple-setpiece-strip" aria-label="Set pieces (tally)">
          {SET_PIECE_KINDS.map(({ kind, label }) => (
            <div key={kind} className="simple-setpiece-group">
              <span className="simple-setpiece-label">{label}</span>
              <div className="simple-setpiece-btns">
                <button type="button" className="simple-setpiece-btn simple-setpiece-btn--won" onClick={(e) => tapThenBlur(e, () => onTallySetPiece(kind, 'won', mode))}>W</button>
                <button type="button" className="simple-setpiece-btn simple-setpiece-btn--lost" onClick={(e) => tapThenBlur(e, () => onTallySetPiece(kind, 'lost', mode))}>L</button>
              </div>
            </div>
          ))}
        </div>
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
              className={`tally-counter-btn tally-counter-btn--penalty${penaltyOpen ? ' tally-counter-btn--active' : ''}`}
              aria-expanded={penaltyOpen}
              onClick={(e) => tapThenBlur(e, () => setPenaltyOpen((o) => !o))}
            >
              <span className="tally-counter-label">Penalty</span>
              <span className="tally-counter-badge">{counts.penalty}</span>
            </button>
          </div>

          {penaltyOpen ? (
            <LivePenaltySubpanel
              onSubmit={(payload) => {
                onTallyPenalty(payload);
                setPenaltyOpen(false);
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
