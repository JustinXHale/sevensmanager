import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultSessionForMatch, type MatchRecord, type MatchSessionRecord } from '@/domain/match';
import { cumulativeMatchTimeMs, formatClock } from '@/domain/matchClock';
import {
  countByStatus,
  dedupeSquadPlayers,
  insertIdInOrder,
  moveIdInOrder,
  orderPlayersInStatus,
  ordersEqual,
  reconcileAllRosterOrders,
  sortPlayersRefLogStyle,
  type RosterDisplayOrders,
} from '@/domain/rosterDisplay';
import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { ON_FIELD_MAX } from '@/domain/player';
import { derivedFixtureLabel } from '@/domain/matchDisplay';
import { getMatch, getSession, saveSession } from '@/repos/matchesRepo';
import {
  ensureSevensRoster,
  listPlayers,
  syncMatchRosterFromTeam,
  listSubstitutions,
  recordSubstitution,
  removePlayer,
  updatePlayerName,
  updatePlayerStatus,
} from '@/repos/rosterRepo';
import { RosterDragBoard } from './RosterDragBoard';
import { SubstitutionHistoryCard } from './SubstitutionHistoryCard';
import { SubstitutionSheet } from './SubstitutionSheet';

type Props = {
  matchId: string;
  /** Called after any roster write so the parent match view can refresh players. */
  onRosterUpdated?: () => void;
  /** When true, omit standalone page title / fixture line (match shell already shows them). */
  embedded?: boolean;
};

function orderKey(status: PlayerStatus): keyof RosterDisplayOrders {
  return status;
}

function sessionOrders(sess: MatchSessionRecord | null | undefined): Partial<RosterDisplayOrders> {
  return {
    on: sess?.onFieldDisplayOrder,
    bench: sess?.benchDisplayOrder,
    off: sess?.offDisplayOrder,
  };
}

export function MatchRosterPanel({ matchId, onRosterUpdated, embedded = false }: Props) {
  const [match, setMatch] = useState<MatchRecord | null | undefined>(undefined);
  const [session, setSession] = useState<MatchSessionRecord | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [displayOrders, setDisplayOrders] = useState<RosterDisplayOrders>({ on: [], bench: [], off: [] });
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof listSubstitutions>>>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sortByStatus = true;
  const [subsExpanded, setSubsExpanded] = useState(false);
  const [squadExpanded, setSquadExpanded] = useState(true);
  const [subOpen, setSubOpen] = useState(false);
  const [subOffId, setSubOffId] = useState('');
  const [subOnId, setSubOnId] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const notify = useCallback(() => {
    onRosterUpdated?.();
  }, [onRosterUpdated]);

  const persistOrders = useCallback(
    async (sess: MatchSessionRecord, orders: RosterDisplayOrders) => {
      const next: MatchSessionRecord = {
        ...sess,
        onFieldDisplayOrder: orders.on,
        benchDisplayOrder: orders.bench,
        offDisplayOrder: orders.off,
      };
      await saveSession(next);
      setSession(next);
      setDisplayOrders(orders);
    },
    [],
  );

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([getMatch(matchId), getSession(matchId)]);
    setMatch(m ?? null);
    let sess = s;
    if (m && !s) {
      const created = defaultSessionForMatch(m.id);
      await saveSession(created);
      sess = created;
    }
    setSession(sess ?? null);
    if (m?.teamId) {
      await syncMatchRosterFromTeam(m.teamId, matchId);
    } else {
      await ensureSevensRoster(matchId);
    }
    const [plRaw, sb] = await Promise.all([
      listPlayers(matchId, sortByStatus),
      listSubstitutions(matchId),
    ]);
    const pl = sortPlayersRefLogStyle(dedupeSquadPlayers(plRaw), sortByStatus);
    setPlayers(pl);
    setSubs(sb);

    if (sess) {
      const reconciled = reconcileAllRosterOrders(pl, sessionOrders(sess));
      setDisplayOrders(reconciled);
      const stale =
        !ordersEqual(reconciled.on, sess.onFieldDisplayOrder) ||
        !ordersEqual(reconciled.bench, sess.benchDisplayOrder) ||
        !ordersEqual(reconciled.off, sess.offDisplayOrder);
      if (stale) {
        await persistOrders(sess, reconciled);
      }
    }
  }, [matchId, sortByStatus, persistOrders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.clockRunning) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [session?.clockRunning]);

  const onField = useMemo(
    () => orderPlayersInStatus(players, 'on', displayOrders.on, ON_FIELD_MAX),
    [players, displayOrders.on],
  );
  const benchOrOff = useMemo(
    () => [
      ...orderPlayersInStatus(players, 'bench', displayOrders.bench),
      ...orderPlayersInStatus(players, 'off', displayOrders.off),
    ],
    [players, displayOrders.bench, displayOrders.off],
  );

  const playerById = useMemo(() => {
    const m = new Map<string, PlayerRecord>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const countOnField = onField.length;

  async function onNameCommit(playerId: string, name: string) {
    setBanner(null);
    await updatePlayerName(playerId, name);
    await load();
    notify();
  }

  async function saveReordered(zone: PlayerStatus, order: string[]) {
    if (!session) return;
    const reconciled = reconcileAllRosterOrders(players, {
      ...displayOrders,
      [orderKey(zone)]: order,
    });
    await persistOrders(session, reconciled);
    notify();
  }

  async function onMoveInZone(zone: PlayerStatus, playerId: string, direction: 'up' | 'down') {
    const key = orderKey(zone);
    const next = moveIdInOrder(displayOrders[key], playerId, direction);
    if (!next) return;
    await saveReordered(zone, next);
  }

  async function onMoveToZone(playerId: string, zone: PlayerStatus, beforeId: string | null) {
    if (!session) return;
    setBanner(null);
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    if (player.status !== zone) {
      const r = await updatePlayerStatus(playerId, zone);
      if (r === 'toomanyon') {
        setBanner(`At most ${ON_FIELD_MAX} players can be on field.`);
        return;
      }
    }

    const updatedPlayers = players.map((p) => (p.id === playerId ? { ...p, status: zone } : p));
    const stripped: RosterDisplayOrders = {
      on: displayOrders.on.filter((id) => id !== playerId),
      bench: displayOrders.bench.filter((id) => id !== playerId),
      off: displayOrders.off.filter((id) => id !== playerId),
    };
    const key = orderKey(zone);
    stripped[key] = insertIdInOrder(stripped[key], playerId, beforeId);
    const reconciled = reconcileAllRosterOrders(updatedPlayers, stripped);
    await persistOrders(session, reconciled);
    setPlayers(updatedPlayers);
    notify();
  }

  async function onRemovePlayer(playerId: string) {
    if (!confirm('Remove this player from the match roster?')) return;
    setBanner(null);
    await removePlayer(playerId);
    await load();
    notify();
  }

  function openSubstitutionSheet() {
    setSubOffId(onField[0]?.id ?? '');
    setSubOnId(benchOrOff[0]?.id ?? '');
    setSubOpen(true);
  }

  async function confirmSubstitution() {
    if (!session) return;
    setBanner(null);
    const matchTimeMs = cumulativeMatchTimeMs(session, Date.now());
    const r = await recordSubstitution(matchId, subOffId, subOnId, matchTimeMs, session.period);
    if (r === 'invalid') {
      setBanner('Pick one player on field (off) and one from bench or off (on).');
      return;
    }
    setSubOpen(false);

    const plRaw = await listPlayers(matchId, sortByStatus);
    const pl = sortPlayersRefLogStyle(dedupeSquadPlayers(plRaw), sortByStatus);
    setPlayers(pl);

    let onOrder = displayOrders.on;
    const idx = onOrder.indexOf(subOffId);
    if (idx !== -1) {
      onOrder = [...onOrder];
      onOrder[idx] = subOnId;
    }
    const reconciled = reconcileAllRosterOrders(pl, { ...displayOrders, on: onOrder });
    await persistOrders(session, reconciled);
    notify();
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
      </section>
    );
  }

  const matchTimeLabel = formatClock(cumulativeMatchTimeMs(session, nowMs));
  const onC = countByStatus(players, 'on');
  const benchC = countByStatus(players, 'bench');
  const offC = countByStatus(players, 'off');

  return (
    <div className={embedded ? 'match-roster-panel match-roster-panel-embedded' : 'stack'}>
      <SubstitutionHistoryCard
        substitutions={subs}
        playerById={playerById}
        expanded={subsExpanded}
        onToggle={() => setSubsExpanded((e) => !e)}
      />

      <div className="card roster-card">
        {embedded ? (
          <h2 className="live-player-pane-title roster-embedded-heading">Roster</h2>
        ) : (
          <>
            <h1 className="page-title">Roster</h1>
            <p className="muted roster-fixture">{derivedFixtureLabel(match)}</p>
          </>
        )}
        <p className="muted roster-seed-note">
          Drag or use ↑↓ to set order in each group (e.g. on-field 8, 2, 5, 7). Up to {ON_FIELD_MAX} on field.
        </p>

        {banner ? <p className="error-text">{banner}</p> : null}

        <section className="roster-expand-card roster-squad-card">
          <button
            type="button"
            className="roster-expand-header"
            onClick={() => setSquadExpanded((e) => !e)}
          >
            <span className="roster-expand-title">Your roster</span>
            <span className="muted roster-expand-count">
              On {onC} · Bench {benchC} · Off {offC}
            </span>
            <span className="roster-expand-chevron" aria-hidden>
              {squadExpanded ? '▾' : '▸'}
            </span>
          </button>

          {squadExpanded ? (
            <div className="roster-expand-body">
              <div className="roster-sub-inline">
                <p className="muted roster-sub-meta">
                  Current match clock: <strong>{matchTimeLabel}</strong> ·{' '}
                  Period {session.period}
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => openSubstitutionSheet()}>
                  Record substitution
                </button>
              </div>

              <RosterDragBoard
                players={players}
                displayOrders={displayOrders}
                countOnField={countOnField}
                onMoveToZone={(id, zone, beforeId) => void onMoveToZone(id, zone, beforeId)}
                onReorder={(zone, order) => void saveReordered(zone, order)}
                onMoveInZone={(zone, id, dir) => void onMoveInZone(zone, id, dir)}
                onNameCommit={(id, name) => void onNameCommit(id, name)}
                onRemove={(id) => void onRemovePlayer(id)}
              />
            </div>
          ) : null}
        </section>
      </div>

      <SubstitutionSheet
        open={subOpen}
        onClose={() => setSubOpen(false)}
        onConfirm={() => void confirmSubstitution()}
        matchLabel={`${derivedFixtureLabel(match)} · ${matchTimeLabel}`}
        onField={onField}
        benchOrOff={benchOrOff}
        offId={subOffId}
        onId={subOnId}
        setOffId={setSubOffId}
        setOnId={setSubOnId}
      />
    </div>
  );
}
