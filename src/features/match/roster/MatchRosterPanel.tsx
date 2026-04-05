import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultSessionForMatch, type MatchRecord, type MatchSessionRecord } from '@/domain/match';
import { cumulativeMatchTimeMs, formatClock } from '@/domain/matchClock';
import { countByStatus, dedupeSquadPlayers, sortPlayersRefLogStyle } from '@/domain/rosterDisplay';
import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { ON_FIELD_MAX, SQUAD_MAX } from '@/domain/player';
import { derivedFixtureLabel } from '@/domain/matchDisplay';
import { getMatch, getSession, saveSession } from '@/repos/matchesRepo';
import {
  ensureSevensRoster,
  listPlayers,
  listSubstitutions,
  recordSubstitution,
  removePlayer,
  updatePlayerName,
  updatePlayerStatus,
} from '@/repos/rosterRepo';
import { RosterPlayerCard } from './RosterPlayerCard';
import { SubstitutionHistoryCard } from './SubstitutionHistoryCard';
import { SubstitutionSheet } from './SubstitutionSheet';

type Props = {
  matchId: string;
  /** Called after any roster write so the parent match view can refresh players. */
  onRosterUpdated?: () => void;
  /** When true, omit standalone page title / fixture line (match shell already shows them). */
  embedded?: boolean;
};

export function MatchRosterPanel({ matchId, onRosterUpdated, embedded = false }: Props) {
  const [match, setMatch] = useState<MatchRecord | null | undefined>(undefined);
  const [session, setSession] = useState<MatchSessionRecord | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof listSubstitutions>>>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sortByStatus, setSortByStatus] = useState(true);
  const [subsExpanded, setSubsExpanded] = useState(false);
  const [squadExpanded, setSquadExpanded] = useState(true);
  const [subOpen, setSubOpen] = useState(false);
  const [subOffId, setSubOffId] = useState('');
  const [subOnId, setSubOnId] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const notify = useCallback(() => {
    onRosterUpdated?.();
  }, [onRosterUpdated]);

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
    await ensureSevensRoster(matchId);
    const [plRaw, sb] = await Promise.all([
      listPlayers(matchId, sortByStatus),
      listSubstitutions(matchId),
    ]);
    const pl = sortPlayersRefLogStyle(dedupeSquadPlayers(plRaw), sortByStatus);
    setPlayers(pl);
    setSubs(sb);
  }, [matchId, sortByStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.clockRunning) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [session?.clockRunning]);

  const onField = useMemo(() => players.filter((p) => p.status === 'on'), [players]);
  const benchOrOff = useMemo(
    () => players.filter((p) => p.status === 'bench' || p.status === 'off'),
    [players],
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

  async function onStatusChange(playerId: string, next: PlayerStatus) {
    setBanner(null);
    const r = await updatePlayerStatus(playerId, next);
    if (r === 'toomanyon') {
      setBanner(`At most ${ON_FIELD_MAX} players can be on field.`);
      return;
    }
    await load();
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
    await load();
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
          Sevens roster: numbers 1–{ON_FIELD_MAX} start on field; {SQUAD_MAX - ON_FIELD_MAX} bench. Names are
          optional.
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
              <div className="roster-sort-row">
                <label className="roster-sort-toggle">
                  <input
                    type="checkbox"
                    checked={sortByStatus}
                    onChange={(e) => setSortByStatus(e.target.checked)}
                  />
                  <span>{sortByStatus ? 'Sorted by status' : 'Sorted by number'}</span>
                </label>
              </div>

              <div className="roster-sub-inline">
                <p className="muted roster-sub-meta">
                  Current match clock: <strong>{matchTimeLabel}</strong> ·{' '}
                  Period {session.period}
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => openSubstitutionSheet()}>
                  Record substitution
                </button>
              </div>

              <div className="roster-player-list">
                {players.map((p) => (
                  <RosterPlayerCard
                    key={p.id}
                    player={p}
                    countOnField={countOnField}
                    onNameCommit={(name) => void onNameCommit(p.id, name)}
                    onStatusChange={(s) => void onStatusChange(p.id, s)}
                    onRemove={() => void onRemovePlayer(p.id)}
                  />
                ))}
              </div>
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
