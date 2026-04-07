import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAppChrome } from '@/context/AppChromeContext';
import {
  clampSessionPeriod,
  defaultSessionForMatch,
  resetMatchClockSession,
  type MatchRecord,
  type MatchSessionRecord,
} from '@/domain/match';
import {
  matchOpponentOwesConversion,
  matchOwesConversion,
  pendingConversionKickFromEvents,
  pendingOpponentConversionKickFromEvents,
} from '@/domain/matchEvent';
import {
  adjustCurrentPeriod,
  advancePeriod,
  applyClockDisplaySettings,
  cumulativeMatchTimeMs,
  currentMatchDisplayForUi,
  currentPeriodDisplayForUi,
  enterHalfTime,
  exitHalfTime,
  halfTimeElapsedDisplayMs,
  pauseSession,
  resumeSession,
  setMatchTotalFromDisplayedValue,
  setPeriodFromDisplayedMs,
  shouldBlinkMatchThreshold,
  syncMinutesLedgerToMatchClock,
} from '@/domain/matchClock';
import {
  accumulateDisciplineBadgesFromEvents,
  fieldLengthBandShortLabel,
  type FieldLengthBandId,
  type MatchEventKind,
  type MatchEventRecord,
  type PenaltyCard,
  type PlayPhaseContext,
  restartKickDepthLabel,
  type RestartKickDepth,
  type SetPieceOutcome,
  type ConversionOutcome,
  type TackleOutcome,
  type TeamPenaltyPayload,
  type ZoneFlowerPick,
} from '@/domain/matchEvent';
import { resolveMatchBackTarget } from '@/domain/matchNavigation';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import { setLastMatchIdForTeam } from '@/domain/lastMatchSelection';
import { derivedFixtureLabel } from '@/domain/matchDisplay';
import {
  dedupeSquadPlayers,
  orderOnFieldPlayers,
  reconcileOnFieldOrder,
  sortPlayersRefLogStyle,
} from '@/domain/rosterDisplay';
import {
  countActiveOpponentCards,
  countActiveOpponentConversions,
  countActiveOpponentSubstitutions,
  countActiveOpponentTries,
  countOurTeamPenaltyCards,
  lastMatchingEventId,
  rugbyPointsFromOpponentEvents,
  rugbyPointsFromOwnTeamEvents,
} from '@/domain/matchStats';
import { derivedPlayerMinutesMs, flushPlayerMinutes } from '@/domain/playerMinutes';
import { addMatchEvent, deleteMatchEvent, listMatchEvents, restoreMatchEvent } from '@/repos/matchEventsRepo';
import { getMatch, getSession, saveSession } from '@/repos/matchesRepo';
import { listPlayers, listSubstitutions, recordSubstitution, syncMatchPlayerNamesFromTeam } from '@/repos/rosterRepo';
import { MatchStatsPanel } from './MatchStatsPanel';
import { MatchEventTimeline } from './MatchEventTimeline';
import { OnFieldPlayerActions } from './OnFieldPlayerActions';
import { SimplePlayerActions, type SimpleActionKind } from './SimplePlayerActions';
import { TallyPlayerActions, type TallyActionKind } from './TallyPlayerActions';
import { RefClockBar } from './RefClockBar';
import { RefClockSettingsDialog, type ClockSettingsApplyPayload } from './RefClockSettingsDialog';
import { MatchRosterPanel } from './roster/MatchRosterPanel';
import { SectionHelp, TRACKING_GLOSSARY } from '@/components/SectionHelp';
import type { ZoneId } from '@/domain/zone';

/** When no zone flower pick: default width zone for set-pieces, tackles without pick, etc. */
const DEFAULT_LOG_ZONE: ZoneId = 'Z4';

const ACTION_ACK: Record<'pass' | 'try' | 'line_break' | 'negative_action', string> = {
  pass: 'Pass logged',
  try: 'Try logged',
  line_break: 'Line break logged',
  negative_action: 'Negative play logged',
};

type LoadSwapHint = { playerOffId: string; playerOnId: string };

const TRACKING_MODE_STORAGE_PREFIX = 'sevensManager.trackingMode.';

type TrackingMode = 'full' | 'one_tap' | 'tally';

function readStoredTrackingMode(matchId: string | undefined): TrackingMode {
  if (!matchId || typeof sessionStorage === 'undefined') return 'full';
  try {
    const v = sessionStorage.getItem(`${TRACKING_MODE_STORAGE_PREFIX}${matchId}`);
    if (v === 'one_tap' || v === 'full' || v === 'tally') return v;
  } catch {
    /* ignore */
  }
  return 'full';
}

export function MatchLivePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const location = useLocation();
  const { setTeamHeader } = useAppChrome();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnToParam = searchParams.get('returnTo');
  const [match, setMatch] = useState<MatchRecord | null | undefined>(undefined);
  const [session, setSession] = useState<MatchSessionRecord | null | undefined>(undefined);
  const [events, setEvents] = useState<MatchEventRecord[]>([]);
  const [substitutions, setSubstitutions] = useState<SubstitutionRecord[]>([]);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [banner, setBanner] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ text: string; key: number } | null>(null);
  const [undoToast, setUndoToast] = useState<{ id: string; text: string; key: number } | null>(null);
  /** Stable row order for on-field list (by player id); subs swap in place instead of re-sorting by jersey. */
  const [onFieldDisplayOrder, setOnFieldDisplayOrder] = useState<string[] | null>(null);
  const [clockSettingsOpen, setClockSettingsOpen] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(() => readStoredTrackingMode(matchId));
  const liveTab = useMemo((): 'live' | 'timeline' | 'stats' | 'roster' => {
    const t = searchParams.get('tab');
    if (t === 'roster' || t === 'timeline' || t === 'stats' || t === 'live') return t;
    return 'live';
  }, [searchParams]);

  const matchesListBack = useMemo(
    () => resolveMatchBackTarget(location.state, returnToParam, match?.teamId),
    [location.state, returnToParam, match?.teamId],
  );

  const setLiveTab = useCallback(
    (t: 'live' | 'timeline' | 'stats' | 'roster') => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (t === 'live') p.delete('tab');
          else p.set('tab', t);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setTrackingMode(readStoredTrackingMode(matchId));
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    try {
      sessionStorage.setItem(`${TRACKING_MODE_STORAGE_PREFIX}${matchId}`, trackingMode);
    } catch {
      /* ignore */
    }
  }, [matchId, trackingMode]);

  const load = useCallback(async (swap?: LoadSwapHint): Promise<PlayerRecord[] | undefined> => {
    if (!matchId) return undefined;
    const m = await getMatch(matchId);
    if (m?.teamId) {
      await syncMatchPlayerNamesFromTeam(m.teamId, matchId);
    }
    const [s, ev, plRaw, sub] = await Promise.all([
      getSession(matchId),
      listMatchEvents(matchId),
      listPlayers(matchId),
      listSubstitutions(matchId),
    ]);
    const pl = sortPlayersRefLogStyle(dedupeSquadPlayers(plRaw), true);
    setMatch(m ?? null);
    let sess = s;
    if (m && !s) {
      const created = defaultSessionForMatch(m.id);
      await saveSession(created);
      sess = created;
    }
    setSession(sess ?? null);
    setEvents(ev);
    setPlayers(pl);
    setSubstitutions(sub);
    setOnFieldDisplayOrder((prev) => {
      if (swap) {
        const base = prev ?? reconcileOnFieldOrder(null, pl);
        const idx = base.indexOf(swap.playerOffId);
        if (idx !== -1) {
          const swapped = [...base];
          swapped[idx] = swap.playerOnId;
          return reconcileOnFieldOrder(swapped, pl);
        }
      }
      return reconcileOnFieldOrder(prev, pl);
    });
    return pl;
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOnFieldDisplayOrder(null);
  }, [matchId]);

  useEffect(() => {
    setTeamHeader({
      backTo: matchesListBack,
      minimalBackOnly: true,
      backAriaLabel: 'Go back',
    });
    return () => setTeamHeader(null);
  }, [setTeamHeader, matchesListBack]);

  useEffect(() => {
    if (match?.teamId && matchId) {
      setLastMatchIdForTeam(match.teamId, matchId);
    }
  }, [match?.teamId, matchId]);

  useEffect(() => {
    if (!actionToast) return;
    const id = window.setTimeout(() => setActionToast(null), 550);
    return () => window.clearTimeout(id);
  }, [actionToast]);

  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(t);
  }, [undoToast]);

  useEffect(() => {
    const s = session;
    if (!s?.clockRunning && !s?.halfTimeActive) return;
    const ms = s.halfTimeActive && !s.clockRunning ? 1000 : 250;
    const id = window.setInterval(() => setNowMs(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [session?.clockRunning, session?.halfTimeActive, session]);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const playersRef = useRef(players);
  playersRef.current = players;

  useEffect(() => {
    if (!session?.clockRunning) return;
    const id = window.setInterval(() => {
      const s = sessionRef.current;
      const pl = playersRef.current;
      if (!s?.clockRunning) return;
      const flushed = flushPlayerMinutes(s, pl, Date.now());
      setSession(flushed);
      void saveSession(flushed);
    }, 15000);
    return () => window.clearInterval(id);
  }, [session?.clockRunning]);

  async function persist(next: MatchSessionRecord) {
    setSession(next);
    await saveSession(next);
  }

  async function logOpponentScoring(kind: 'opponent_try' | 'opponent_conversion', pick?: ZoneFlowerPick) {
    if (!matchId || !session) return;
    if (kind === 'opponent_try') {
      if (!pick?.zoneId) return;
      setBanner(null);
      await addMatchEvent({
        matchId,
        kind: 'opponent_try',
        matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
        period: session.period,
        zoneId: pick.zoneId,
        fieldLengthBand: pick.fieldLengthBand,
      });
      await load();
      setActionToast({ text: 'Opponent try logged', key: Date.now() });
      return;
    }
    if (!pick?.conversionOutcome) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'opponent_conversion',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      zoneId: pick.zoneId,
      fieldLengthBand: pick.fieldLengthBand,
      conversionOutcome: pick.conversionOutcome,
    });
    await load();
    setActionToast({
      text:
        pick.conversionOutcome === 'made' ? 'Opponent conversion made' : 'Opponent conversion missed',
      key: Date.now(),
    });
  }

  async function logOpponentSubstitution() {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'opponent_substitution',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
    });
    await load();
    setActionToast({ text: 'Opponent substitution logged', key: Date.now() });
  }

  async function logOpponentCard(card: PenaltyCard) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'opponent_card',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      penaltyCard: card,
    });
    await load();
    setActionToast({
      text: card === 'yellow' ? 'Opponent yellow card logged' : 'Opponent red card logged',
      key: Date.now(),
    });
  }

  async function onOpponentStatAdjust(row: 'subs' | 'yc' | 'rc', delta: 1 | -1) {
    if (!matchId) return;
    if (delta === 1) {
      if (row === 'subs') await logOpponentSubstitution();
      else if (row === 'yc') await logOpponentCard('yellow');
      else await logOpponentCard('red');
      return;
    }
    const id =
      row === 'subs'
        ? lastMatchingEventId(events, (e) => e.kind === 'opponent_substitution')
        : row === 'yc'
          ? lastMatchingEventId(
              events,
              (e) => e.kind === 'opponent_card' && e.penaltyCard === 'yellow',
            )
          : lastMatchingEventId(
              events,
              (e) => e.kind === 'opponent_card' && e.penaltyCard === 'red',
            );
    if (!id) return;
    await deleteMatchEvent(id);
    await load();
  }

  async function onToggleMatch() {
    if (!session) return;
    if (session.halfTimeActive) {
      setBanner('Use Resume match on the clock to leave halftime.');
      return;
    }
    const now = Date.now();
    const flushed = flushPlayerMinutes(session, players, now);
    const next = flushed.clockRunning ? pauseSession(flushed, now) : resumeSession(flushed, now);
    await persist(next);
  }

  async function onAdjustMatch(deltaMs: number) {
    if (!session || session.halfTimeActive) return;
    const now = Date.now();
    const flushed = flushPlayerMinutes(session, players, now);
    await persist(adjustCurrentPeriod(flushed, now, deltaMs));
  }

  async function onAdvancePeriod() {
    if (!session || session.halfTimeActive) return;
    const now = Date.now();
    const flushed = flushPlayerMinutes(session, players, now);
    await persist(advancePeriod(flushed, now));
  }

  async function onHalftime() {
    if (!session || session.halfTimeActive) return;
    const now = Date.now();
    const flushed = flushPlayerMinutes(session, players, now);
    const advanced = advancePeriod(flushed, now);
    await persist(enterHalfTime(advanced, now));
  }

  async function onApplyClockSettings(payload: ClockSettingsApplyPayload) {
    if (!session) return;
    setBanner(null);
    const now = Date.now();
    let next = flushPlayerMinutes(session, players, now);
    next = pauseSession(next, now);
    next = {
      ...next,
      period: clampSessionPeriod(payload.period),
    };
    next = applyClockDisplaySettings(next, {
      matchClockDisplayMode: payload.matchClockDisplayMode,
      matchCountdownLengthMs: payload.matchCountdownLengthMs,
      periodClockDisplayMode: payload.periodClockDisplayMode,
      periodCountdownLengthMs: payload.periodCountdownLengthMs,
    });
    const mt = setMatchTotalFromDisplayedValue(next, payload.matchDisplayedMs);
    if ('error' in mt) {
      setBanner(mt.error);
      throw new Error(mt.error);
    }
    next = mt;
    next = setPeriodFromDisplayedMs(next, payload.periodDisplayedMs);
    next = syncMinutesLedgerToMatchClock(next, now);
    await persist(next);
  }

  async function onResetMatchClock() {
    if (!session) return;
    setBanner(null);
    const now = Date.now();
    const flushed = flushPlayerMinutes(session, players, now);
    await persist(resetMatchClockSession(flushed));
  }

  async function onResumeFromHalftime() {
    if (!session || !session.halfTimeActive) return;
    await persist(exitHalfTime(session));
  }

  const playersById = useMemo(() => {
    const m = new Map<string, PlayerRecord>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const onFieldPlayers = useMemo(
    () => orderOnFieldPlayers(players, onFieldDisplayOrder),
    [players, onFieldDisplayOrder],
  );

  const benchOrOff = useMemo(
    () => players.filter((p) => p.status === 'bench' || p.status === 'off'),
    [players],
  );

  const disciplineBadgesByPlayerId = useMemo(() => accumulateDisciplineBadgesFromEvents(events), [events]);

  const owesConversion = useMemo(() => matchOwesConversion(events), [events]);

  const pendingConversionKick = useMemo(() => pendingConversionKickFromEvents(events), [events]);

  const owesOpponentConversion = useMemo(() => matchOpponentOwesConversion(events), [events]);

  const pendingOpponentConversionKick = useMemo(
    () => pendingOpponentConversionKickFromEvents(events),
    [events],
  );

  const tallyCounts = useMemo(() => {
    const c = { pass: 0, offload: 0, line_break: 0, try: 0, negative_action: 0, tackle_made: 0, tackle_missed: 0, penalty: 0 };
    for (const e of events) {
      if (e.kind === 'pass') { if (e.passVariant === 'offload') c.offload++; else c.pass++; }
      else if (e.kind === 'line_break') c.line_break++;
      else if (e.kind === 'try') c.try++;
      else if (e.kind === 'negative_action') c.negative_action++;
      else if (e.kind === 'tackle') { if (e.tackleOutcome === 'missed') c.tackle_missed++; else c.tackle_made++; }
      else if (e.kind === 'team_penalty') c.penalty++;
    }
    return c;
  }, [events]);

  const ourRugbyScore = useMemo(() => rugbyPointsFromOwnTeamEvents(events), [events]);

  const opponentRugbyScore = useMemo(() => rugbyPointsFromOpponentEvents(events), [events]);

  const ourScoreboardLabel = useMemo(() => {
    if (match?.ourAbbreviation) return match.ourAbbreviation;
    const n = match?.ourTeamName?.trim();
    if (!n) return 'Us';
    const words = n.split(/\s+/);
    if (words.length > 1) return words[0]!;
    return n.length > 10 ? `${n.slice(0, 9)}…` : n;
  }, [match?.ourAbbreviation, match?.ourTeamName]);

  const opponentScoreboardLabel = useMemo(() => {
    if (match?.opponentAbbreviation) return match.opponentAbbreviation;
    const n = match?.opponentName?.trim();
    if (!n) return 'Opp';
    const words = n.split(/\s+/);
    if (words.length > 1) return words[0]!;
    return n.length > 10 ? `${n.slice(0, 9)}…` : n;
  }, [match?.opponentAbbreviation, match?.opponentName]);

  const opponentStatBoard = useMemo(
    () => ({
      themLabel: opponentScoreboardLabel,
      usLabel: ourScoreboardLabel,
      them: {
        subs: countActiveOpponentSubstitutions(events),
        yc: countActiveOpponentCards(events, 'yellow'),
        rc: countActiveOpponentCards(events, 'red'),
      },
      us: {
        subs: substitutions.length,
        yc: countOurTeamPenaltyCards(events, 'yellow'),
        rc: countOurTeamPenaltyCards(events, 'red'),
      },
      oppTries: countActiveOpponentTries(events),
      oppConvs: countActiveOpponentConversions(events),
    }),
    [events, substitutions, opponentScoreboardLabel, ourScoreboardLabel],
  );

  const getPlayerMinutesMs = useCallback(
    (playerId: string) => {
      const pl = playersById.get(playerId);
      if (!session || !pl) return 0;
      return derivedPlayerMinutesMs(session, playerId, pl.status, nowMs);
    },
    [session, playersById, nowMs],
  );

  async function logPlayerAction(
    kind: 'pass' | 'try' | 'conversion' | 'line_break' | 'negative_action',
    playerId: string,
    pick?: ZoneFlowerPick,
  ) {
    if (!matchId || !session) return;
    if (!pick?.zoneId) return;
    if (kind === 'negative_action') {
      if (!pick.negativeActionId) return;
      setBanner(null);
      await addMatchEvent({
        matchId,
        kind: 'negative_action',
        matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
        period: session.period,
        playerId,
        zoneId: pick.zoneId,
        negativeActionId: pick.negativeActionId,
      });
      await load();
      setActionToast({ text: ACTION_ACK.negative_action, key: Date.now() });
      return;
    }
    if (kind === 'try') {
      setBanner(null);
      await addMatchEvent({
        matchId,
        kind: 'try',
        matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
        period: session.period,
        playerId,
        zoneId: pick.zoneId,
        fieldLengthBand: pick.fieldLengthBand,
      });
      await load();
      setActionToast({ text: ACTION_ACK.try, key: Date.now() });
      return;
    }
    if (kind === 'conversion') {
      if (!pick?.conversionOutcome) return;
      setBanner(null);
      await addMatchEvent({
        matchId,
        kind: 'conversion',
        matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
        period: session.period,
        playerId,
        zoneId: pick.zoneId,
        fieldLengthBand: pick.fieldLengthBand,
        conversionOutcome: pick.conversionOutcome,
      });
      await load();
      setActionToast({
        text: pick.conversionOutcome === 'made' ? 'Conversion made' : 'Conversion missed',
        key: Date.now(),
      });
      return;
    }
    if (kind === 'pass' || kind === 'line_break') {
      if (!pick.fieldLengthBand) return;
      if (pick.passVariant === 'standard') {
        setBanner(null);
        await addMatchEvent({
          matchId,
          kind,
          matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
          period: session.period,
          playerId,
          zoneId: pick.zoneId,
          fieldLengthBand: pick.fieldLengthBand,
          passVariant: 'standard',
        });
        await load();
        setActionToast({ text: ACTION_ACK[kind], key: Date.now() });
        return;
      }
      if (pick.passVariant !== 'offload' || pick.offloadTone == null) return;
      setBanner(null);
      await addMatchEvent({
        matchId,
        kind,
        matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
        period: session.period,
        playerId,
        zoneId: pick.zoneId,
        fieldLengthBand: pick.fieldLengthBand,
        passVariant: 'offload',
        offloadTone: pick.offloadTone,
      });
      await load();
      setActionToast({ text: ACTION_ACK[kind], key: Date.now() });
    }
  }

  async function logTackle(playerId: string, outcome: TackleOutcome, pick?: ZoneFlowerPick) {
    if (!matchId || !session) return;
    if (!pick?.zoneId || !pick.fieldLengthBand) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'tackle',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      playerId,
      tackleOutcome: outcome,
      tackleQuality: outcome === 'made' ? (pick?.tackleQuality ?? 'neutral') : undefined,
      zoneId: pick.zoneId,
      fieldLengthBand: pick.fieldLengthBand,
    });
    await load();
    setActionToast({
      text: outcome === 'missed' ? 'Tackle missed logged' : 'Tackle made logged',
      key: Date.now(),
    });
  }

  async function logSetPiece(payload: {
    kind: 'scrum' | 'lineout' | 'ruck';
    outcome: SetPieceOutcome;
    phase: PlayPhaseContext;
    pick: { fieldLengthBand: FieldLengthBandId };
  }) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: payload.kind,
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      fieldLengthBand: payload.pick.fieldLengthBand,
      setPieceOutcome: payload.outcome,
      playPhaseContext: payload.phase,
    });
    await load();
    const label =
      payload.kind === 'scrum' ? 'Scrum' : payload.kind === 'lineout' ? 'Lineout' : 'Ruck';
    const band = fieldLengthBandShortLabel(payload.pick.fieldLengthBand);
    const outcomeLabel =
      payload.outcome === 'won'
        ? 'won'
        : payload.outcome === 'lost'
          ? 'lost'
          : payload.outcome === 'penalized'
            ? 'penalized'
            : 'free kick';
    setActionToast({
      text: `${label} · ${band} · ${outcomeLabel} · ${payload.phase}`,
      key: Date.now(),
    });
  }

  async function logRestart(payload: {
    outcome: Extract<SetPieceOutcome, 'won' | 'lost' | 'free_kick'>;
    phase: PlayPhaseContext;
    pick: { zoneId: ZoneId; restartKickDepth: RestartKickDepth };
  }) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'restart',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      zoneId: payload.pick.zoneId,
      restartKickDepth: payload.pick.restartKickDepth,
      setPieceOutcome: payload.outcome,
      playPhaseContext: payload.phase,
    });
    await load();
    const depth = restartKickDepthLabel(payload.pick.restartKickDepth);
    const oLabel =
      payload.outcome === 'won' ? 'Won' : payload.outcome === 'lost' ? 'Lost' : 'Free kick';
    setActionToast({
      text: `Restart · ${payload.pick.zoneId} · ${depth} · ${oLabel} · ${payload.phase}`,
      key: Date.now(),
    });
  }

  async function logSimpleAction(kind: SimpleActionKind, playerId: string) {
    if (!matchId || !session) return;
    setBanner(null);
    const isOffload = kind === 'offload';
    const eventKind = isOffload ? 'pass' : kind;
    await addMatchEvent({
      matchId,
      kind: eventKind,
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      playerId,
      ...(isOffload ? { passVariant: 'offload' as const } : kind === 'pass' ? { passVariant: 'standard' as const } : {}),
    });
    await load();
    const ack = isOffload ? 'Offload logged' : ACTION_ACK[kind as keyof typeof ACTION_ACK];
    setActionToast({ text: ack, key: Date.now() });
  }

  async function logSimpleTackle(playerId: string, outcome: TackleOutcome) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'tackle',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      playerId,
      tackleOutcome: outcome,
    });
    await load();
    setActionToast({
      text: outcome === 'missed' ? 'Tackle missed logged' : 'Tackle made logged',
      key: Date.now(),
    });
  }

  async function logSimpleSetPiece(kind: MatchEventKind, outcome: SetPieceOutcome, phase: PlayPhaseContext) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind,
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      setPieceOutcome: outcome,
      playPhaseContext: phase,
    });
    await load();
    const label =
      kind === 'scrum' ? 'Scrum' : kind === 'lineout' ? 'Lineout' : kind === 'ruck' ? 'Ruck' : 'Restart';
    setActionToast({ text: `${label} · ${outcome} · ${phase}`, key: Date.now() });
  }

  async function logTallyAction(kind: TallyActionKind) {
    if (!matchId || !session) return;
    setBanner(null);
    const isOffload = kind === 'offload';
    const eventKind = isOffload ? 'pass' : kind;
    await addMatchEvent({
      matchId,
      kind: eventKind,
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      ...(isOffload ? { passVariant: 'offload' as const } : kind === 'pass' ? { passVariant: 'standard' as const } : {}),
    });
    await load();
    const ack = isOffload ? 'Offload logged' : ACTION_ACK[kind as keyof typeof ACTION_ACK];
    setActionToast({ text: ack, key: Date.now() });
  }

  async function logTallyTackle(outcome: TackleOutcome) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'tackle',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      tackleOutcome: outcome,
    });
    await load();
    setActionToast({ text: outcome === 'missed' ? 'Tackle missed' : 'Tackle made', key: Date.now() });
  }

  async function logTallyConversion(outcome: ConversionOutcome) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'conversion',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      conversionOutcome: outcome,
    });
    await load();
    setActionToast({ text: outcome === 'made' ? 'Conversion made' : 'Conversion missed', key: Date.now() });
  }

  async function logTallyPenalty(payload: TeamPenaltyPayload) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'team_penalty',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      penaltyType: payload.penaltyType,
      penaltyCard: payload.card,
      penaltyDetail: payload.penaltyDetail,
    });
    await load();
    setActionToast({ text: 'Penalty logged', key: Date.now() });
  }

  async function logTeamPenalty(playerId: string, payload: TeamPenaltyPayload) {
    if (!matchId || !session) return;
    setBanner(null);
    await addMatchEvent({
      matchId,
      kind: 'team_penalty',
      matchTimeMs: cumulativeMatchTimeMs(session, Date.now()),
      period: session.period,
      playerId,
      penaltyType: payload.penaltyType,
      penaltyCard: payload.card,
      penaltyDetail: payload.penaltyDetail,
      zoneId: DEFAULT_LOG_ZONE,
    });
    await load();
    setActionToast({ text: 'Penalty logged', key: Date.now() });
  }

  async function onUndoDelete(id: string) {
    await restoreMatchEvent(id);
    setUndoToast(null);
    await load();
  }

  async function onDeleteEvent(id: string) {
    await deleteMatchEvent(id);
    await load();
    setUndoToast({ id, text: 'Event removed.', key: Date.now() });
  }

  async function recordSubstitutionLive(playerOffId: string, playerOnId: string) {
    if (!matchId || !session) return;
    setBanner(null);
    const now = Date.now();
    const flushed = flushPlayerMinutes(session, players, now);
    await persist(flushed);
    const r = await recordSubstitution(
      matchId,
      playerOffId,
      playerOnId,
      cumulativeMatchTimeMs(flushed, now),
      flushed.period,
    );
    if (r === 'invalid') {
      setBanner('That substitution is not allowed (check who is on field and on bench).');
      return;
    }
    await load({ playerOffId, playerOnId });
    setActionToast({ text: 'Substitution recorded', key: Date.now() });
  }

  if (match === undefined || session === undefined) {
    return (
      <section className="card">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  if (match === null || session === null) {
    return (
      <section className="card">
        <p>Match not found.</p>
        <Link to={matchesListBack}>Back</Link>
      </section>
    );
  }

  const matchDisplayMs = currentMatchDisplayForUi(session, nowMs);
  const periodDisplayMs = currentPeriodDisplayForUi(session, nowMs);
  const clockBlink = shouldBlinkMatchThreshold(session, nowMs);
  const halfTimeElapsedMs = halfTimeElapsedDisplayMs(session, nowMs);

  return (
    <div className="live-match-shell">
      <div className="live-match-head">
        <h1 className="live-compact-title">{derivedFixtureLabel(match)}</h1>
        <p className="muted live-match-event-count" aria-live="polite">
          {events.length} {events.length === 1 ? 'event' : 'events'} logged
        </p>
      </div>

      {banner ? <p className="error-text live-banner" role="alert">{banner}</p> : null}

      <div className="live-tab-strip live-tab-strip-4" role="tablist" aria-label="Match sections">
        <button
          type="button"
          role="tab"
          id="tab-tracking"
          aria-selected={liveTab === 'live'}
          aria-controls="panel-tracking"
          className={`live-tab${liveTab === 'live' ? ' live-tab-active' : ''}`}
          onClick={() => setLiveTab('live')}
        >
          Tracking
        </button>
        <button
          type="button"
          role="tab"
          id="tab-timeline"
          aria-selected={liveTab === 'timeline'}
          aria-controls="panel-timeline"
          className={`live-tab${liveTab === 'timeline' ? ' live-tab-active' : ''}`}
          onClick={() => setLiveTab('timeline')}
        >
          Timeline
        </button>
        <button
          type="button"
          role="tab"
          id="tab-stats"
          aria-selected={liveTab === 'stats'}
          aria-controls="panel-stats"
          className={`live-tab${liveTab === 'stats' ? ' live-tab-active' : ''}`}
          onClick={() => setLiveTab('stats')}
        >
          Stats
        </button>
        <button
          type="button"
          role="tab"
          id="tab-roster"
          aria-selected={liveTab === 'roster'}
          aria-controls="panel-roster"
          className={`live-tab${liveTab === 'roster' ? ' live-tab-active' : ''}`}
          onClick={() => setLiveTab('roster')}
        >
          Roster
        </button>
      </div>

      {liveTab === 'stats' ? (
        <div
          id="panel-stats"
          role="tabpanel"
          aria-labelledby="tab-stats"
          className="live-tab-panel live-tab-panel-stats"
        >
          <MatchStatsPanel
            events={events}
            substitutions={substitutions}
            playersById={playersById}
            statsDetail={trackingMode === 'tally' ? 'tally' : trackingMode === 'one_tap' ? 'one_tap' : 'full'}
            onStatsDetailChange={(mode) => setTrackingMode(mode)}
          />
        </div>
      ) : liveTab === 'roster' ? (
        <div
          id="panel-roster"
          role="tabpanel"
          aria-labelledby="tab-roster"
          className="live-tab-panel live-tab-panel-roster"
        >
          {matchId ? (
            <MatchRosterPanel matchId={matchId} embedded onRosterUpdated={() => void load()} />
          ) : null}
        </div>
      ) : liveTab === 'live' ? (
        <div
          id="panel-tracking"
          role="tabpanel"
          aria-labelledby="tab-tracking"
          className="live-tab-panel live-tab-panel-live"
        >
          <RefClockBar
            period={session.period}
            matchClockMode={session.matchClockDisplayMode ?? 'up'}
            periodClockMode={session.periodClockDisplayMode ?? 'up'}
            matchDisplayMs={matchDisplayMs}
            periodDisplayMs={periodDisplayMs}
            shouldBlink={clockBlink}
            running={session.clockRunning}
            halfTimeActive={!!session.halfTimeActive}
            halfTimeElapsedMs={halfTimeElapsedMs}
            ourScore={ourRugbyScore}
            opponentScore={opponentRugbyScore}
            ourLabel={ourScoreboardLabel}
            opponentLabel={opponentScoreboardLabel}
            onToggle={() => void onToggleMatch()}
            onAdjust={(d) => void onAdjustMatch(d)}
            onAdvancePeriod={() => void onAdvancePeriod()}
            onHalftime={() => void onHalftime()}
            onResumeFromHalftime={() => void onResumeFromHalftime()}
            onOpenClockSettings={() => setClockSettingsOpen(true)}
          />

          <RefClockSettingsDialog
            open={clockSettingsOpen}
            onClose={() => setClockSettingsOpen(false)}
            session={session}
            nowMs={nowMs}
            onApply={(p) => onApplyClockSettings(p)}
            onReset={() => onResetMatchClock()}
          />

          <section className="live-player-pane" aria-label="Player tracking">
            <div className="tracking-mode-header">
              <div className="live-player-pane-header">
                <h2 className="live-player-pane-title">Tracking</h2>
                <SectionHelp title="Tracking" entries={TRACKING_GLOSSARY} />
              </div>
              <div className="tracking-mode-switch" role="radiogroup" aria-label="Tracking mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={trackingMode === 'full'}
                  className={`tracking-mode-opt${trackingMode === 'full' ? ' tracking-mode-opt--active' : ''}`}
                  onClick={() => setTrackingMode('full')}
                >
                  Full
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={trackingMode === 'one_tap'}
                  className={`tracking-mode-opt${trackingMode === 'one_tap' ? ' tracking-mode-opt--active' : ''}`}
                  onClick={() => setTrackingMode('one_tap')}
                >
                  One Tap
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={trackingMode === 'tally'}
                  className={`tracking-mode-opt${trackingMode === 'tally' ? ' tracking-mode-opt--active' : ''}`}
                  onClick={() => setTrackingMode('tally')}
                >
                  Tally
                </button>
              </div>
            </div>
            {trackingMode === 'one_tap' && (
              <p className="tracking-mode-hint">Quick counters — one tap per action, no zone detail.</p>
            )}
            {trackingMode === 'tally' && (
              <p className="tracking-mode-hint">Team-level tallies — no player attribution.</p>
            )}
            {trackingMode === 'tally' ? (
              <TallyPlayerActions
                counts={tallyCounts}
                owesConversion={owesConversion}
                owesOpponentConversion={owesOpponentConversion}
                pendingOpponentConversionKick={pendingOpponentConversionKick}
                onTallyAction={(kind) => void logTallyAction(kind)}
                onTallyTackle={(outcome) => void logTallyTackle(outcome)}
                onTallyConversion={(outcome) => void logTallyConversion(outcome)}
                onTallySetPiece={(kind, outcome, phase) => void logSimpleSetPiece(kind, outcome, phase)}
                onTallyPenalty={(payload) => void logTallyPenalty(payload)}
                onOpponentScoring={(kind, pick) => void logOpponentScoring(kind, pick)}
                opponentStatBoard={opponentStatBoard}
                onOpponentStatAdjust={(row, delta) => void onOpponentStatAdjust(row, delta)}
              />
            ) : trackingMode === 'one_tap' ? (
              <SimplePlayerActions
                players={onFieldPlayers}
                substituteOptions={benchOrOff}
                disciplineBadgesByPlayerId={disciplineBadgesByPlayerId}
                getPlayerMinutesMs={getPlayerMinutesMs}
                owesConversion={owesConversion}
                pendingConversionKick={pendingConversionKick}
                owesOpponentConversion={owesOpponentConversion}
                pendingOpponentConversionKick={pendingOpponentConversionKick}
                onAction={(kind, pid, pick) => {
                  if (kind === 'line_break') {
                    void logPlayerAction('line_break', pid, pick);
                  } else if (
                    kind === 'pass' ||
                    kind === 'try' ||
                    kind === 'conversion' ||
                    kind === 'negative_action'
                  ) {
                    void logPlayerAction(kind, pid, pick);
                  }
                }}
                onOpponentScoring={(kind, pick) => void logOpponentScoring(kind, pick)}
                opponentStatBoard={opponentStatBoard}
                onOpponentStatAdjust={(row, delta) => void onOpponentStatAdjust(row, delta)}
                onSubstitute={(offId, onId) => void recordSubstitutionLive(offId, onId)}
                onTeamPenalty={(pid, payload) => void logTeamPenalty(pid, payload)}
                onSimpleAction={(kind, pid) => void logSimpleAction(kind, pid)}
                onSimpleTackle={(pid, outcome) => void logSimpleTackle(pid, outcome)}
                onSimpleSetPiece={(kind, outcome, phase) => void logSimpleSetPiece(kind, outcome, phase)}
              />
            ) : (
              <OnFieldPlayerActions
                players={onFieldPlayers}
                substituteOptions={benchOrOff}
                disciplineBadgesByPlayerId={disciplineBadgesByPlayerId}
                getPlayerMinutesMs={getPlayerMinutesMs}
                owesConversion={owesConversion}
                pendingConversionKick={pendingConversionKick}
                owesOpponentConversion={owesOpponentConversion}
                pendingOpponentConversionKick={pendingOpponentConversionKick}
                onAction={(kind, pid, pick) => {
                  if (kind === 'line_break') {
                    void logPlayerAction('line_break', pid, pick);
                  } else if (
                    kind === 'pass' ||
                    kind === 'try' ||
                    kind === 'conversion' ||
                    kind === 'negative_action'
                  ) {
                    void logPlayerAction(kind, pid, pick);
                  }
                }}
                onOpponentScoring={(kind, pick) => void logOpponentScoring(kind, pick)}
                opponentStatBoard={opponentStatBoard}
                onOpponentStatAdjust={(row, delta) => void onOpponentStatAdjust(row, delta)}
                onTackle={(pid, o, pick) => void logTackle(pid, o, pick)}
                onSubstitute={(offId, onId) => void recordSubstitutionLive(offId, onId)}
                onTeamPenalty={(pid, payload) => void logTeamPenalty(pid, payload)}
                onSetPiece={(p) => void logSetPiece(p)}
                onRestart={(p) => void logRestart(p)}
              />
            )}
            {actionToast ? (
              <p
                key={actionToast.key}
                className="live-action-ack"
                role="status"
                aria-live="polite"
              >
                {actionToast.text}
              </p>
            ) : null}
          </section>
        </div>
      ) : (
        <div
          id="panel-timeline"
          role="tabpanel"
          aria-labelledby="tab-timeline"
          className="live-tab-panel live-tab-panel-timeline"
        >
          <MatchEventTimeline
            events={events}
            playersById={playersById}
            onDelete={(id) => void onDeleteEvent(id)}
            onEditSaved={() => void load()}
          />
        </div>
      )}

      {undoToast ? (
        <div key={undoToast.key} className="undo-toast" role="status" aria-live="polite">
          <span>{undoToast.text}</span>
          <button
            type="button"
            className="undo-toast-btn"
            onClick={() => void onUndoDelete(undoToast.id)}
          >
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
