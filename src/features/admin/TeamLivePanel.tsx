import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MatchLiveLocationState } from '@/domain/matchNavigation';
import { derivedFixtureLabel } from '@/domain/matchDisplay';
import type { MatchRecord } from '@/domain/match';
import type { TeamRecord } from '@/domain/team';
import { countActiveMatchEventsByMatchId } from '@/repos/matchEventsRepo';
import { listMatchesForTeam } from '@/repos/matchesRepo';
import {
  DISPLAY_TIMEZONE_OPTIONS,
  DISPLAY_TIMEZONE_STORAGE_KEY,
  formatMatchKickoffInZone,
  getStoredDisplayTimeZone,
  setStoredDisplayTimeZone,
} from '@/utils/displayTimezone';

type Props = {
  team: TeamRecord;
};

/**
 * Match-centric entry: list team games; add / upload via sticky footer.
 */
export function TeamLivePanel({ team }: Props) {
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [eventCountsByMatchId, setEventCountsByMatchId] = useState<Map<string, number>>(() => new Map());
  const [displayTimeZone, setDisplayTimeZone] = useState(() => getStoredDisplayTimeZone());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  const deviceTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const timeZoneSelectOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    const add = (value: string, label: string) => {
      if (seen.has(value)) return;
      seen.add(value);
      out.push({ value, label });
    };
    if (!DISPLAY_TIMEZONE_OPTIONS.some((o) => o.value === deviceTimeZone)) {
      add(deviceTimeZone, 'This device');
    }
    for (const o of DISPLAY_TIMEZONE_OPTIONS) add(o.value, o.label);
    if (!seen.has(displayTimeZone)) add(displayTimeZone, displayTimeZone);
    return out;
  }, [deviceTimeZone, displayTimeZone]);

  const onTimeZoneChange = useCallback((value: string) => {
    setStoredDisplayTimeZone(value);
    setDisplayTimeZone(value);
  }, []);

  const returnToTeamMatch = encodeURIComponent(`/team/${team.id}?tab=match`);
  const newMatchHref = `/matches/new?teamId=${team.id}&competitionId=${team.competitionId}&returnTo=${returnToTeamMatch}`;
  const importHref = `/matches/import?returnTo=${returnToTeamMatch}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [rows, countMap] = await Promise.all([listMatchesForTeam(team.id), countActiveMatchEventsByMatchId()]);
      if (cancelled) return;
      setMatches(rows);
      setEventCountsByMatchId(countMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISPLAY_TIMEZONE_STORAGE_KEY) {
        setDisplayTimeZone(getStoredDisplayTimeZone());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      void countActiveMatchEventsByMatchId().then((m) => setEventCountsByMatchId(m));
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div className="team-live-panel">
      <div className="team-live-panel-scroll">
        {matches === null ? (
          <p className="muted">Loading games…</p>
        ) : matches.length === 0 ? (
          <div className="card empty-card">
            <p className="muted">No games linked to this team yet. Create one to start logging.</p>
          </div>
        ) : (
          <>
            <div className="team-live-tz-bar">
              <label className="team-live-tz-label">
                <span className="team-live-tz-label-text">Kickoff times</span>
                <select
                  className="filter-select team-live-tz-select"
                  value={displayTimeZone}
                  onChange={(e) => onTimeZoneChange(e.target.value)}
                  aria-label="Time zone for kickoff times"
                >
                  {timeZoneSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="match-list">
              {matches.map((m) => {
                const eventCount = eventCountsByMatchId.get(m.id) ?? 0;
                const kickoffLabel = m.kickoffDate
                  ? formatMatchKickoffInZone(m.kickoffDate, displayTimeZone)
                  : null;
                const matchesReturnTo = `/team/${team.id}?tab=match`;
                return (
                  <li key={m.id} className="match-row">
                    <Link
                      to={{
                        pathname: `/match/${m.id}`,
                        search: `?returnTo=${encodeURIComponent(matchesReturnTo)}`,
                      }}
                      state={
                        {
                          matchesReturnTo,
                        } satisfies MatchLiveLocationState
                      }
                      className="match-row-main"
                      aria-label={`${derivedFixtureLabel(m)} — ${eventCount} ${eventCount === 1 ? 'event' : 'events'} logged`}
                    >
                      <span className="match-title">{derivedFixtureLabel(m)}</span>
                      {m.title.trim() !== derivedFixtureLabel(m).trim() ? (
                        <span className="match-meta">{m.title}</span>
                      ) : null}
                      {kickoffLabel ? <span className="match-meta">{kickoffLabel}</span> : null}
                      <span className="match-meta match-meta-events">
                        {eventCount} {eventCount === 1 ? 'event' : 'events'} logged
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="competitions-sticky-footer" role="toolbar" aria-label="Add games">
        <Link to={newMatchHref} className="btn btn-primary competitions-sticky-main">
          Add game
        </Link>
        <div className="competitions-sticky-menu-wrap" ref={menuWrapRef}>
          <button
            type="button"
            className="btn btn-secondary competitions-sticky-caret"
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ▾
          </button>
          {menuOpen ? (
            <ul className="competitions-sticky-dropdown" role="menu">
              <li role="none">
                <Link
                  to={importHref}
                  className="competitions-sticky-dropdown-item"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  Upload schedule
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
