import { useEffect, useId, useMemo, useState } from 'react';
import { computeMatchAnalyticsSnapshot } from '@/domain/matchAnalytics';
import { kickDecidedSuccessPct, type SetPieceSplit } from '@/domain/matchAnalytics';
import type { MatchSessionRecord } from '@/domain/match';
import { formatClock, formatFilmClockForSession } from '@/domain/matchClock';
import type { MatchEventKind, MatchEventRecord } from '@/domain/matchEvent';
import { formatMatchEventSummary } from '@/domain/matchEventDisplay';
import {
  buildPlayerProfiles,
  buildZoneHeatRows,
  negativeActionBreakdown,
  penaltyCountByType,
  matchTimeBreakdown,
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
  kindLabel,
  passToPassDurationsMs,
  ruckSpeedSplit,
  tackleMadeMissed,
  triesByZone,
  triesAndConversionsByPlayer,
} from '@/domain/matchStats';
import { computeInferredMatchStats, hasInferredStatsData } from '@/domain/inferredStats';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import { ZONE_IDS } from '@/domain/zone';
import {
  countConversionsMadeMissed,
  countDefensePasses,
  countPassesAndOffloads,
  countPenaltiesByDirection,
  filmBookmarkEvents,
  setPieceSplitForPhase,
  sortFilmBookmarksByFilmTime,
  tallySetPieceKinds,
} from '@/domain/tallyStats';
import type { MatchRecord } from '@/domain/match';
import { buildMatchStatsBrief } from '@/domain/statsBrief';
import {
  buildMatchOnePagerHtml,
  buildStatsExportDocument,
  openStatsExport,
} from '@/domain/statsExport';
import { SectionHelp, MATCH_GLOSSARY, type GlossaryEntry } from '@/components/SectionHelp';
import { formatMatchKickoffInZone, getStoredDisplayTimeZone } from '@/utils/displayTimezone';
import { AiInsightsSection } from '@/features/match/AiInsightsSection';
import { MatchTimeBreakdownTable } from '@/features/match/MatchTimeBreakdownTable';
import { InferredStatsSection } from '@/features/match/InferredStatsSection';
import { PossessionsStatsSection } from '@/features/match/PossessionsStatsSection';
import { RuckPhaseBreakdownPanel } from '@/features/match/RuckPhaseBreakdownPanel';
import { SetPieceExpandBar, StatCard } from '@/features/match/statExpand';
import { hasRuckBreakdownData } from '@/domain/inferredStats';

type StatsDetail = 'full' | 'one_tap' | 'tally';

const STATS_MODE_HELP: GlossaryEntry[] = [
  { abbr: 'Tally', full: 'Tally summary', desc: 'Scoreboard plus attack/defense splits: actions, set pieces (W/L/FK/Pen), penalties awarded/conceded, tries conceded, system moments, forced turnovers, and film bookmarks with scrub times. Best when tracking in Tally mode.' },
  { abbr: 'One Tap', full: 'One Tap summary', desc: 'Overview plus grouped event counts: attack, defense, and set pieces. Designed for One Tap tracking where zone-level data isn\u2019t captured.' },
  { abbr: 'Full', full: 'Full analytics', desc: 'All sections: phase split, zones, set pieces, ruck speed, penalties, negatives, scoring timeline, event counts, and player detail. Best when tracking in Full mode.' },
];

type Props = {
  match?: MatchRecord | null;
  events: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  statsDetail?: StatsDetail;
  onStatsDetailChange?: (mode: StatsDetail) => void;
  onCopySummary?: () => void;
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'phase', label: 'Time & phases' },
  { id: 'zones', label: 'Zone heat map' },
  { id: 'involvement', label: 'Involvement' },
  { id: 'ruck', label: 'Ruck speed' },
  { id: 'insights', label: 'Inferred insights' },
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
  'film_star', 'system_moment', 'forced_turnover',
  'try', 'conversion', 'opponent_try', 'opponent_conversion',
  'opponent_substitution', 'opponent_card', 'pass', 'line_break',
  'negative_action', 'scrum', 'lineout', 'restart', 'team_penalty', 'ruck',
];

const ONE_TAP_ATTACK_KINDS: MatchEventKind[] = [
  'pass', 'line_break', 'try', 'conversion', 'negative_action',
];
const TALLY_DEFENSE_KINDS: MatchEventKind[] = ['team_penalty'];
const TALLY_SET_PIECE_KINDS: MatchEventKind[] = ['restart', 'ruck', 'scrum', 'lineout'];
const EXPANDABLE_SET_PIECE_KINDS: MatchEventKind[] = ['restart', 'scrum', 'lineout'];

function fmtMin(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}


function FilmBookmarksQuickList({
  events,
  playersById,
  filmSession,
}: {
  events: MatchEventRecord[];
  playersById: Map<string, PlayerRecord>;
  filmSession: MatchSessionRecord | null;
}) {
  const bookmarks = sortFilmBookmarksByFilmTime(events);
  if (bookmarks.length === 0) {
    return <p className="muted live-stats-film-empty">No film bookmarks yet. Use ★ Star moment or System Moment while tracking.</p>;
  }
  return (
    <ul className="live-stats-film-list" aria-label="Film bookmarks sorted by film time">
      {bookmarks.map((e) => (
        <li key={e.id} className="live-stats-film-row">
          <span className="live-stats-film-time tabular-nums">
            {(filmSession && formatFilmClockForSession(filmSession, e.filmTimeMs)) ?? '—'}
          </span>
          <span className="live-stats-film-meta">
            <span className="live-stats-film-match tabular-nums">
              P{e.period} {formatClock(e.matchTimeMs)}
            </span>
            <span className="live-stats-film-label">
              {formatMatchEventSummary(e, playersById, filmSession)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function FilmBookmarksSection({
  events,
  substitutions,
  playersById,
  filmSession,
  expandedKey,
  onToggle,
  idPrefix,
}: {
  events: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById: Map<string, PlayerRecord>;
  filmSession: MatchSessionRecord | null;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  idPrefix: string;
}) {
  const byKind = countEventsByKind(events);
  const bookmarkCount = filmBookmarkEvents(events).length;
  return (
    <section className="card tgs-card">
      <h3 className="tgs-card-title">Film bookmarks</h3>
      <p className="muted tgs-card-lead">
        {bookmarkCount === 0
          ? 'Jump-to times for footage review.'
          : `${bookmarkCount} bookmark${bookmarkCount === 1 ? '' : 's'} — film time first for scrubbing.`}
      </p>
      <div className="live-stats-grid">
        <StatCard
          statKey="kind:film_star"
          value={byKind.film_star ?? 0}
          label="Starred moments"
          expandedKey={expandedKey}
          onToggle={onToggle}
          idPrefix={idPrefix}
          events={events}
          substitutions={substitutions}
          playersById={playersById}
        />
        <StatCard
          statKey="kind:system_moment"
          value={byKind.system_moment ?? 0}
          label="System moments"
          expandedKey={expandedKey}
          onToggle={onToggle}
          idPrefix={idPrefix}
          events={events}
          substitutions={substitutions}
          playersById={playersById}
        />
      </div>
      <h4 className="tgs-card-subtitle">Scrub list (film time)</h4>
      <FilmBookmarksQuickList
        events={events}
        playersById={playersById}
        filmSession={filmSession}
      />
    </section>
  );
}

function setPieceSliceTotal(split: SetPieceSplit): number {
  return split.won + split.lost + split.penalized + split.freeKick;
}

function SetPieceBar({ label, split }: { label: string; split: SetPieceSplit }) {
  const n = setPieceSliceTotal(split);
  const nums = (
    <span className="live-analytics-setpiece-nums tabular-nums">
      W {split.won}
      {' \u00b7 '}
      L {split.lost}
      {split.freeKick > 0 ? (
        <>
          {' \u00b7 '}
          FK {split.freeKick}
        </>
      ) : null}
      {' \u00b7 '}
      Pen {split.penalized}
    </span>
  );
  return (
    <div className="live-analytics-setpiece-row">
      <div className="live-analytics-setpiece-top">
        <span className="live-analytics-setpiece-name">{label}</span>
        {n === 0 ? (
          <span className="live-analytics-setpiece-empty muted">{'\u2014'}</span>
        ) : (
          nums
        )}
      </div>
      {n > 0 ? (
        <div
          className="live-analytics-setpiece-bar"
          role="img"
          aria-label={`${label}: ${split.won} won, ${split.lost} lost, ${split.penalized} penalized, ${split.freeKick} free kick`}
        >
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--won" style={{ flex: Math.max(0, split.won) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--lost" style={{ flex: Math.max(0, split.lost) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--fk" style={{ flex: Math.max(0, split.freeKick) }} />
          <div className="live-analytics-setpiece-seg live-analytics-setpiece-seg--pen" style={{ flex: Math.max(0, split.penalized) }} />
        </div>
      ) : null}
    </div>
  );
}

const SET_PIECE_LABEL: Record<string, string> = {
  scrum: 'Scrums',
  lineout: 'Lineouts',
  restart: 'Restarts',
  ruck: 'Rucks',
};

export function MatchStatsPanel({
  match = null,
  events,
  substitutions,
  playersById,
  filmSession = null,
  statsDetail = 'full',
  onStatsDetailChange,
  onCopySummary,
}: Props) {
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
  const ruckSplit = useMemo(() => ruckSpeedSplit(events), [events]);
  const ruckDurations = ruckSplit.all;
  const ruckMedian = useMemo(() => ruckSpeedMedianMs(ruckDurations), [ruckDurations]);
  const ruckAttackMedian = useMemo(() => ruckSpeedMedianMs(ruckSplit.attack), [ruckSplit.attack]);
  const ruckDefenseMedian = useMemo(() => ruckSpeedMedianMs(ruckSplit.defense), [ruckSplit.defense]);
  const passToPassDurations = useMemo(() => passToPassDurationsMs(events), [events]);
  const passToPassMedian = useMemo(() => ruckSpeedMedianMs(passToPassDurations), [passToPassDurations]);
  const phaseTime = useMemo(() => phaseTimeSplit(events), [events]);
  const timeBreakdown = useMemo(
    () => matchTimeBreakdown(events, filmSession),
    [events, filmSession],
  );
  const inferred = useMemo(() => computeInferredMatchStats(events), [events]);
  const timeline = useMemo(() => scoringTimeline(events), [events]);
  const systemMoments = byKind.system_moment ?? 0;

  const scrumPhase = useMemo(() => setPieceByPhase(events, 'scrum'), [events]);
  const scrumAtk = scrumPhase.attack;
  const scrumDef = scrumPhase.defense;
  const scrumOurWon = scrumAtk.won;
  const scrumDefWon = scrumDef.won;
  const scrumTotal =
    setPieceSliceTotal(scrumAtk) + setPieceSliceTotal(scrumDef);

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

  const aiBrief = useMemo(() => {
    if (!match) return null;
    return buildMatchStatsBrief({
      match,
      snapshot,
      inferred,
      phase: phaseTime,
      tackleCompletionPct: tacklePct,
      ruckMedianMs: ruckMedian,
      ruckAttackMedianMs: ruckAttackMedian,
      ruckDefenseMedianMs: ruckDefenseMedian,
      passToPassMedianMs: passToPassMedian,
      penaltyTypes: penTypes,
      negativeActions: negActions,
      systemMoments,
    });
  }, [
    match,
    snapshot,
    inferred,
    phaseTime,
    tacklePct,
    ruckMedian,
    ruckAttackMedian,
    ruckDefenseMedian,
    passToPassMedian,
    penTypes,
    negActions,
    systemMoments,
  ]);

  const visibleSections = SECTIONS.filter((s) => {
    if (statsDetail === 'tally') {
      return s.id === 'numbers';
    }
    if (statsDetail === 'one_tap') {
      return s.id === 'overview' || s.id === 'numbers' || (s.id === 'involvement' && profiles.size > 0);
    }
    if (s.id === 'zones') return heatRows.length > 0;
    if (s.id === 'involvement') return profiles.size > 0;
    if (s.id === 'ruck') {
      return (
        hasRuckBreakdownData(inferred.ruckByPhase) ||
        ruckDurations.length > 0 ||
        passToPassDurations.length > 0
      );
    }
    if (s.id === 'penalties') return penTypes.length > 0;
    if (s.id === 'negatives') return negActions.length > 0;
    if (s.id === 'phase') return phaseTime != null || timeBreakdown != null;
    if (s.id === 'insights') return hasInferredStatsData(inferred);
    if (s.id === 'scoring') return timeline.length > 0;
    return true;
  });

  useEffect(() => {
    setActiveSection('all');
  }, [statsDetail]);

  const current = activeSection === 'all' ? 'all' : (visibleSections.find((s) => s.id === activeSection) ? activeSection : 'all');
  const visibleIds: Set<string> = new Set(visibleSections.map((s) => s.id));
  const show = (id: string) => visibleIds.has(id) && (current === 'all' || current === id);
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

  function onExportMatchStats() {
    if (!match) return;
    const kickoffLabel = match.kickoffDate
      ? formatMatchKickoffInZone(match.kickoffDate, getStoredDisplayTimeZone())
      : null;
    const page = buildMatchOnePagerHtml({
      match,
      events,
      substitutionCount: substitutions.length,
      playersById,
      kickoffLabel,
    });
    openStatsExport(buildStatsExportDocument([page]));
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
        <div className="tgs-header-title-row">
          <h2 className="team-global-stats-title">
            Match stats
          </h2>
          <SectionHelp
            title="Stats modes"
            entries={STATS_MODE_HELP}
          />
          <div className="tgs-header-export-actions">
            {match ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onExportMatchStats}>
                Export
              </button>
            ) : null}
            {onCopySummary ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onCopySummary}>
                Copy summary
              </button>
            ) : null}
          </div>
        </div>
        {onStatsDetailChange ? (
          <div className="tracking-mode-switch tracking-mode-switch--stats" role="radiogroup" aria-label="Stats detail level">
            <button type="button" role="radio" aria-checked={statsDetail === 'tally'} className={`tracking-mode-opt${statsDetail === 'tally' ? ' tracking-mode-opt--active' : ''}`} onClick={() => onStatsDetailChange('tally')}>Tally</button>
            <button type="button" role="radio" aria-checked={statsDetail === 'one_tap'} className={`tracking-mode-opt${statsDetail === 'one_tap' ? ' tracking-mode-opt--active' : ''}`} onClick={() => onStatsDetailChange('one_tap')}>One Tap</button>
            <button type="button" role="radio" aria-checked={statsDetail === 'full'} className={`tracking-mode-opt${statsDetail === 'full' ? ' tracking-mode-opt--active' : ''}`} onClick={() => onStatsDetailChange('full')}>Full</button>
          </div>
        ) : null}
      </div>
      {visibleSections.length > 1 ? (
        <select
          className="filter-select tgs-section-select tgs-section-select--full-width"
          value={current}
          onChange={(e) => setActiveSection(e.target.value as SectionId)}
          aria-label="Section"
        >
          <option value="all">All sections</option>
          {visibleSections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      ) : null}

      {aiBrief ? (
        <section className="card tgs-card tgs-card--ai-insights">
          <AiInsightsSection cacheKey={`match:${match!.id}`} brief={aiBrief} />
        </section>
      ) : null}

      <PossessionsStatsSection
        events={events}
        filmSession={filmSession}
        expandedKey={expandedKey}
        onToggle={toggleExpand}
        idPrefix={idPrefix}
      />

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
            {(inferred.attackPasses > 0 || inferred.defensePasses > 0) && (
              <div className="team-global-kpi">
                <span className="team-global-kpi-label">Passes</span>
                <span className="team-global-kpi-value tabular-nums">
                  {inferred.attackPasses}{' \u00b7 '}{inferred.defensePasses}
                </span>
                <span className="team-global-kpi-sub muted">Attack \u00b7 Opp</span>
              </div>
            )}
          </div>

          <div className="live-analytics-compare mt-md" aria-label="Subs and discipline">
            <CompareRow label="Subs" left={snapshot.subsOurs} right={snapshot.subsOpp} />
            <CompareRow label="YC" left={snapshot.cardsOurs.yc} right={snapshot.cardsOpp.yc} tone="yc" />
            <CompareRow label="RC" left={snapshot.cardsOurs.rc} right={snapshot.cardsOpp.rc} tone="rc" />
          </div>
        </section>
      )}

      {/* Time & phases */}
      {show('phase') && timeBreakdown && (
        <section className="card tgs-card">
          {sectionTitle('phase')}
          <MatchTimeBreakdownTable breakdown={timeBreakdown} phaseTime={phaseTime} />
        </section>
      )}

      {/* Inferred insights */}
      {show('insights') && hasInferredStatsData(inferred) && (
        <section className="card tgs-card">
          {sectionTitle('insights')}
          <InferredStatsSection
            stats={inferred}
            events={events}
            playersById={playersById}
            filmSession={filmSession}
          />
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
          <PlayerProfileList profiles={profiles} playersById={playersById} showQualityDetail={statsDetail !== 'one_tap'} />
        </section>
      )}

      {/* Ruck speed */}
      {show('ruck') && (hasRuckBreakdownData(inferred.ruckByPhase) || ruckDurations.length > 0 || passToPassDurations.length > 0) && (() => {
        const dist = ruckSpeedDistribution(ruckDurations);
        const distMax = Math.max(1, ...dist.map((b) => b.count));
        const fmtSec = (ms: number | null) => (ms != null ? `${(ms / 1000).toFixed(1)}s` : '—');
        return (
          <section className="card tgs-card">
            {sectionTitle('ruck')}
            {hasRuckBreakdownData(inferred.ruckByPhase) && (
              <RuckPhaseBreakdownPanel breakdown={inferred.ruckByPhase} />
            )}
            {ruckDurations.length > 0 && (
              <>
                <p className="muted tgs-card-sub">Ruck to first pass (+2s logging offset for multi-step ruck taps), split by phase when the ruck was logged.</p>
                <div className="deep-ruck-kpis deep-ruck-kpis--wrap">
                  <div className="deep-ruck-kpi">
                    <span className="deep-ruck-kpi-value">{fmtSec(ruckAttackMedian)}</span>
                    <span className="deep-ruck-kpi-label">Atk median ({ruckSplit.attack.length})</span>
                  </div>
                  <div className="deep-ruck-kpi">
                    <span className="deep-ruck-kpi-value">{fmtSec(ruckDefenseMedian)}</span>
                    <span className="deep-ruck-kpi-label">Def median ({ruckSplit.defense.length})</span>
                  </div>
                  <div className="deep-ruck-kpi">
                    <span className="deep-ruck-kpi-value">{fmtSec(ruckMedian)}</span>
                    <span className="deep-ruck-kpi-label">Game median ({ruckDurations.length})</span>
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
              </>
            )}
            {passToPassDurations.length > 0 && (
              <>
                <h4 className="tgs-card-subtitle">Pass to pass</h4>
                <p className="muted tgs-card-sub">Only consecutive passes in the same period (not pass → line break or break → try). +1s logging offset on every pair (catch + pass).</p>
                <div className="deep-ruck-kpis">
                  <div className="deep-ruck-kpi">
                    <span className="deep-ruck-kpi-value">{fmtSec(passToPassMedian)}</span>
                    <span className="deep-ruck-kpi-label">Median</span>
                  </div>
                  <div className="deep-ruck-kpi">
                    <span className="deep-ruck-kpi-value">{passToPassDurations.length}</span>
                    <span className="deep-ruck-kpi-label">Pairs</span>
                  </div>
                </div>
              </>
            )}
          </section>
        );
      })()}

      {/* Set pieces */}
      {show('setpieces') && (
        <section className="card tgs-card">
          {sectionTitle('setpieces')}
          <p className="muted tgs-card-sub">Tap scrums, lineouts, or restarts to see match timestamps (rucks are summary only).</p>

          {scrumTotal > 0 && (
            <>
              <h4 className="tgs-card-subtitle">Scrums</h4>
              <div className="team-global-kpi-row mb-sm">
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
              <SetPieceExpandBar
                label="Attack (our ball)"
                split={scrumAtk}
                statKey="setpiece:scrum:attack"
                expandedKey={expandedKey}
                onToggle={toggleExpand}
                idPrefix={idPrefix}
                events={events}
                substitutions={substitutions}
                playersById={playersById}
                filmSession={filmSession}
              />
              <SetPieceExpandBar
                label="Defense (their ball)"
                split={scrumDef}
                statKey="setpiece:scrum:defense"
                expandedKey={expandedKey}
                onToggle={toggleExpand}
                idPrefix={idPrefix}
                events={events}
                substitutions={substitutions}
                playersById={playersById}
                filmSession={filmSession}
              />
            </>
          )}

          <h4 className={`tgs-card-subtitle${scrumTotal > 0 ? ' mt-md' : ''}`}>Lineouts</h4>
          <SetPieceExpandBar
            label="Lineouts"
            split={snapshot.lineouts}
            statKey="setpiece:lineout"
            expandedKey={expandedKey}
            onToggle={toggleExpand}
            idPrefix={idPrefix}
            events={events}
            substitutions={substitutions}
            playersById={playersById}
            filmSession={filmSession}
          />

          <h4 className="tgs-card-subtitle mt-md">Rucks</h4>
          <SetPieceBar label="Rucks (from chip)" split={snapshot.rucks} />

          <h4 className="tgs-card-subtitle mt-md">Restarts</h4>
          <SetPieceExpandBar
            label="Restarts (kick / receive)"
            split={snapshot.restarts}
            statKey="setpiece:restart"
            expandedKey={expandedKey}
            onToggle={toggleExpand}
            idPrefix={idPrefix}
            events={events}
            substitutions={substitutions}
            playersById={playersById}
            filmSession={filmSession}
          />
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

      {/* Tally / Simple mode: separate cards per group */}
      {show('numbers') && statsDetail === 'tally' && (() => {
        const { pass, offload } = countPassesAndOffloads(events);
        const defensePasses = countDefensePasses(events);
        const conv = countConversionsMadeMissed(events);
        const penAtk = countPenaltiesByDirection(events, 'attack');
        const penDef = countPenaltiesByDirection(events, 'defense');
        let knockOnCount = 0;
        let otherNegCount = 0;
        for (const e of events) {
          if (e.deletedAt != null || e.kind !== 'negative_action') continue;
          if (e.negativeActionId === 'knock_on') knockOnCount += 1;
          else otherNegCount += 1;
        }
        return (
          <>
            <section className="card tgs-card">
              <h3 className="tgs-card-title">Scoreboard</h3>
              <div className="team-global-kpi-row">
                <div className="team-global-kpi">
                  <span className="team-global-kpi-label">Points</span>
                  <span className="team-global-kpi-value tabular-nums">
                    {snapshot.ownPoints}{' \u2013 '}{snapshot.oppPoints}
                  </span>
                </div>
                <div className="team-global-kpi">
                  <span className="team-global-kpi-label">Tries</span>
                  <span className="team-global-kpi-value tabular-nums">
                    {snapshot.ownTries}{' \u2013 '}{snapshot.oppTries}
                  </span>
                </div>
                <div className="team-global-kpi">
                  <span className="team-global-kpi-label">Tries conceded</span>
                  <span className="team-global-kpi-value tabular-nums">{snapshot.oppTries}</span>
                </div>
              </div>
              <div className="live-analytics-compare mt-md" aria-label="Subs and discipline">
                <CompareRow label="Subs" left={snapshot.subsOurs} right={snapshot.subsOpp} />
                <CompareRow label="YC" left={snapshot.cardsOurs.yc} right={snapshot.cardsOpp.yc} tone="yc" />
                <CompareRow label="RC" left={snapshot.cardsOurs.rc} right={snapshot.cardsOpp.rc} tone="rc" />
              </div>
            </section>
            <section className="card tgs-card">
              <h3 className="tgs-card-title">Attack</h3>
              <div className="live-stats-grid">
                <StatCard statKey="pass:standard" value={pass} label="Passes" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="pass:offload" value={offload} label="Offloads" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="kind:line_break" value={byKind.line_break ?? 0} label="Line breaks" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="kind:try" value={byKind.try ?? 0} label="Tries" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="conv:made" value={conv.made} label="Conv. made" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="conv:missed" value={conv.missed} label="Conv. missed" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="neg:other" value={otherNegCount} label="Neg" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="neg:knock_on" value={knockOnCount} label="Knock-ons" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="pen:conceded:attack" value={penAtk.conceded} label="Pen −" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="pen:awarded:attack" value={penAtk.awarded} label="Pen +" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="kind:system_moment" value={byKind.system_moment ?? 0} label="System moments" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              </div>
              <h4 className="tgs-card-subtitle">Set pieces (attack)</h4>
              {tallySetPieceKinds().map((kind) =>
                EXPANDABLE_SET_PIECE_KINDS.includes(kind) ? (
                  <SetPieceExpandBar
                    key={kind}
                    label={SET_PIECE_LABEL[kind] ?? kind}
                    split={setPieceSplitForPhase(events, kind, 'attack')}
                    statKey={`setpiece:${kind}:attack`}
                    expandedKey={expandedKey}
                    onToggle={toggleExpand}
                    idPrefix={idPrefix}
                    events={events}
                    substitutions={substitutions}
                    playersById={playersById}
                    filmSession={filmSession}
                  />
                ) : (
                  <SetPieceBar key={kind} label={SET_PIECE_LABEL[kind] ?? kind} split={setPieceSplitForPhase(events, kind, 'attack')} />
                ),
              )}
            </section>
            <section className="card tgs-card">
              <h3 className="tgs-card-title">Defense</h3>
              <div className="live-stats-grid">
                <StatCard statKey="tackle:made" value={tacklesMade} label="Tackles made" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="tackle:missed" value={tacklesMissed} label="Tackles missed" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="pass:defense" value={defensePasses} label="Opp passes" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="kind:opponent_try" value={byKind.opponent_try ?? 0} label="Tries conceded" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="kind:opponent_conversion" value={byKind.opponent_conversion ?? 0} label="Opp conv." expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="pen:conceded:defense" value={penDef.conceded} label="Pen −" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="pen:awarded:defense" value={penDef.awarded} label="Pen +" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
                <StatCard statKey="kind:forced_turnover" value={byKind.forced_turnover ?? 0} label="Forced turnovers" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              </div>
              <h4 className="tgs-card-subtitle">Set pieces (defense)</h4>
              {tallySetPieceKinds().map((kind) =>
                EXPANDABLE_SET_PIECE_KINDS.includes(kind) ? (
                  <SetPieceExpandBar
                    key={kind}
                    label={SET_PIECE_LABEL[kind] ?? kind}
                    split={setPieceSplitForPhase(events, kind, 'defense')}
                    statKey={`setpiece:${kind}:defense`}
                    expandedKey={expandedKey}
                    onToggle={toggleExpand}
                    idPrefix={idPrefix}
                    events={events}
                    substitutions={substitutions}
                    playersById={playersById}
                    filmSession={filmSession}
                  />
                ) : (
                  <SetPieceBar key={kind} label={SET_PIECE_LABEL[kind] ?? kind} split={setPieceSplitForPhase(events, kind, 'defense')} />
                ),
              )}
            </section>
            <FilmBookmarksSection
              events={events}
              substitutions={substitutions}
              playersById={playersById}
              filmSession={filmSession}
              expandedKey={expandedKey}
              onToggle={toggleExpand}
              idPrefix={idPrefix}
            />
          </>
        );
      })()}

      {show('numbers') && statsDetail === 'one_tap' && (
        <>
          <section className="card tgs-card">
            <h3 className="tgs-card-title">Attack</h3>
            <div className="live-stats-grid">
              <StatCard statKey="pass:standard" value={inferred.attackPasses} label="Passes" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              {inferred.attackOffloads > 0 && (
                <StatCard statKey="pass:offload" value={inferred.attackOffloads} label="Offloads" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              )}
              {ONE_TAP_ATTACK_KINDS.map((kind) => (
                <StatCard key={kind} statKey={`kind:${kind}`} value={byKind[kind] ?? 0} label={kindLabel(kind)} expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              ))}
            </div>
          </section>
          <section className="card tgs-card">
            <h3 className="tgs-card-title">Defense</h3>
            <div className="live-stats-grid">
              <StatCard statKey="tackle:made" value={tacklesMade} label="Tackles made" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              <StatCard statKey="tackle:missed" value={tacklesMissed} label="Tackles missed" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              <StatCard statKey="pass:defense" value={inferred.defensePasses} label="Opp passes" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              {TALLY_DEFENSE_KINDS.map((kind) => (
                <StatCard key={kind} statKey={`kind:${kind}`} value={byKind[kind] ?? 0} label={kindLabel(kind)} expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
              ))}
            </div>
          </section>
          <section className="card tgs-card">
            <h3 className="tgs-card-title">Set pieces</h3>
            <div className="live-stats-grid">
              {TALLY_SET_PIECE_KINDS.map((kind) =>
                kind === 'ruck' ? (
                  <div key={kind} className="live-stats-cell">
                    <span className="live-stats-num">{byKind[kind] ?? 0}</span>
                    <span className="live-stats-label">{kindLabel(kind)}</span>
                  </div>
                ) : (
                  <StatCard
                    key={kind}
                    statKey={`setpiece:${kind}`}
                    value={byKind[kind] ?? 0}
                    label={kindLabel(kind)}
                    expandedKey={expandedKey}
                    onToggle={toggleExpand}
                    idPrefix={idPrefix}
                    events={events}
                    substitutions={substitutions}
                    playersById={playersById}
                    filmSession={filmSession}
                  />
                ),
              )}
            </div>
          </section>
          {statsDetail === 'one_tap' && scoringRows.length > 0 && (
            <section className="card tgs-card">
              <h3 className="tgs-card-title">Scoring by player</h3>
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
            </section>
          )}
          <FilmBookmarksSection
            events={events}
            substitutions={substitutions}
            playersById={playersById}
            filmSession={filmSession}
            expandedKey={expandedKey}
            onToggle={toggleExpand}
            idPrefix={idPrefix}
          />
        </>
      )}

      {/* Event counts (drill-down) — full mode */}
      {show('numbers') && statsDetail === 'full' && (
        <section className="card tgs-card">
          {sectionTitle('numbers')}
          <div className="live-stats-grid">
            {KIND_ORDER.map((kind) => (
              <StatCard key={kind} statKey={`kind:${kind}`} value={byKind[kind] ?? 0} label={kindLabel(kind)} expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            ))}
            <StatCard statKey="tackle:made" value={tacklesMade} label="Tackles made" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            <StatCard statKey="tackle:missed" value={tacklesMissed} label="Tackles missed" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            <StatCard statKey="pass:standard" value={inferred.attackPasses} label="Passes (attack)" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            {inferred.attackOffloads > 0 && (
              <StatCard statKey="pass:offload" value={inferred.attackOffloads} label="Offloads" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            )}
            <StatCard statKey="pass:defense" value={inferred.defensePasses} label="Opp passes" expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            <StatCard statKey="subs" value={substitutions.length} label="Substitutions" wide expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
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
              <StatCard key={z} statKey={`zone:${z}`} value={triesZ[z]} label={z} expandedKey={expandedKey} onToggle={toggleExpand} idPrefix={idPrefix} events={events} substitutions={substitutions} playersById={playersById} filmSession={filmSession} />
            ))}
          </div>
        </section>
      )}

      {show('numbers') && statsDetail === 'full' && (
        <FilmBookmarksSection
          events={events}
          substitutions={substitutions}
          playersById={playersById}
          filmSession={filmSession}
          expandedKey={expandedKey}
          onToggle={toggleExpand}
          idPrefix={idPrefix}
        />
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

function PlayerProfileList({ profiles, playersById, showQualityDetail = true }: { profiles: Map<string, PlayerProfile>; playersById: Map<string, PlayerRecord>; showQualityDetail?: boolean }) {
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
                  {showQualityDetail && tMade > 0 && <div className="deep-dl-pair"><dt>Tackle quality</dt><dd>{p.tackles.dominant}D / {p.tackles.neutral}N / {p.tackles.passive}P</dd></div>}
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
