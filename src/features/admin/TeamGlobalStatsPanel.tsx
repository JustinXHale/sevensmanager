import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { computeMatchAnalyticsSnapshot } from '@/domain/matchAnalytics';
import type { MatchEventRecord } from '@/domain/matchEvent';
import { playerInvolvement, ruckSpeedDistribution } from '@/domain/matchAnalyticsDeep';
import { computePlayerEfficiency, type PlayerEfficiencyRow } from '@/domain/lineupEfficiency';
import type { MatchLiveLocationState } from '@/domain/matchNavigation';
import type { MatchRecord } from '@/domain/match';
import type { PlayerRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import type { TeamRecord } from '@/domain/team';
import { ZONE_IDS } from '@/domain/zone';
import { SectionHelp, GLOBAL_GLOSSARY } from '@/components/SectionHelp';
import { aggregateDeepAnalytics, aggregateTeamMatchSnapshots, tackleCompletionPct } from '@/domain/teamGlobalStats';
import { countActiveEventsForMatch, listMatchEvents } from '@/repos/matchEventsRepo';
import { getSession, listMatchesForTeam } from '@/repos/matchesRepo';
import { listPlayers, listSubstitutions } from '@/repos/rosterRepo';
import { formatMatchKickoffInZone, getStoredDisplayTimeZone } from '@/utils/displayTimezone';

type Props = {
  team: TeamRecord;
};

type MatchWithStats = {
  match: MatchRecord;
  eventCount: number;
  events: MatchEventRecord[];
  snapshot: ReturnType<typeof computeMatchAnalyticsSnapshot>;
  playerMinutesMs: Record<string, number> | undefined;
  /** playerId -> stable key (teamMemberId preferred, jersey fallback). */
  playerIdToStableKey: Record<string, string>;
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'points', label: 'Points by game' },
  { id: 'phase', label: 'Offense / Defense' },
  { id: 'zones', label: 'Zone heat map' },
  { id: 'ruck', label: 'Ruck speed' },
  { id: 'penalties', label: 'Penalties' },
  { id: 'negatives', label: 'Negatives' },
  { id: 'players', label: 'Top players' },
  { id: 'lineup', label: 'Lineup efficiency' },
  { id: 'games', label: 'Games' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'] | 'all';

function opponentLabel(m: MatchRecord): string {
  const opp = m.opponentName?.trim();
  return opp ? `vs ${opp}` : m.title?.trim() || 'Game';
}

const RUCK_BUCKET_TONE: Record<string, string> = {
  '< 2s': 'good',
  '2\u20134s': 'ok',
  '4\u20136s': 'warn',
  '6\u20138s': 'bad',
  '8s+': 'bad',
};

const HEAT_ROW_TONE: Record<string, 'bad' | undefined> = {
  tackle_missed: 'bad',
  negative: 'bad',
  penalty: 'bad',
};

function fmtMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function TeamGlobalStatsPanel({ team }: Props) {
  const [loading, setLoading] = useState(true);
  const [matchesTotal, setMatchesTotal] = useState<MatchRecord[]>([]);
  const [withStats, setWithStats] = useState<MatchWithStats[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<Map<string, PlayerRecord>>(new Map());
  const [displayTimeZone] = useState(() => getStoredDisplayTimeZone());
  const [activeSection, setActiveSection] = useState<SectionId>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listMatchesForTeam(team.id);
      setMatchesTotal(all);
      const counted = await Promise.all(
        all.map(async (m) => ({
          match: m,
          eventCount: await countActiveEventsForMatch(m.id),
        })),
      );
      const active = counted.filter((x) => x.eventCount > 0);
      const playerMap = new Map<string, PlayerRecord>();
      const rows = await Promise.all(
        active.map(async ({ match, eventCount }) => {
          const [events, subs, session, matchPlayers] = await Promise.all([
            listMatchEvents(match.id),
            listSubstitutions(match.id),
            getSession(match.id),
            listPlayers(match.id),
          ]);
          const stableKeyMap: Record<string, string> = {};
          for (const p of matchPlayers) {
            playerMap.set(p.id, p);
            if (p.teamMemberId) {
              stableKeyMap[p.id] = p.teamMemberId;
            } else if (p.number != null) {
              stableKeyMap[p.id] = `jersey:${p.number}`;
            }
          }
          return {
            match,
            eventCount,
            events,
            snapshot: computeMatchAnalyticsSnapshot(events, subs.length),
            playerMinutesMs: session?.playerMinutesMs,
            playerIdToStableKey: stableKeyMap,
          } satisfies MatchWithStats;
        }),
      );
      setWithStats(rows);
      setGlobalPlayers(playerMap);
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const aggregate = useMemo(
    () =>
      aggregateTeamMatchSnapshots(
        withStats.map((r) => ({ eventCount: r.eventCount, snapshot: r.snapshot })),
      ),
    [withStats],
  );

  const pooledTacklePct = tackleCompletionPct(aggregate.tacklesMade, aggregate.tacklesMissed);

  const deep = useMemo(
    () => aggregateDeepAnalytics(withStats.map((r) => r.events)),
    [withStats],
  );

  const efficiencyRows = useMemo(
    () =>
      computePlayerEfficiency(
        withStats.map((r) => ({
          events: r.events,
          playerMinutesMs: r.playerMinutesMs,
          playerIdToStableKey: r.playerIdToStableKey,
        })),
      ),
    [withStats],
  );

  const qualifiedRows = useMemo(() => efficiencyRows.filter((r) => r.qualified), [efficiencyRows]);
  const unqualifiedRows = useMemo(() => efficiencyRows.filter((r) => !r.qualified), [efficiencyRows]);

  const maxCombinedPoints = useMemo(() => {
    let max = 1;
    for (const r of withStats) {
      max = Math.max(max, r.snapshot.ownPoints + r.snapshot.oppPoints);
    }
    return max;
  }, [withStats]);

  const statsReturnPath = `/team/${team.id}?tab=stats`;
  const statsReturnEncoded = encodeURIComponent(statsReturnPath);

  if (loading) {
    return (
      <section className="card team-global-stats">
        <h2 className="team-global-stats-title">Global stats</h2>
        <p className="muted">{'Loading\u2026'}</p>
      </section>
    );
  }

  if (matchesTotal.length === 0) {
    return (
      <section className="card team-global-stats">
        <h2 className="team-global-stats-title">Global stats</h2>
        <p className="muted team-global-stats-empty">No games linked to this team yet.</p>
        <p className="team-global-stats-actions">
          <Link to={`/matches/new?teamId=${team.id}&competitionId=${team.competitionId}&returnTo=${encodeURIComponent(`/team/${team.id}?tab=match`)}`} className="btn btn-primary">
            Add game
          </Link>
        </p>
      </section>
    );
  }

  if (withStats.length === 0) {
    return (
      <section className="card team-global-stats">
        <h2 className="team-global-stats-title">Global stats</h2>
        <p className="muted team-global-stats-empty">No games with logged events yet.</p>
        <p className="team-global-stats-actions">
          <Link to={`/team/${team.id}?tab=match`} className="btn btn-secondary">
            Open games
          </Link>
        </p>
      </section>
    );
  }

  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === 'zones') return deep.zoneHeatRows.length > 0;
    if (s.id === 'ruck') return deep.ruckDurations.length > 0;
    if (s.id === 'penalties') return deep.penaltyTypes.length > 0;
    if (s.id === 'negatives') return deep.negativeActions.length > 0;
    if (s.id === 'players') return deep.playerProfiles.size > 0;
    if (s.id === 'phase') return deep.phaseTime != null;
    if (s.id === 'lineup') return efficiencyRows.length > 0;
    return true;
  });

  const current = activeSection === 'all' ? 'all' : (visibleSections.find((s) => s.id === activeSection) ? activeSection : 'all');
  const show = (id: string) => current === 'all' || current === id;
  const sectionTitle = (id: string) => {
    const s = SECTIONS.find((x) => x.id === id);
    if (!s) return null;
    const glossary = GLOBAL_GLOSSARY[id];
    return (
      <div className="tgs-card-title-row">
        <h3 className="tgs-card-title">{s.label}</h3>
        {glossary && <SectionHelp title={s.label} entries={glossary} />}
      </div>
    );
  };

  return (
    <div className="tgs-root">
      <div className="tgs-header">
        <h2 className="team-global-stats-title">Global stats</h2>
        <select
          className="filter-select tgs-section-select"
          value={current}
          onChange={(e) => setActiveSection(e.target.value as SectionId)}
          aria-label="Section"
        >
          <option value="all">All sections</option>
          {visibleSections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Overview KPIs */}
      {show('overview') && (
        <section className="card tgs-card">
          {sectionTitle('overview')}
          <div className="team-global-kpi-row">
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Games</span>
              <span className="team-global-kpi-value tabular-nums">{aggregate.gameCount}</span>
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Events</span>
              <span className="team-global-kpi-value tabular-nums">{aggregate.totalEvents}</span>
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">{`Points (\u03a3)`}</span>
              <span className="team-global-kpi-value tabular-nums">
                {aggregate.sumOwnPoints}{' \u2013 '}{aggregate.sumOppPoints}
              </span>
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">{`Tries (\u03a3)`}</span>
              <span className="team-global-kpi-value tabular-nums">
                {aggregate.sumOwnTries}{' \u2013 '}{aggregate.sumOppTries}
              </span>
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Tackle % (pooled)</span>
              <span className="team-global-kpi-value tabular-nums">
                {pooledTacklePct != null ? `${pooledTacklePct}%` : '\u2014'}
              </span>
              <span className="team-global-kpi-sub muted">
                {aggregate.tacklesMade}{'M \u00b7 '}{aggregate.tacklesMissed}X
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Points by game */}
      {show('points') && (
        <section className="card tgs-card">
          {sectionTitle('points')}
          <ul className="tgs-points-list" aria-label="Points per game">
            {withStats.map((r) => {
              const own = r.snapshot.ownPoints;
              const opp = r.snapshot.oppPoints;
              const combined = own + opp;
              const barWidthPct = maxCombinedPoints > 0 ? (combined / maxCombinedPoints) * 100 : 0;
              return (
                <li key={r.match.id} className="tgs-points-row">
                  <span className="tgs-points-name">{opponentLabel(r.match)}</span>
                  <div className="tgs-points-bar-outer" aria-hidden>
                    <div className="tgs-points-bar-inner" style={{ width: `${barWidthPct}%` }}>
                      {combined > 0 ? (
                        <>
                          <div className="tgs-points-seg tgs-points-seg--us" style={{ flex: own }} />
                          <div className="tgs-points-seg tgs-points-seg--opp" style={{ flex: opp }} />
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className="tgs-points-score tabular-nums">{own}{'\u2013'}{opp}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Offense / Defense time */}
      {show('phase') && deep.phaseTime && (
        <section className="card tgs-card">
          {sectionTitle('phase')}
          <div className="tgs-phase-bar-wrap">
            <div className="tgs-phase-bar">
              <div className="tgs-phase-seg tgs-phase-seg--off" style={{ flex: deep.phaseTime.offenseMs }} />
              <div className="tgs-phase-seg tgs-phase-seg--def" style={{ flex: deep.phaseTime.defenseMs }} />
            </div>
          </div>
          <div className="tgs-phase-legend">
            <div className="tgs-phase-stat">
              <span className="tgs-phase-dot tgs-phase-dot--off" />
              <span className="tgs-phase-label">Offense</span>
              <span className="tgs-phase-value tabular-nums">{deep.phaseTime.offensePct}%</span>
              <span className="tgs-phase-time muted tabular-nums">{fmtMs(deep.phaseTime.offenseMs)}</span>
            </div>
            <div className="tgs-phase-stat">
              <span className="tgs-phase-dot tgs-phase-dot--def" />
              <span className="tgs-phase-label">Defense</span>
              <span className="tgs-phase-value tabular-nums">{deep.phaseTime.defensePct}%</span>
              <span className="tgs-phase-time muted tabular-nums">{fmtMs(deep.phaseTime.defenseMs)}</span>
            </div>
          </div>
          <p className="muted tgs-card-sub" style={{ marginTop: '0.35rem' }}>
            Estimated from event classification across all logged games. Gaps &gt; 90 s are capped.
          </p>
        </section>
      )}

      {/* Zone heat map */}
      {show('zones') && deep.zoneHeatRows.length > 0 && (
        <section className="card tgs-card">
          {sectionTitle('zones')}
          <div className="deep-heat-table" role="table" aria-label="Zone heat map across games">
            <div className="deep-heat-header" role="row">
              <span className="deep-heat-label" role="columnheader" />
              {ZONE_IDS.map((z) => (
                <span key={z} className="deep-heat-zh" role="columnheader">{z}</span>
              ))}
              <span className="deep-heat-zh deep-heat-zh--total" role="columnheader">{'\u03a3'}</span>
            </div>
            {deep.zoneHeatRows.map((row) => {
              const rowMax = Math.max(...ZONE_IDS.map((z) => row.zones[z]));
              const tone = HEAT_ROW_TONE[row.kind];
              return (
                <div key={row.kind} className={`deep-heat-row${tone ? ` deep-heat-row--${tone}` : ''}`} role="row">
                  <span className="deep-heat-label" role="rowheader">{row.label}</span>
                  {ZONE_IDS.map((z) => {
                    const v = row.zones[z];
                    const pct = rowMax > 0 ? v / rowMax : 0;
                    const cls = tone
                      ? (pct >= 0.75 ? 'deep-heat-z deep-heat-z--bad-4' : pct >= 0.5 ? 'deep-heat-z deep-heat-z--bad-3' : pct >= 0.25 ? 'deep-heat-z deep-heat-z--bad-2' : v > 0 ? 'deep-heat-z deep-heat-z--bad-1' : 'deep-heat-z deep-heat-z--0')
                      : (pct >= 0.75 ? 'deep-heat-z deep-heat-z--4' : pct >= 0.5 ? 'deep-heat-z deep-heat-z--3' : pct >= 0.25 ? 'deep-heat-z deep-heat-z--2' : v > 0 ? 'deep-heat-z deep-heat-z--1' : 'deep-heat-z deep-heat-z--0');
                    return (
                      <span key={z} className={cls} role="cell">{v > 0 ? v : ''}</span>
                    );
                  })}
                  <span className="deep-heat-z deep-heat-z--total" role="cell">{row.total}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Ruck speed */}
      {show('ruck') && deep.ruckDurations.length > 0 && (() => {
        const dist = ruckSpeedDistribution(deep.ruckDurations);
        const distMax = Math.max(1, ...dist.map((b) => b.count));
        return (
          <section className="card tgs-card">
            {sectionTitle('ruck')}
            <div className="deep-ruck-kpis">
              <div className="deep-ruck-kpi">
                <span className="deep-ruck-kpi-value">{(deep.ruckMedianMs! / 1000).toFixed(1)}s</span>
                <span className="deep-ruck-kpi-label">Median</span>
              </div>
              <div className="deep-ruck-kpi">
                <span className="deep-ruck-kpi-value">{deep.ruckDurations.length}</span>
                <span className="deep-ruck-kpi-label">Pairs</span>
              </div>
            </div>
            <div className="deep-ruck-dist">
              {dist.map((b) => {
                const tone = RUCK_BUCKET_TONE[b.label] ?? 'ok';
                return (
                  <div key={b.label} className="deep-ruck-bucket">
                    <div className="deep-ruck-bucket-bar-wrap">
                      <div
                        className={`deep-ruck-bucket-bar deep-ruck-bucket-bar--${tone}`}
                        style={{ height: `${Math.round((b.count / distMax) * 100)}%` }}
                      />
                    </div>
                    <span className="deep-ruck-bucket-count tabular-nums">{b.count}</span>
                    <span className="deep-ruck-bucket-label muted">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Penalty breakdown */}
      {show('penalties') && deep.penaltyTypes.length > 0 && (() => {
        const max = Math.max(1, ...deep.penaltyTypes.map((r) => r.count));
        return (
          <section className="card tgs-card">
            {sectionTitle('penalties')}
            <div className="deep-penalty-list">
              {deep.penaltyTypes.map((r) => (
                <div key={r.type} className="deep-penalty-row">
                  <span className="deep-penalty-label">{r.label}</span>
                  <div className="deep-penalty-bar-track">
                    <div className="deep-penalty-bar-fill" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
                  </div>
                  <span className="deep-penalty-count tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Negative actions */}
      {show('negatives') && deep.negativeActions.length > 0 && (() => {
        const max = Math.max(1, ...deep.negativeActions.map((r) => r.count));
        return (
          <section className="card tgs-card">
            {sectionTitle('negatives')}
            <div className="deep-penalty-list">
              {deep.negativeActions.map((r) => (
                <div key={r.id} className="deep-penalty-row">
                  <span className="deep-penalty-label">{r.label}</span>
                  <div className="deep-penalty-bar-track">
                    <div className="deep-penalty-bar-fill deep-penalty-bar-fill--neg" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
                  </div>
                  <span className="deep-penalty-count tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Top players */}
      {show('players') && deep.playerProfiles.size > 0 && (() => {
        const sorted = [...deep.playerProfiles.values()].sort((a, b) => playerInvolvement(b) - playerInvolvement(a)).slice(0, 15);
        return (
          <section className="card tgs-card">
            {sectionTitle('players')}
            <p className="muted tgs-card-sub">Ranked by involvement: passes + tackles + breaks + tries + negatives + penalties.</p>
            <div className="deep-player-list">
              {sorted.map((p) => {
                const player = globalPlayers.get(p.playerId);
                const label = player ? formatPlayerLabel(player) : p.playerId;
                const tMade = p.tackles.made;
                const tMissed = p.tackles.missed;
                return (
                  <div key={p.playerId} className="deep-player-card">
                    <div className="deep-player-summary" style={{ cursor: 'default' }}>
                      <span className="deep-player-name">{label}</span>
                      <span className="deep-player-chips">
                        {p.passes > 0 && <span className="deep-chip">{p.passes}P</span>}
                        {tMade + tMissed > 0 && <span className="deep-chip">{tMade}T{tMissed > 0 ? ` ${tMissed}X` : ''}</span>}
                        {p.lineBreaks > 0 && <span className="deep-chip deep-chip--good">{p.lineBreaks}LB</span>}
                        {p.tries > 0 && <span className="deep-chip deep-chip--good">{p.tries}Tr</span>}
                        {p.negatives > 0 && <span className="deep-chip deep-chip--bad">{p.negatives}Neg</span>}
                        {p.penalties > 0 && <span className="deep-chip deep-chip--bad">{p.penalties}Pen</span>}
                      </span>
                      <span className="deep-player-inv muted">{playerInvolvement(p)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Lineup efficiency */}
      {show('lineup') && efficiencyRows.length > 0 && (() => {
        const starters = qualifiedRows.slice(0, 7);
        const bench = qualifiedRows.slice(7);
        const fmtMin = (ms: number) => `${Math.round(ms / 60_000)}m`;
        const effLabel = (r: PlayerEfficiencyRow) => {
          const player = globalPlayers.get(r.representativePlayerId);
          return player ? formatPlayerLabel(player) : r.playerKey;
        };
        const statLine = (p: PlayerEfficiencyRow['profile']) => {
          const parts: string[] = [];
          if (p.tries > 0) parts.push(`${p.tries}Tr`);
          if (p.lineBreaks > 0) parts.push(`${p.lineBreaks}LB`);
          parts.push(`${p.tackles.made}T`);
          if (p.tackles.missed > 0) parts.push(`${p.tackles.missed}X`);
          parts.push(`${p.passes}P`);
          if (p.negatives > 0) parts.push(`${p.negatives}Neg`);
          if (p.penalties > 0) parts.push(`${p.penalties}Pen`);
          return parts.join(' \u00b7 ');
        };
        const EffRow = ({ r, rank, variant }: { r: PlayerEfficiencyRow; rank: number | null; variant: 'starter' | 'bench' | 'unqualified' }) => (
          <div className={`le-row le-row--${variant}`}>
            <span className={`le-rank${variant === 'starter' ? ' le-rank--starter' : variant === 'unqualified' ? ' le-rank--na' : ''}`}>
              {rank ?? '\u2014'}
            </span>
            <div className="le-body">
              <div className="le-top">
                <span className="le-name">{effLabel(r)}</span>
                {variant !== 'unqualified' && (
                  <>
                    <div className="le-score-wrap">
                      <div className={`le-score-bar${variant === 'bench' ? ' le-score-bar--bench' : ''}`} style={{ width: `${r.globalScore}%` }} />
                    </div>
                    <span className={`le-score-value tabular-nums${variant === 'bench' ? ' muted' : ''}`}>{r.globalScore}</span>
                    <span className={`le-consistency le-consistency--${r.consistency}`} title={r.consistency} />
                  </>
                )}
              </div>
              <div className="le-bottom muted">
                {variant !== 'unqualified' && <span className="le-stats">{statLine(r.profile)}</span>}
                <span className="le-meta tabular-nums">{r.gamesPlayed}G{' \u00b7 '}{fmtMin(r.minutesPlayedMs)}</span>
              </div>
            </div>
          </div>
        );
        return (
          <section className="card tgs-card">
            {sectionTitle('lineup')}

            {starters.length > 0 && (
              <>
                <h4 className="tgs-card-subtitle">Recommended starting 7</h4>
                <div className="le-list">
                  {starters.map((r, i) => (
                    <EffRow key={r.playerKey} r={r} rank={i + 1} variant="starter" />
                  ))}
                </div>
              </>
            )}

            {bench.length > 0 && (
              <>
                <h4 className="tgs-card-subtitle" style={{ marginTop: '0.75rem' }}>Bench / depth</h4>
                <div className="le-list">
                  {bench.map((r, i) => (
                    <EffRow key={r.playerKey} r={r} rank={starters.length + i + 1} variant="bench" />
                  ))}
                </div>
              </>
            )}

            {unqualifiedRows.length > 0 && (
              <details className="le-unqualified" style={{ marginTop: '0.65rem' }}>
                <summary className="muted">Insufficient data ({unqualifiedRows.length})</summary>
                <div className="le-list">
                  {unqualifiedRows.map((r) => (
                    <EffRow key={r.playerKey} r={r} rank={null} variant="unqualified" />
                  ))}
                </div>
              </details>
            )}

            <details className="le-formula" style={{ marginTop: '0.5rem' }}>
              <summary className="muted">How is the score calculated?</summary>
              <div className="le-formula-body muted">
                <p>
                  Score = (positive points {'\u2212'} negative costs) / minutes played, scaled 0{'\u2013'}100 against the top player.
                </p>
                <div className="le-formula-cols">
                  <div>
                    <strong className="le-formula-heading le-formula-heading--pos">Positive</strong>
                    <ul className="le-formula-list">
                      <li>Try: +5</li>
                      <li>Line break: +4</li>
                      <li>Conversion made: +3</li>
                      <li>Tackle (dom): +3</li>
                      <li>Tackle (neu): +2</li>
                      <li>Tackle (pas): +1</li>
                      <li>Offload: +1.5</li>
                      <li>Pass: +0.5</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="le-formula-heading le-formula-heading--neg">Negative</strong>
                    <ul className="le-formula-list">
                      <li>Red card: {'\u2212'}10</li>
                      <li>Yellow card: {'\u2212'}5</li>
                      <li>Penalty: {'\u2212'}3</li>
                      <li>Tackle missed: {'\u2212'}2</li>
                      <li>Negative (KO, etc.): {'\u2212'}2</li>
                      <li>Conv. missed: {'\u2212'}1</li>
                    </ul>
                  </div>
                </div>
                <p>
                  Minimum: 2 games + 10 min total.{' '}
                  <span className="le-consistency le-consistency--steady" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> steady = all games within 1 stddev.{' '}
                  <span className="le-consistency le-consistency--variable" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> variable = scores fluctuate.
                </p>
              </div>
            </details>
          </section>
        );
      })()}

      {/* Games list */}
      {show('games') && (
        <section className="card tgs-card">
          {sectionTitle('games')}
          <ul className="team-global-game-list">
            {withStats.map((r) => {
              const m = r.match;
              const kickoffLabel = m.kickoffDate ? formatMatchKickoffInZone(m.kickoffDate, displayTimeZone) : null;
              return (
                <li key={m.id} className="team-global-game-row">
                  <div className="team-global-game-main">
                    <span className="team-global-game-title">{opponentLabel(m)}</span>
                    {kickoffLabel ? <span className="team-global-game-meta muted">{kickoffLabel}</span> : null}
                    <span className="team-global-game-meta muted">
                      {r.eventCount} {r.eventCount === 1 ? 'event' : 'events'}{' \u00b7 '}{r.snapshot.ownPoints}{'\u2013'}{r.snapshot.oppPoints} pts
                    </span>
                  </div>
                  <Link
                    className="btn btn-secondary btn-small team-global-game-link"
                    to={{
                      pathname: `/match/${m.id}`,
                      search: `?tab=stats&returnTo=${statsReturnEncoded}`,
                    }}
                    state={{ matchesReturnTo: statsReturnPath } satisfies MatchLiveLocationState}
                  >
                    Stats
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
