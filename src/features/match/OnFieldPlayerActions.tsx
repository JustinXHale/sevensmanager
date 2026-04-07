import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PENALTY_TYPES,
  type FieldLengthBandId,
  type PenaltyCard,
  type PenaltyTypeId,
  type PlayPhaseContext,
  type SetPieceOutcome,
  type TackleOutcome,
  type TeamPenaltyPayload,
  type ZoneFlowerPick,
} from '@/domain/matchEvent';
import { emptyDisciplineBadges, type PlayerDisciplineBadges } from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import type { PlayerRecord } from '@/domain/player';
import { formatPlayerMinutesLabel } from '@/domain/playerMinutes';
import { formatPlayerLabel, formatPlayerNameOnly, sortPlayersRefLogStyle } from '@/domain/rosterDisplay';
import { SetPieceFlowerButton } from './SetPieceFlowerButton';
import { ZoneFlowerActionButton, type ZoneFlowerActionKind } from './ZoneFlowerActionButton';

type AttackActionSpec = { kind: ZoneFlowerActionKind; abbr: string; title: string; roundClassName?: string };

export type PlayerActionMode = 'attack' | 'defense' | 'opponent';

function PlayerDisciplineSuffix({ badges }: { badges: PlayerDisciplineBadges }) {
  if (!badges.yellow && !badges.red) return null;
  const aria =
    badges.yellow && badges.red
      ? 'Yellow and red card'
      : badges.red
        ? 'Red card'
        : 'Yellow card';
  return (
    <span className="on-field-discipline" aria-label={aria}>
      <span aria-hidden="true">
        {badges.yellow ? <span className="on-field-discipline-yc">YC</span> : null}
        {badges.yellow && badges.red ? <span className="on-field-discipline-sep"> · </span> : null}
        {badges.red ? <span className="on-field-discipline-rc">RC</span> : null}
      </span>
    </span>
  );
}

type Props = {
  players: PlayerRecord[];
  /** Bench + off (eligible to come on). */
  substituteOptions: PlayerRecord[];
  /** From logged team penalties with cards (YC/RC after names). */
  disciplineBadgesByPlayerId: Record<string, PlayerDisciplineBadges>;
  /** Match minutes while on field (match clock running). */
  getPlayerMinutesMs: (playerId: string) => number;
  /** After a try, Tr buttons become conversion until a conversion is logged (see `owesConversion`). */
  owesConversion: boolean;
  /** Zone/length for the next conversion (from paired try); conversion chip needs this to open the Made/Missed picker. */
  pendingConversionKick: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null;
  /** After an opponent try, Opp Tr becomes conversion until logged. */
  owesOpponentConversion: boolean;
  pendingOpponentConversionKick: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null;
  /** Attack row: pass / line break / try|conversion / negative — zone picker contract. */
  onAction: (kind: ZoneFlowerActionKind, playerId: string, pick?: ZoneFlowerPick) => void;
  /** Opponent tab: try / conversion (no player). */
  onOpponentScoring: (kind: 'opponent_try' | 'opponent_conversion', pick?: ZoneFlowerPick) => void;
  /** Them vs Us subs / YC / RC (+/− on Them adjusts match events). */
  opponentStatBoard: {
    themLabel: string;
    usLabel: string;
    them: { subs: number; yc: number; rc: number };
    us: { subs: number; yc: number; rc: number };
    oppTries: number;
    oppConvs: number;
  };
  onOpponentStatAdjust: (row: 'subs' | 'yc' | 'rc', delta: 1 | -1) => void;
  onTackle: (playerId: string, outcome: TackleOutcome, pick?: ZoneFlowerPick) => void;
  onSubstitute: (playerOffId: string, playerOnId: string) => void;
  onTeamPenalty: (playerId: string, payload: TeamPenaltyPayload) => void;
  /** Scrum / lineout / ruck: area (field band) + outcome + current Attack/Defense mode. */
  onSetPiece: (payload: {
    kind: 'scrum' | 'lineout' | 'ruck';
    outcome: SetPieceOutcome;
    phase: PlayPhaseContext;
    pick: { fieldLengthBand: FieldLengthBandId };
  }) => void;
};

/** Drop focus so the button does not stay “selected” after tap; safe for rapid repeat taps. */
function tapThenBlur(ev: React.MouseEvent<HTMLButtonElement>, run: () => void) {
  run();
  requestAnimationFrame(() => {
    ev.currentTarget.blur();
  });
}

const STANDARD_PENALTY_TYPES = PENALTY_TYPES.filter((pt) => pt.id !== 'other');

/** After selecting a yellow card, the card row locks until this countdown reaches zero. */
const YELLOW_CARD_COOLDOWN_SEC = 120;

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type PenaltySubpanelProps = {
  /** Seconds remaining on yellow sin bin (from parent; survives panel close). */
  yellowSecondsLeft: number;
  onYellowCardActivate: (active: boolean) => void;
  onSubmit: (p: TeamPenaltyPayload) => void;
};

/**
 * Card selectors (optional) + required infraction choice: standard chip logs immediately;
 * Other requires text + Log.
 */
function LivePenaltySubpanel({ yellowSecondsLeft, onYellowCardActivate, onSubmit }: PenaltySubpanelProps) {
  const [card, setCard] = useState<PenaltyCard | null>(null);
  const [otherText, setOtherText] = useState('');
  const [otherError, setOtherError] = useState<string | null>(null);

  const yellowRowLocked = card === 'yellow' && yellowSecondsLeft > 0;

  function logStandard(penaltyType: PenaltyTypeId) {
    onSubmit({
      penaltyType,
      card: card ?? undefined,
    });
  }

  function logOther() {
    const detail = otherText.trim();
    if (!detail) {
      setOtherError('Enter a description first.');
      return;
    }
    setOtherError(null);
    onSubmit({
      penaltyType: 'other',
      card: card ?? undefined,
      penaltyDetail: detail,
    });
    setOtherText('');
  }

  return (
    <div className="live-penalty-pick">
      <div
        className={`live-penalty-cards${yellowRowLocked ? ' live-penalty-cards-locked' : ''}`}
        role="group"
        aria-label="Discipline card (optional)"
      >
        <button
          type="button"
          className={`live-penalty-card live-penalty-card-yc${card === 'yellow' ? ' live-penalty-card-pressed' : ''}`}
          aria-pressed={card === 'yellow'}
          disabled={yellowRowLocked}
          title="Yellow card"
          onClick={(e) => {
            e.stopPropagation();
            if (yellowRowLocked) return;
            if (card === 'yellow') {
              setCard(null);
              onYellowCardActivate(false);
              return;
            }
            setCard('yellow');
            onYellowCardActivate(true);
          }}
        >
          Yellow card
        </button>
        <button
          type="button"
          className={`live-penalty-card live-penalty-card-rc${card === 'red' ? ' live-penalty-card-pressed' : ''}`}
          aria-pressed={card === 'red'}
          disabled={yellowRowLocked}
          title="Red card"
          onClick={(e) => {
            e.stopPropagation();
            if (yellowRowLocked) return;
            if (card === 'yellow') onYellowCardActivate(false);
            setCard((c) => (c === 'red' ? null : 'red'));
          }}
        >
          Red card
        </button>
      </div>
      {yellowRowLocked ? (
        <div className="live-penalty-yellow-bin" aria-live="polite">
          <span className="live-penalty-yellow-bin-label">Return to play</span>
          <span className="live-penalty-yellow-bin-time" title="Time remaining">
            {formatMmSs(yellowSecondsLeft)}
          </span>
        </div>
      ) : null}
      <p className="muted live-penalty-pick-hint">Choose an infraction (required).</p>
      <div className="live-penalty-type-grid">
        {STANDARD_PENALTY_TYPES.map((pt) => (
          <button
            key={pt.id}
            type="button"
            className="live-penalty-type-btn"
            onClick={(e) => {
              e.stopPropagation();
              logStandard(pt.id);
              requestAnimationFrame(() => e.currentTarget.blur());
            }}
          >
            {pt.label}
          </button>
        ))}
      </div>
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
    </div>
  );
}

const OPPONENT_UI_PLAYER_ID = '_opponent_';

/**
 * On-field rows with Attack / Defense / Opponent modes. Attack: P / LB / Tr|C / Neg + penalty. Defense: M / X + penalty. Opponent: opponent try/conversion.
 */
export function OnFieldPlayerActions({
  players,
  substituteOptions,
  disciplineBadgesByPlayerId,
  getPlayerMinutesMs,
  owesConversion,
  pendingConversionKick,
  owesOpponentConversion,
  pendingOpponentConversionKick,
  onAction,
  onOpponentScoring,
  opponentStatBoard,
  onOpponentStatAdjust,
  onTackle,
  onSubstitute,
  onTeamPenalty,
  onSetPiece,
}: Props) {
  const [mode, setMode] = useState<PlayerActionMode>('attack');
  /** Which row’s penalty panel is open (at most one). */
  const [penaltyMenuFor, setPenaltyMenuFor] = useState<string | null>(null);
  /** Which row’s substitution picker (who comes on) is open. */
  const [subPickerFor, setSubPickerFor] = useState<string | null>(null);
  /** Wall-clock end time for yellow-card return-to-play (per player). */
  const [yellowSinBinUntilMs, setYellowSinBinUntilMs] = useState<Record<string, number>>({});
  const [sinBinClock, setSinBinClock] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setSinBinClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sinBinSecondsLeft = useCallback(
    (playerId: string) => {
      const until = yellowSinBinUntilMs[playerId];
      if (!until) return 0;
      return Math.max(0, Math.ceil((until - sinBinClock) / 1000));
    },
    [yellowSinBinUntilMs, sinBinClock],
  );

  const startYellowSinBin = useCallback((playerId: string) => {
    setYellowSinBinUntilMs((prev) => ({
      ...prev,
      [playerId]: Date.now() + YELLOW_CARD_COOLDOWN_SEC * 1000,
    }));
  }, []);

  const clearYellowSinBin = useCallback((playerId: string) => {
    setYellowSinBinUntilMs((prev) => {
      if (!(playerId in prev)) return prev;
      const n = { ...prev };
      delete n[playerId];
      return n;
    });
  }, []);

  const subsSorted = useMemo(() => sortPlayersRefLogStyle(substituteOptions, true), [substituteOptions]);

  const attackActions = useMemo((): AttackActionSpec[] => {
    return [
      { kind: 'pass', abbr: 'P', title: 'Pass' },
      { kind: 'line_break', abbr: 'LB', title: 'Line break' },
      owesConversion
        ? { kind: 'conversion', abbr: 'C', title: 'Conversion' }
        : { kind: 'try', abbr: 'Tr', title: 'Try' },
      {
        kind: 'negative_action',
        abbr: 'Neg',
        title: 'Negative play',
        roundClassName: 'live-action-round-negative',
      },
    ];
  }, [owesConversion]);

  const opponentActions = useMemo((): AttackActionSpec[] => {
    return [
      owesOpponentConversion
        ? { kind: 'opponent_conversion', abbr: 'C', title: 'Opp conversion' }
        : { kind: 'opponent_try', abbr: 'Tr', title: 'Opp try' },
    ];
  }, [owesOpponentConversion]);

  if (players.length === 0) {
    return (
      <p className="muted live-player-empty">
        No one on field. Use the <strong>Roster</strong> tab or move players to <strong>On</strong>.
      </p>
    );
  }

  return (
    <div className="on-field-actions-wrap">
      <div className="live-phase-switch" role="group" aria-label="Player actions: attack, defense, or opponent">
        <button
          type="button"
          className={`live-phase-btn${mode === 'attack' ? ' live-phase-btn-active' : ''}`}
          aria-pressed={mode === 'attack'}
          onClick={(e) =>
            tapThenBlur(e, () => {
              setMode('attack');
              setPenaltyMenuFor(null);
              setSubPickerFor(null);
            })
          }
        >
          Attack
        </button>
        <button
          type="button"
          className={`live-phase-btn${mode === 'defense' ? ' live-phase-btn-active' : ''}`}
          aria-pressed={mode === 'defense'}
          onClick={(e) =>
            tapThenBlur(e, () => {
              setMode('defense');
              setPenaltyMenuFor(null);
              setSubPickerFor(null);
            })
          }
        >
          Defense
        </button>
        <button
          type="button"
          className={`live-phase-btn${mode === 'opponent' ? ' live-phase-btn-active' : ''}`}
          aria-pressed={mode === 'opponent'}
          onClick={(e) =>
            tapThenBlur(e, () => {
              setMode('opponent');
              setPenaltyMenuFor(null);
              setSubPickerFor(null);
            })
          }
        >
          Opp
        </button>
      </div>

      {mode !== 'opponent' ? (
      <div className="live-setpiece-block" aria-label="Set pieces">
        <div className="live-setpiece-bar">
          <SetPieceFlowerButton
            kind="scrum"
            label="Scrum"
            onComplete={(p) =>
              onSetPiece({
                kind: p.kind,
                outcome: p.outcome,
                pick: p.pick,
                phase: mode,
              })
            }
          />
          <SetPieceFlowerButton
            kind="lineout"
            label="Lineout"
            onComplete={(p) =>
              onSetPiece({
                kind: p.kind,
                outcome: p.outcome,
                pick: p.pick,
                phase: mode,
              })
            }
          />
          <SetPieceFlowerButton
            kind="ruck"
            label="Ruck"
            chipClassName="live-chip-tertiary"
            onComplete={(p) =>
              onSetPiece({
                kind: p.kind,
                outcome: p.outcome,
                pick: p.pick,
                phase: mode,
              })
            }
          />
        </div>
      </div>
      ) : null}

      {mode === 'opponent' ? (
        <div className="live-opponent-panel" aria-label="Opponent scoring and stats">
          <div className="live-opp-score-stat muted" aria-label="Opponent tries and conversions logged">
            <span>Tr {opponentStatBoard.oppTries}</span>
            <span aria-hidden="true"> · </span>
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
                  if (k === 'opponent_try' || k === 'opponent_conversion') {
                    onOpponentScoring(k, pick);
                  }
                }}
              />
            ))}
          </div>
          <div className="live-opp-stat-board" aria-label="Substitutions and cards by team">
            <div className="live-opp-stat-stack">
              <section className="live-opp-stat-card" aria-labelledby="opp-stat-subs">
                <h3 id="opp-stat-subs" className="live-opp-stat-card-title">
                  Subs
                </h3>
                <div className="live-opp-stat-line">
                  <span className="live-opp-stat-team" title={opponentStatBoard.themLabel}>
                    {opponentStatBoard.themLabel}
                  </span>
                  <span className="live-opp-stat-delta-group">
                    <button
                      type="button"
                      className="live-opp-stat-delta"
                      aria-label="Remove last opponent substitution"
                      disabled={opponentStatBoard.them.subs === 0}
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          onOpponentStatAdjust('subs', -1);
                        })
                      }
                    >
                      −
                    </button>
                    <span className="live-opp-stat-num">{opponentStatBoard.them.subs}</span>
                    <button
                      type="button"
                      className="live-opp-stat-delta"
                      aria-label="Log opponent substitution"
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          onOpponentStatAdjust('subs', 1);
                        })
                      }
                    >
                      +
                    </button>
                  </span>
                </div>
                <div className="live-opp-stat-line live-opp-stat-line--us">
                  <span className="live-opp-stat-team" title={opponentStatBoard.usLabel}>
                    {opponentStatBoard.usLabel}
                  </span>
                  <span className="live-opp-stat-num live-opp-stat-num--solo">{opponentStatBoard.us.subs}</span>
                </div>
              </section>
              <section className="live-opp-stat-card" aria-labelledby="opp-stat-yc">
                <h3 id="opp-stat-yc" className="live-opp-stat-card-title">
                  YC
                </h3>
                <div className="live-opp-stat-line">
                  <span className="live-opp-stat-team" title={opponentStatBoard.themLabel}>
                    {opponentStatBoard.themLabel}
                  </span>
                  <span className="live-opp-stat-delta-group">
                    <button
                      type="button"
                      className="live-opp-stat-delta live-opp-stat-delta--yc"
                      aria-label="Remove last opponent yellow card"
                      disabled={opponentStatBoard.them.yc === 0}
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          onOpponentStatAdjust('yc', -1);
                        })
                      }
                    >
                      −
                    </button>
                    <span className="live-opp-stat-num">{opponentStatBoard.them.yc}</span>
                    <button
                      type="button"
                      className="live-opp-stat-delta live-opp-stat-delta--yc"
                      aria-label="Log opponent yellow card"
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          onOpponentStatAdjust('yc', 1);
                        })
                      }
                    >
                      +
                    </button>
                  </span>
                </div>
                <div className="live-opp-stat-line live-opp-stat-line--us">
                  <span className="live-opp-stat-team" title={opponentStatBoard.usLabel}>
                    {opponentStatBoard.usLabel}
                  </span>
                  <span className="live-opp-stat-num live-opp-stat-num--solo">{opponentStatBoard.us.yc}</span>
                </div>
              </section>
              <section className="live-opp-stat-card" aria-labelledby="opp-stat-rc">
                <h3 id="opp-stat-rc" className="live-opp-stat-card-title">
                  RC
                </h3>
                <div className="live-opp-stat-line">
                  <span className="live-opp-stat-team" title={opponentStatBoard.themLabel}>
                    {opponentStatBoard.themLabel}
                  </span>
                  <span className="live-opp-stat-delta-group">
                    <button
                      type="button"
                      className="live-opp-stat-delta live-opp-stat-delta--rc"
                      aria-label="Remove last opponent red card"
                      disabled={opponentStatBoard.them.rc === 0}
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          onOpponentStatAdjust('rc', -1);
                        })
                      }
                    >
                      −
                    </button>
                    <span className="live-opp-stat-num">{opponentStatBoard.them.rc}</span>
                    <button
                      type="button"
                      className="live-opp-stat-delta live-opp-stat-delta--rc"
                      aria-label="Log opponent red card"
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          onOpponentStatAdjust('rc', 1);
                        })
                      }
                    >
                      +
                    </button>
                  </span>
                </div>
                <div className="live-opp-stat-line live-opp-stat-line--us">
                  <span className="live-opp-stat-team" title={opponentStatBoard.usLabel}>
                    {opponentStatBoard.usLabel}
                  </span>
                  <span className="live-opp-stat-num live-opp-stat-num--solo">{opponentStatBoard.us.rc}</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
      <div className="on-field-rows">
        {players.map((p) => {
          const sinBinUntil = yellowSinBinUntilMs[p.id];
          const inYellowSinBin = sinBinUntil !== undefined;
          const sinBinSec = sinBinSecondsLeft(p.id);
          const rowSinBin = inYellowSinBin;
          const showSinBinRowOverlay = rowSinBin && penaltyMenuFor !== p.id;

          return (
          <div
            key={p.id}
            className={`on-field-player-block${rowSinBin ? ' on-field-player-block--sin-bin' : ''}`}
          >
            <div
              className={`on-field-row-shell${showSinBinRowOverlay ? ' on-field-row-shell--overlay' : ''}`}
            >
              <div className={`on-field-row-inner${rowSinBin ? ' on-field-row-inner--sin-bin' : ''}`}>
              <button
                type="button"
                disabled={rowSinBin}
                className={`on-field-identity on-field-identity-tap${subPickerFor === p.id ? ' on-field-identity-tap-open' : ''}`}
                aria-expanded={subPickerFor === p.id}
                aria-label={`${formatPlayerLabel(p)}. Tap to choose who subs in.`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (rowSinBin) return;
                  setPenaltyMenuFor(null);
                  setSubPickerFor((id) => (id === p.id ? null : p.id));
                }}
              >
                <span className="on-field-jersey">{p.number ?? '—'}</span>
                <span className="on-field-name">
                  {formatPlayerNameOnly(p)}
                  <PlayerDisciplineSuffix
                    badges={disciplineBadgesByPlayerId[p.id] ?? emptyDisciplineBadges()}
                  />
                </span>
              </button>
              <div className="on-field-round-actions">
                {mode === 'attack' ? (
                  <>
                    {attackActions.map(({ kind, abbr, title, roundClassName }) => (
                      <ZoneFlowerActionButton
                        key={`${kind}-${owesConversion ? 'c' : 't'}`}
                        kind={kind}
                        abbr={abbr}
                        title={title}
                        playerId={p.id}
                        playerLabelForAria={formatPlayerLabel(p)}
                        disabled={rowSinBin}
                        roundClassName={roundClassName}
                        conversionKick={kind === 'conversion' ? pendingConversionKick : undefined}
                        onAction={onAction}
                      />
                    ))}
                    <button
                      type="button"
                      className="live-action-round live-action-penalty-trigger"
                      disabled={rowSinBin}
                      title="Penalty — choose card (optional) and infraction"
                      aria-expanded={penaltyMenuFor === p.id}
                      aria-label={`Penalty — ${formatPlayerLabel(p)}`}
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          setSubPickerFor(null);
                          setPenaltyMenuFor((id) => (id === p.id ? null : p.id));
                        })
                      }
                    >
                      !
                    </button>
                  </>
                ) : (
                  <>
                    <ZoneFlowerActionButton
                      kind="tackle_made"
                      abbr="M"
                      title="Tackle made"
                      playerId={p.id}
                      playerLabelForAria={formatPlayerLabel(p)}
                      disabled={rowSinBin}
                      onAction={(_k, pid, pick) => onTackle(pid, 'made', pick)}
                    />
                    <ZoneFlowerActionButton
                      kind="tackle_missed"
                      abbr="X"
                      title="Tackle missed"
                      playerId={p.id}
                      playerLabelForAria={formatPlayerLabel(p)}
                      disabled={rowSinBin}
                      roundClassName="live-action-round-tackle-miss"
                      onAction={(_k, pid, pick) => onTackle(pid, 'missed', pick)}
                    />
                    <button
                      type="button"
                      className="live-action-round live-action-penalty-trigger"
                      disabled={rowSinBin}
                      title="Penalty — choose card (optional) and infraction"
                      aria-expanded={penaltyMenuFor === p.id}
                      aria-label={`Penalty — ${formatPlayerLabel(p)}`}
                      onClick={(e) =>
                        tapThenBlur(e, () => {
                          setSubPickerFor(null);
                          setPenaltyMenuFor((id) => (id === p.id ? null : p.id));
                        })
                      }
                    >
                      !
                    </button>
                  </>
                )}
              </div>
            </div>
            {showSinBinRowOverlay ? (
              <button
                type="button"
                className="on-field-sin-bin-overlay"
                aria-live="polite"
                aria-label={
                  sinBinSec > 0
                    ? `Return to play, ${formatMmSs(sinBinSec)} remaining. Tap to dismiss early or wait for zero.`
                    : 'Return to play timer finished. Tap to confirm player may return.'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  clearYellowSinBin(p.id);
                }}
              >
                <div className="live-penalty-yellow-bin live-penalty-yellow-bin--row">
                  <div className="live-penalty-yellow-bin-text">
                    <span className="live-penalty-yellow-bin-label">Return to play</span>
                    {sinBinSec === 0 ? (
                      <span className="on-field-sin-bin-hint muted">Tap when player may return</span>
                    ) : null}
                  </div>
                  <span className="live-penalty-yellow-bin-time" title="Time remaining">
                    {formatMmSs(sinBinSec)}
                  </span>
                </div>
              </button>
            ) : null}
            </div>
            {subPickerFor === p.id ? (
              <div className="on-field-sub-pick" role="group" aria-label="Choose player coming on">
                <div className="on-field-row-stats" aria-label="Player stats">
                  <div className="on-field-row-stat">
                    <span className="on-field-row-stat-label">Minutes</span>
                    <span className="on-field-row-stat-value">
                      {formatPlayerMinutesLabel(getPlayerMinutesMs(p.id))}
                    </span>
                  </div>
                </div>
                <span className="on-field-sub-pick-heading">Sub in</span>
                {subsSorted.length === 0 ? (
                  <p className="muted on-field-sub-pick-empty">No bench or spare players available.</p>
                ) : (
                  <div className="on-field-sub-pick-chips">
                    {subsSorted.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="on-field-sub-pick-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubstitute(p.id, c.id);
                          setSubPickerFor(null);
                        }}
                      >
                        <span className="on-field-sub-pick-btn-text">
                          {formatPlayerLabel(c)}
                          <PlayerDisciplineSuffix
                            badges={disciplineBadgesByPlayerId[c.id] ?? emptyDisciplineBadges()}
                          />
                        </span>
                        <span className="on-field-sub-pick-btn-mins muted">
                          {formatPlayerMinutesLabel(getPlayerMinutesMs(c.id))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {penaltyMenuFor === p.id ? (
              <LivePenaltySubpanel
                key={p.id}
                yellowSecondsLeft={sinBinSecondsLeft(p.id)}
                onYellowCardActivate={(active) => {
                  if (active) startYellowSinBin(p.id);
                  else clearYellowSinBin(p.id);
                }}
                onSubmit={(payload) => {
                  onTeamPenalty(p.id, payload);
                  setPenaltyMenuFor(null);
                }}
              />
            ) : null}
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
