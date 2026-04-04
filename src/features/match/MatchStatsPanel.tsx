import { useId, useMemo, useState } from 'react';
import { computeMatchAnalyticsSnapshot } from '@/domain/matchAnalytics';
import { kickDecidedSuccessPct, type SetPieceSplit } from '@/domain/matchAnalytics';
import { formatClock } from '@/domain/matchClock';
import type { MatchEventKind, MatchEventRecord } from '@/domain/matchEvent';
import { formatMatchEventSummary } from '@/domain/matchEventDisplay';
import {
  buildPlayerProfiles,
  buildZoneHeatRows,
  negativeActionBreakdown,
  penaltyCountByType,
  phaseTimeSplit,
  playerInvolvement,
  ruckSpeedDistribution,
  ruckSpeedMedianMs,
  scoringTimeline,
  setPieceByPhase,
  type PlayerProfile,
} from '@/domain/matchAnalyticsDeep';
import {
  countEventsByKind,
  eventsOfKind,
  kindLabel,
  ruckToFirstPassDurationsMs,
  sortMatchEventsByTime,
  sortSubstitutionsByTime,
  tackleEventsMadeList,
  tackleEventsMissedList,
  tackleMadeMissed,
  triesByZone,
  triesAndConversionsByPlayer,
  tryEventsInZone,
} from '@/domain/matchStats';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import { ZONE_IDS, type ZoneId } from '@/domain/zone';
import { SectionHelp, MATCH_GLOSSARY } from '@/components/SectionHelp';

type Props = {
  events: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById: Map<string, PlayerRecord>;
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'phase', label: 'Offense / Defense' },
  { id: 'zones', label: 'Zone heat map' },
  { id: 'involvement', label: 'Involvement' },
  { id: 'ruck', label: 'Ruck speed' },
  { id: 'setpieces', label: 'Set pieces' },
  { id: 'penalties', label: 'Penalties' },
  { id: 'negatives', label: 'Negatives' },
  { id: 'scoring', label: 'Scoring timeline' },
  { id: 'numbers', label: 'Event counts' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'] | 'all';

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

const KIND_ORDER: MatchEventKind[] = [
  'try', 'conversion', 'opponent_try', 'opponent_conversion',
  'opponent_substitution', 'opponent_card', 'pass', 'line_break',
  'negative_action', 'scrum', 'lineout', 'team_penalty', 'ruck',
];

function fmtMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtMin(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}


type PanelPayload =
  | { type: 'events'; items: MatchEventRecord[] }
  | { type: 'subs'; items: SubstitutionRecord[] };

function getPanelPayload(
  key: string,
  events: MatchEventRecord[],
  substitutions: SubstitutionRecord[],
): PanelPayload {
  if (key === 'subs') return { type: 'subs', items: sortSubstitutionsByTime(substitutions) };
  if (key.startsWith('kind:')) {
    const kind = key.slice(5) as MatchEventKind;
    return { type: 'events', items: sortMatchEventsByTime(eventsOfKind(events, kind)) };
  }
  if (key === 'tackle:made') return { type: 'events', items: sortMatchEventsByTime(tackleEventsMadeList(events)) };
  if (key === 'tackle:missed') return { type: 'events', items: sortMatchEventsByTime(tackleEventsMissedList(events)) };
  if (key.startsWith('zone:')) {
    const zoneId = key.slice(5) as ZoneId;
    return { type: 'events', items: sortMatchEventsByTime(tryEventsInZone(events, zoneId)) };
  }
  return { type: 'events', items: [] };
}

function formatSubLine(s: SubstitutionRecord, playersById: Map<string, PlayerRecord>): string {
  const offP = playersById.get(s.playerOffId);
  const onP = playersById.get(s.playerOnId);
  const off = offP ? formatPlayerLabel(offP) : 'Off';
  const on = onP ? formatPlayerLabel(onP) : 'On';
  return `P${s.period} ${formatClock(s.matchTimeMs)} \u00b7 ${off} \u2192 ${on}`;
}

function StatExpandContent({
  payload,
  playersById,
  empty,
}: {
  payload: PanelPayload;
  playersById: Map<string, PlayerRecord>;
  empty: string;
}) {
  if (payload.type === 'events') {
    if (payload.items.length === 0) return <p className="muted live-stats-expand-empty">{empty}</p>;
    return (
      <ul className="live-stats-expand-list">
        {payload.items.map((e) => (
          <li key={e.id} className="live-stats-expand-row">
            <span className="live-stats-expand-time">P{e.period} {formatClock(e.matchTimeMs)}</span>
            <span className="live-stats-expand-text">{formatMatchEventSummary(e, playersById)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (payload.items.length === 0) return <p className="muted live-stats-expand-empty">{empty}</p>;
  return (
    <ul className="live-stats-expand-list">
      {payload.items.map((s) => (
        <li key={s.id} className="live-stats-expand-row">
          <span className="live-stats-expand-text">{formatSubLine(s, playersById)}</span>
        </li>
      ))}
    </ul>
  );
}

function expandPanelTitle(key: string): string {
  if (key === 'subs') return 'Substitutions';
  if (key === 'tackle:made') return 'Tackles made';
  if (key === 'tackle:missed') return 'Tackles missed';
  if (key.startsWith('kind:')) return kindLabel(key.slice(5) as MatchEventKind);
  if (key.startsWith('zone:')) return `Tries \u00b7 ${key.slice(5)}`;
  return 'Events';
}

function StatCard({
  statKey,
  value,
  label,
  wide,
  expandedKey,
  onToggle,
  idPrefix,
  events,
  substitutions,
  playersById,
}: {
  statKey: string;
  value: number;
  label: string;
  wide?: boolean;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  idPrefix: string;
  events: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById: Map<string, PlayerRecord>;
}) {
  const open = expandedKey === statKey;
  const panelId = `${idPrefix}-${statKey.replace(/:/g, '-')}`;
  const payload = open ? getPanelPayload(statKey, events, substitutions) : null;

  return (
    <div className={`live-stats-cell-wrap${open ? ' live-stats-cell-wrap--expanded' : ''}${wide ? ' live-stats-cell-wrap--wide' : ''}`}>
      <button
        type="button"
        className={`live-stats-cell live-stats-cell--btn${open ? ' live-stats-cell--open' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => onToggle(statKey)}
      >
        <span className="live-stats-num">{value}</span>
        <span className="live-stats-label">{label}</span>
      </button>
      {open && payload ? (
        <div id={panelId} className="live-stats-cell-body" role="region" aria-label={expandPanelTitle(statKey)}>
          <StatExpandContent payload={payload} playersById={playersById} empty="No matching log entries." />
        </div>
      ) : null}
    </div>
  );
}

function SetPieceBar({ label, split }: { label: string; split: SetPieceSplit }) {
  const n = split.won + split.lost + split.penalized;
  return (
    <div className="live-analytics-setpiece-row">
      <div className="live-analytics-setpiece-top">
        <span className="live-analytics-setpiece-name">{label}</span>
        {n === 0 ? (
          <span className="live-analytics-setpiece-empty muted">{'\u2014'}</span>
        ) : (
          <span className="live-analytics-setpiece-nums tabular-nums">
            W {split.won} {'\u00b7'} L {split.lost} {'\u00b7'} Pen {split.penalized}
          </span>
        )}
      </div>
      {n > 0 ? (
        <div className="live-analytics-setpiece-bar" role="img" aria-label={`${label}: ${split.won} won, ${split.lost} lost, ${split.penalized} penalized`}>
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--won" style={{ flex: Math.max(0, split.won) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--lost" style={{ flex: Math.max(0, split.lost) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--pen" style={{ flex: Math.max(0, split.penalized) }} />
        </div>
      ) : null}
    </div>
  );
}

export function MatchStatsPanel({ events, substitutions, playersById }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const idPrefix = useId().replace(/:/g, '');

  const byKind = countEventsByKind(events);
  const { made: tacklesMade, missed: tacklesMissed } = tackleMadeMissed(events);
  const triesZ = triesByZone(events);

  const snapshot = useMemo(
    () => computeMatchAnalyticsSnapshot(events, substitutions.length),
    [events, substitutions.length],
  );

  const heatRows = useMemo(() => buildZoneHeatRows(events), [events]);
  const profiles = useMemo(() => buildPlayerProfiles(events), [events]);
  const penTypes = useMemo(() => penaltyCountByType(events), [events]);
  const negActions = useMemo(() => negativeActionBreakdown(events), [events]);
  const ruckDurations = useMemo(() => ruckToFirstPassDurationsMs(events), [events]);
  const ruckMedian = useMemo(() => ruckSpeedMedianMs(ruckDurations), [ruckDurations]);
  const phaseTime = useMemo(() => phaseTimeSplit(events), [events]);
  const timeline = useMemo(() => scoringTimeline(events), [events]);

  const scrumPhase = useMemo(() => setPieceByPhase(events, 'scrum'), [events]);
  const scrumAtk = scrumPhase.attack;
  const scrumDef = scrumPhase.defense;
  const scrumOurWon = scrumAtk.won;
  const scrumDefWon = scrumDef.won;
  const scrumTotal = scrumAtk.won + scrumAtk.lost + scrumAtk.penalized + scrumDef.won + scrumDef.lost + scrumDef.penalized;

  const scoring = triesAndConversionsByPlayer(events);
  const scoringRows = [...scoring.entries()]
    .map(([id, v]) => ({
      id,
      label: playersById.get(id) ? formatPlayerLabel(playersById.get(id)!) : id,
      ...v,
    }))
    .filter((r) => r.tries > 0 || r.conversions > 0)
    .sort((a, b) => b.tries + b.conversions - (a.tries + a.conversions));

  const hasAnyData = events.length > 0 || substitutions.length > 0;

  const tt = snapshot.tackles.made + snapshot.tackles.missed;
  const tacklePct = tt > 0 ? Math.round((snapshot.tackles.made / tt) * 1000) / 10 : null;
  const ownKickPct = kickDecidedSuccessPct(snapshot.ownKick.made, snapshot.ownKick.missed);
  const oppKickPct = kickDecidedSuccessPct(snapshot.oppKick.made, snapshot.oppKick.missed);

  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === 'zones') return heatRows.length > 0;
    if (s.id === 'involvement') return profiles.size > 0;
    if (s.id === 'ruck') return ruckDurations.length > 0;
    if (s.id === 'penalties') return penTypes.length > 0;
    if (s.id === 'negatives') return negActions.length > 0;
    if (s.id === 'phase') return phaseTime != null;
    if (s.id === 'scoring') return timeline.length > 0;
    return true;
  });

  const current = activeSection === 'all' ? 'all' : (visibleSections.find((s) => s.id === activeSection) ? activeSection : 'all');
  const show = (id: string) => current === 'all' || current === id;
  const sectionTitle = (id: string) => {
    const s = SECTIONS.find((x) => x.id === id);
    if (!s) return null;
    const glossary = MATCH_GLOSSARY[id];
    return (
      <div className="tgs-card-title-row">
        <h3 className="tgs-card-title">{s.label}</h3>
        {glossary && <SectionHelp title={s.label} entries={glossary} />}
      </div>
    );
  };

  function toggleExpand(key: string) {
    setExpandedKey((k) => (k === key ? null : key));
  }

  if (!hasAnyData) {
    return (
      <section className="card live-stats-card">
        <h2 className="live-stats-title">Match analytics</h2>
        <p className="muted">No data yet. Log events on the Tracking tab.</p>
      </section>
    );
  }

  return (
    <div className="tgs-root">
      <div className="tgs-header">
        <h2 className="team-global-stats-title">Match analytics</h2>
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

      {/* Overview */}
      {show('overview') && (
        <section className="card tgs-card">
          {sectionTitle('overview')}
          <div className="team-global-kpi-row">
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Points</span>
              <span className="team-global-kpi-value tabular-nums">
                {snapshot.ownPoints}{' \u2013 '}{snapshot.oppPoints}
              </span>
              {snapshot.ownPoints !== snapshot.oppPoints && (
                <span className="team-global-kpi-sub muted">
                  {'\u0394 '}{snapshot.ownPoints - snapshot.oppPoints > 0 ? '+' : ''}{snapshot.ownPoints - snapshot.oppPoints}
                </span>
              )}
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Tries</span>
              <span className="team-global-kpi-value tabular-nums">
                {snapshot.ownTries}{' \u2013 '}{snapshot.oppTries}
              </span>
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Conv. kick %</span>
              <span className="team-global-kpi-value tabular-nums">
                {ownKickPct != null ? `${ownKickPct}%` : '\u2014'}{' / '}{oppKickPct != null ? `${oppKickPct}%` : '\u2014'}
              </span>
              <span className="team-global-kpi-sub muted">Us / Opp</span>
            </div>
            <div className="team-global-kpi">
              <span className="team-global-kpi-label">Tackle %</span>
              <span className="team-global-kpi-value tabular-nums">
                {tacklePct != null ? `${tacklePct}%` : '\u2014'}
              </span>
              <span className="team-global-kpi-sub muted">
                {snapshot.tackles.made}{'M \u00b7 '}{snapshot.tackles.missed}X
              </span>
            </div>
          </div>

          <div className="live-analytics-compare" aria-label="Subs and discipline" style={{ marginTop: '0.6rem' }}>
            <CompareRow label="Subs" left={snapshot.subsOurs} right={snapshot.subsOpp} />
            <CompareRow label="YC" left={snapshot.cardsOurs.yc} right={snapshot.cardsOpp.yc} tone="yc" />
            <CompareRow label="RC" left={snapshot.cardsOurs.rc} right={snapshot.cardsOpp.rc} tone="rc" />
          </div>
        </section>
      )}

      {/* Offense / Defense */}
      {show('phase') && phaseTime && (
        <section className="card tgs-card">
          {sectionTitle('phase')}
          <div className="tgs-phase-bar-wrap">
            <div className="tgs-phase-bar">
              <div className="tgs-phase-seg tgs-phase-seg--off" style={{ flex: phaseTime.offenseMs }} />
              <div className="tgs-phase-seg tgs-phase-seg--def" style={{ flex: phaseTime.defenseMs }} />
            </div>
          </div>
          <div className="tgs-phase-legend">
            <div className="tgs-phase-stat">
              <span className="tgs-phase-dot tgs-phase-dot--off" />
              <span className="tgs-phase-label">Offense</span>
              <span className="tgs-phase-value tabular-nums">{phaseTime.offensePct}%</span>
              <span className="tgs-phase-time muted tabular-nums">{fmtMs(phaseTime.offenseMs)}</span>
            </div>
            <div className="tgs-phase-stat">
              <span className="tgs-phase-dot tgs-phase-dot--def" />
              <span className="tgs-phase-label">Defense</span>
              <span className="tgs-phase-value tabular-nums">{phaseTime.defensePct}%</span>
              <span className="tgs-phase-time muted tabular-nums">{fmtMs(phaseTime.defenseMs)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Zone heat map */}
      {show('zones') && heatRows.length > 0 && (
        <section className="card tgs-card">
          {sectionTitle('zones')}
          <div className="deep-heat-table" role="table" aria-label="Zone heat map">
            <div className="deep-heat-header" role="row">
              <span className="deep-heat-label" role="columnheader" />
              {ZONE_IDS.map((z) => (
                <span key={z} className="deep-heat-zh" role="columnheader">{z}</span>
              ))}
              <span className="deep-heat-zh deep-heat-zh--total" role="columnheader">{'\u03a3'}</span>
            </div>
            {heatRows.map((row) => {
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
                    return <span key={z} className={cls} role="cell">{v > 0 ? v : ''}</span>;
                  })}
                  <span className="deep-heat-z deep-heat-z--total" role="cell">{row.total}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Involvement (player profiles) */}
      {show('involvement') && profiles.size > 0 && (
        <section className="card tgs-card">
          {sectionTitle('involvement')}
          <p className="muted tgs-card-sub">Ranked by involvement: passes + tackles + breaks + tries + negatives + penalties.</p>
          <PlayerProfileList profiles={profiles} playersById={playersById} />
        </section>
      )}

      {/* Ruck speed */}
      {show('ruck') && ruckDurations.length > 0 && (() => {
        const dist = ruckSpeedDistribution(ruckDurations);
        const distMax = Math.max(1, ...dist.map((b) => b.count));
        return (
          <section className="card tgs-card">
            {sectionTitle('ruck')}
            <div className="deep-ruck-kpis">
              <div className="deep-ruck-kpi">
                <span className="deep-ruck-kpi-value">{(ruckMedian! / 1000).toFixed(1)}s</span>
                <span className="deep-ruck-kpi-label">Median</span>
              </div>
              <div className="deep-ruck-kpi">
                <span className="deep-ruck-kpi-value">{ruckDurations.length}</span>
                <span className="deep-ruck-kpi-label">Pairs</span>
              </div>
            </div>
            <div className="deep-ruck-dist">
              {dist.map((b) => {
                const tone = RUCK_BUCKET_TONE[b.label] ?? 'ok';
                return (
                  <div key={b.label} className="deep-ruck-bucket">
                    <div className="deep-ruck-bucket-bar-wrap">
                      <div className={`deep-ruck-bucket-bar deep-ruck-bucket-bar--${tone}`} style={{ height: `${Math.round((b.count / distMax) * 100)}%` }} />
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

      {/* Set pieces */}
      {show('setpieces') && (
        <section className="card tgs-card">
          {sectionTitle('setpieces')}

          {scrumTotal > 0 && (
            <>
              <h4 className="tgs-card-subtitle">Scrums</h4>
              <div className="team-global-kpi-row" style={{ marginBottom: '0.5rem' }}>
                <div className="team-global-kpi">
                  <span className="team-global-kpi-label">Our ball won</span>
                  <span className="team-global-kpi-value tabular-nums">{scrumOurWon}</span>
                </div>
                <div className="team-global-kpi">
                  <span className="team-global-kpi-label">Defensive won</span>
                  <span className="team-global-kpi-value tabular-nums">{scrumDefWon}</span>
                </div>
                <div className="team-global-kpi">
                  <span className="team-global-kpi-label">Total</span>
                  <span className="team-global-kpi-value tabular-nums">{scrumTotal}</span>
                </div>
              </div>
              <SetPieceBar label="Attack (our ball)" split={scrumAtk} />
              <SetPieceBar label="Defense (their ball)" split={scrumDef} />
            </>
          )}

          <h4 className="tgs-card-subtitle" style={scrumTotal > 0 ? { marginTop: '0.65rem' } : undefined}>Lineouts</h4>
          <SetPieceBar label="Lineouts" split={snapshot.lineouts} />

          <h4 className="tgs-card-subtitle" style={{ marginTop: '0.65rem' }}>Rucks</h4>
          <SetPieceBar label="Rucks (restart)" split={snapshot.rucks} />
        </section>
      )}

      {/* Penalties */}
      {show('penalties') && penTypes.length > 0 && (() => {
        const max = Math.max(1, ...penTypes.map((r) => r.count));
        return (
          <section className="card tgs-card">
            {sectionTitle('penalties')}
            <div className="deep-penalty-list">
              {penTypes.map((r) => (
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

      {/* Negatives */}
      {show('negatives') && negActions.length > 0 && (() => {
        const max = Math.max(1, ...negActions.map((r) => r.count));
        return (
          <section className="card tgs-card">
            {sectionTitle('negatives')}
            <div className="deep-penalty-list">
              {negActions.map((r) => (
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

      {/* Scoring timeline */}
      {show('scoring') && timeline.length > 0 && (() => {
        const maxPts = Math.max(1, ...timeline.map((m) => Math.max(m.runningUs, m.runningOpp)));
        return (
          <section className="card tgs-card">
            {sectionTitle('scoring')}
            <div className="deep-timeline">
              {timeline.map((m, i) => (
                <div key={i} className="deep-timeline-row">
                  <span className="deep-timeline-time tabular-nums">{fmtMin(m.matchTimeMs)}</span>
                  <span className={`deep-timeline-marker deep-timeline-marker--${m.side}`} />
                  <div className="deep-timeline-bars">
                    <div className="deep-timeline-bar deep-timeline-bar--us" style={{ width: `${Math.round((m.runningUs / maxPts) * 100)}%` }}>
                      {m.runningUs > 0 ? <span className="deep-timeline-pts tabular-nums">{m.runningUs}</span> : null}
                    </div>
                    <div className="deep-timeline-bar deep-timeline-bar--opp" style={{ width: `${Math.round((m.runningOpp / maxPts) * 100)}%` }}>
                      {m.runningOpp > 0 ? <span className="deep-timeline-pts tabular-nums">{m.runningOpp}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
              <div className="deep-timeline-legend muted">
                <span><span className="live-stats-dot live-stats-dot--us" /> Us</span>
                <span><span className="live-stats-dot live-stats-dot--opp" /> Opp</span>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Event counts (drill-down) */}
      {show('numbers') && (
        <section className="card tgs-card">
          {sectionTitle('numbers')}
          <div className="live-stats-grid">
            {KIND_ORDER.map((kind) => (
              <StatCard
                key={kind}
                statKey={`kind:${kind}`}
                value={byKind[kind] ?? 0}
                label={kindLabel(kind)}
                expandedKey={expandedKey}
                onToggle={toggleExpand}
                idPrefix={idPrefix}
                events={events}
                substitutions={substitutions}
                playersById={playersById}
              />
            ))}
            <StatCard
              statKey="tackle:made" value={tacklesMade} label="Tackles made"
              expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix}
              events={events} substitutions={substitutions} playersById={playersById}
            />
            <StatCard
              statKey="tackle:missed" value={tacklesMissed} label="Tackles missed"
              expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix}
              events={events} substitutions={substitutions} playersById={playersById}
            />
            <StatCard
              statKey="subs" value={substitutions.length} label="Substitutions" wide
              expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix}
              events={events} substitutions={substitutions} playersById={playersById}
            />
          </div>

          {scoringRows.length > 0 && (
            <>
              <h4 className="tgs-card-title" style={{ marginTop: '0.6rem' }}>Scoring by player</h4>
              <ul className="live-stats-scoring-list">
                {scoringRows.map((r) => (
                  <li key={r.id} className="live-stats-scoring-row">
                    <span className="live-stats-scoring-name">{r.label}</span>
                    <span className="live-stats-scoring-meta">
                      {r.tries > 0 ? `${r.tries} try${r.tries === 1 ? '' : 'ies'}` : ''}
                      {r.tries > 0 && r.conversions > 0 ? ' \u00b7 ' : ''}
                      {r.conversions > 0 ? `${r.conversions} conv` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4 className="tgs-card-title" style={{ marginTop: '0.6rem' }}>Tries by zone</h4>
          <div className="live-stats-zone-grid">
            {ZONE_IDS.map((z) => (
              <StatCard
                key={z}
                statKey={`zone:${z}`}
                value={triesZ[z]}
                label={z}
                expandedKey={expandedKey}
                onToggle={toggleExpand}
                idPrefix={idPrefix}
                events={events}
                substitutions={substitutions}
                playersById={playersById}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompareRow({ label, left, right, tone = 'default' }: { label: string; left: number; right: number; tone?: 'default' | 'yc' | 'rc' }) {
  const max = Math.max(1, left, right);
  const lw = Math.round((left / max) * 100);
  const rw = Math.round((right / max) * 100);
  const toneClass = tone === 'yc' ? 'live-analytics-cmp--yc' : tone === 'rc' ? 'live-analytics-cmp--rc' : '';
  return (
    <div className="live-analytics-compare-row">
      <span className="live-analytics-compare-label">{label}</span>
      <div className={`live-analytics-cmp ${toneClass}`}>
        <div className="live-analytics-cmp-side">
          <span className="live-analytics-cmp-num tabular-nums">{left}</span>
          <div className="live-analytics-cmp-track" aria-hidden>
            <div className="live-analytics-cmp-fill live-analytics-cmp-fill--left" style={{ width: `${lw}%` }} />
          </div>
          <span className="live-analytics-cmp-tag">Us</span>
        </div>
        <div className="live-analytics-cmp-side live-analytics-cmp-side--right">
          <span className="live-analytics-cmp-num tabular-nums">{right}</span>
          <div className="live-analytics-cmp-track" aria-hidden>
            <div className="live-analytics-cmp-fill live-analytics-cmp-fill--right" style={{ width: `${rw}%` }} />
          </div>
          <span className="live-analytics-cmp-tag">Opp</span>
        </div>
      </div>
    </div>
  );
}

function PlayerProfileList({ profiles, playersById }: { profiles: Map<string, PlayerProfile>; playersById: Map<string, PlayerRecord> }) {
  const sorted = [...profiles.values()].sort((a, b) => playerInvolvement(b) - playerInvolvement(a));
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="deep-player-list">
      {sorted.map((p) => {
        const player = playersById.get(p.playerId);
        const label = player ? formatPlayerLabel(player) : p.playerId;
        const tMade = p.tackles.made;
        const tMissed = p.tackles.missed;
        const tacklePctP = tMade + tMissed > 0 ? Math.round((tMade / (tMade + tMissed)) * 100) : null;
        const isOpen = expanded === p.playerId;

        return (
          <div key={p.playerId} className={`deep-player-card${isOpen ? ' deep-player-card--open' : ''}`}>
            <button
              type="button"
              className="deep-player-summary"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : p.playerId)}
            >
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
            </button>
            {isOpen && (
              <div className="deep-player-detail">
                <dl className="deep-player-dl">
                  <div className="deep-dl-pair"><dt>Passes</dt><dd>{p.passes}{p.offloads > 0 ? ` (${p.offloads} offloads)` : ''}</dd></div>
                  <div className="deep-dl-pair"><dt>Tackles</dt><dd>{tMade}M / {tMissed}X{tacklePctP != null ? ` (${tacklePctP}%)` : ''}</dd></div>
                  {tMade > 0 && <div className="deep-dl-pair"><dt>Tackle quality</dt><dd>{p.tackles.dominant}D / {p.tackles.neutral}N / {p.tackles.passive}P</dd></div>}
                  <div className="deep-dl-pair"><dt>Line breaks</dt><dd>{p.lineBreaks}</dd></div>
                  <div className="deep-dl-pair"><dt>Tries / Conv.</dt><dd>{p.tries}T / {p.conversions.made}M {p.conversions.missed}X</dd></div>
                  {p.negatives > 0 && (
                    <div className="deep-dl-pair"><dt>Negatives</dt><dd>
                      {Object.entries(p.negativeBreakdown).map(([nid, cnt]) => (
                        <span key={nid} className="deep-neg-tag">
                          {nid === 'bad_pass' ? 'Bad pass' : nid === 'knock_on' ? 'Knock-on' : nid === 'forward_pass' ? 'Fwd pass' : nid}{' '}{cnt}
                        </span>
                      ))}
                    </dd></div>
                  )}
                  {p.penalties > 0 && (
                    <div className="deep-dl-pair"><dt>Penalties</dt><dd>
                      {p.penalties}
                      {p.cards.yellow > 0 ? ` \u00b7 ${p.cards.yellow} YC` : ''}
                      {p.cards.red > 0 ? ` \u00b7 ${p.cards.red} RC` : ''}
                    </dd></div>
                  )}
                </dl>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
