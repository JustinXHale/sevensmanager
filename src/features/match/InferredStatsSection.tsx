import { useId, useState } from 'react';
import type { InferredMatchStats } from '@/domain/inferredStats';
import { hasRuckBreakdownData } from '@/domain/inferredStats';
import type { MatchEventRecord } from '@/domain/matchEvent';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import type { MatchSessionRecord } from '@/domain/match';
import { RuckPhaseBreakdownPanel } from '@/features/match/RuckPhaseBreakdownPanel';
import {
  getPanelPayload,
  mergeEventPayloads,
  sortPooledEvents,
  StatExpandContent,
} from '@/features/match/statExpand';

function fmtPct(v: number | null): string {
  return v != null ? `${v}%` : '—';
}

function fmtMin(ms: number | null): string {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtSigned(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

type DrilldownId =
  | 'attack-passes'
  | 'defense-passes'
  | 'system-moments'
  | 'forced-turnovers'
  | 'negatives'
  | 'penalties-conceded'
  | 'pen-attack-awarded'
  | 'pen-attack-conceded'
  | 'pen-defense-awarded'
  | 'pen-defense-conceded'
  | 'knock-ons'
  | 'attack-restarts'
  | 'line-breaks'
  | 'tries';

const DRILLDOWN_STAT_KEYS: Record<DrilldownId, string | string[]> = {
  'attack-passes': 'pass:standard',
  'defense-passes': 'pass:defense',
  'system-moments': 'kind:system_moment',
  'forced-turnovers': 'kind:forced_turnover',
  negatives: 'neg:all',
  'penalties-conceded': 'pen:conceded',
  'pen-attack-awarded': 'pen:awarded:attack',
  'pen-attack-conceded': 'pen:conceded:attack',
  'pen-defense-awarded': 'pen:awarded:defense',
  'pen-defense-conceded': 'pen:conceded:defense',
  'knock-ons': 'neg:knock_on',
  'attack-restarts': 'restart:attack',
  'line-breaks': 'kind:line_break',
  tries: 'kind:try',
};

type KpiHelp = {
  meaning: string;
  formula?: string;
  readAs: string;
};

type KpiDef = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  help: KpiHelp;
  drilldown?: DrilldownId | DrilldownId[];
};

function InferredKpi({
  def,
  open,
  onToggle,
  panelId,
  events,
  substitutions,
  playersById,
  filmSession,
  matchLabelsByMatchId,
  matchOrder,
}: {
  def: KpiDef;
  open: boolean;
  onToggle: () => void;
  panelId: string;
  events?: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById?: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  matchLabelsByMatchId?: Map<string, string>;
  matchOrder?: string[];
}) {
  const drilldownPayload =
    open && events && def.drilldown
      ? (() => {
          const keys = Array.isArray(def.drilldown) ? def.drilldown : [def.drilldown];
          const statKeys = keys.flatMap((id) => {
            const mapped = DRILLDOWN_STAT_KEYS[id];
            return Array.isArray(mapped) ? mapped : [mapped];
          });
          const merged = mergeEventPayloads(
            statKeys.map((key) => getPanelPayload(key, events, substitutions, matchOrder)),
          );
          return {
            type: 'events' as const,
            items: matchOrder && matchOrder.length > 0 ? sortPooledEvents(merged, matchOrder) : merged,
          };
        })()
      : null;

  return (
    <div className={`inferred-kpi-wrap${open ? ' inferred-kpi-wrap--open' : ''}`}>
      <button
        type="button"
        className={`team-global-kpi inferred-kpi inferred-kpi-btn${open ? ' inferred-kpi-btn--open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="team-global-kpi-label">{def.label}</span>
        <span className="team-global-kpi-value tabular-nums">{def.value}</span>
        {def.sub ? <span className="team-global-kpi-sub muted">{def.sub}</span> : null}
      </button>
      {open ? (
        <div id={panelId} className="inferred-kpi-detail" role="region" aria-label={`${def.label} details`}>
          <p className="inferred-kpi-meaning">{def.help.meaning}</p>
          {def.help.formula ? (
            <p className="inferred-kpi-formula muted">
              <strong>Formula:</strong> {def.help.formula}
            </p>
          ) : null}
          <p className="inferred-kpi-read muted">
            <strong>How to read:</strong> {def.help.readAs}
          </p>
          {drilldownPayload ? (
            <StatExpandContent
              payload={drilldownPayload}
              playersById={playersById ?? new Map()}
              filmSession={filmSession ?? null}
              empty="No matching log entries."
              matchLabelsByMatchId={matchLabelsByMatchId}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function KpiRow({
  defs,
  expandedKey,
  onToggle,
  idPrefix,
  events,
  substitutions,
  playersById,
  filmSession,
  matchLabelsByMatchId,
  matchOrder,
}: {
  defs: KpiDef[];
  expandedKey: string | null;
  onToggle: (id: string) => void;
  idPrefix: string;
  events?: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById?: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  matchLabelsByMatchId?: Map<string, string>;
  matchOrder?: string[];
}) {
  return (
    <div className="team-global-kpi-row inferred-kpi-row">
      {defs.map((def) => (
        <InferredKpi
          key={def.id}
          def={def}
          open={expandedKey === def.id}
          onToggle={() => onToggle(def.id)}
          panelId={`${idPrefix}-${def.id}`}
          events={events}
          substitutions={substitutions}
          playersById={playersById}
          filmSession={filmSession}
          matchLabelsByMatchId={matchLabelsByMatchId}
          matchOrder={matchOrder}
        />
      ))}
    </div>
  );
}

type Props = {
  stats: InferredMatchStats;
  events?: MatchEventRecord[];
  substitutions?: SubstitutionRecord[];
  playersById?: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  matchLabelsByMatchId?: Map<string, string>;
  matchOrder?: string[];
};

export function InferredStatsSection({
  stats,
  events,
  substitutions = [],
  playersById,
  filmSession,
  matchLabelsByMatchId,
  matchOrder,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const idPrefix = useId().replace(/:/g, '');

  const toggle = (id: string) => setExpandedKey((k) => (k === id ? null : id));

  const ballSpeed: KpiDef[] = [
    {
      id: 'attack-passes',
      label: 'Attack passes',
      value: String(stats.attackPasses),
      sub: stats.attackOffloads > 0 ? `${stats.attackOffloads} offloads` : undefined,
      drilldown: 'attack-passes',
      help: {
        meaning: 'Passes your team logged while on the Attack tab (standard passes only; offloads counted separately).',
        readAs: 'Raw volume — compare game to game or vs opponent pass counts.',
      },
    },
    {
      id: 'opp-passes',
      label: 'Opp passes logged',
      value: String(stats.defensePasses),
      sub:
        stats.oppPassesPerDefenseMin != null
          ? `${stats.oppPassesPerDefenseMin} passes/min while defending`
          : undefined,
      drilldown: 'defense-passes',
      help: {
        meaning:
          'Each time you tapped Pass on the Defense tab to track an opponent pass. The rate divides this count by estimated minutes spent on defense — it is not “minutes defending.”',
        formula: 'Opp pass rate = opp passes ÷ defense playing time (minutes)',
        readAs:
          'Higher rate = they moved the ball more while you were defending. Only as complete as your Defense pass logging.',
      },
    },
    {
      id: 'lb-try',
      label: 'LB → try %',
      value: fmtPct(stats.lineBreakToTryPct),
      drilldown: ['line-breaks', 'tries'],
      help: {
        meaning: 'Share of your line breaks that were followed by a try.',
        formula: 'Tries ÷ line breaks',
        readAs: 'Higher is better — you are finishing breaks. Needs line breaks logged to mean anything.',
      },
    },
    {
      id: 'pass-chain',
      label: 'Avg pass chain',
      value: stats.avgPassChainLength != null ? String(stats.avgPassChainLength) : '—',
      sub: stats.maxPassChainLength > 0 ? `longest ${stats.maxPassChainLength}` : undefined,
      help: {
        meaning: 'Average number of consecutive our-team passes before a non-pass event ends the chain.',
        readAs: 'Higher often means more ball movement before a break, kick, or error.',
      },
    },
  ];

  const structure: KpiDef[] = [
    ...(stats.possessionsTotal > 0
      ? [
          {
            id: 'possessions-us',
            label: 'Possessions (us)',
            value: String(stats.possessionsUs),
            sub:
              stats.passesPerPossessionUs != null
                ? `${stats.passesPerPossessionUs} passes / poss`
                : undefined,
            help: {
              meaning:
                'Attack spells from gaining the ball (restart won, steal, penalty) through conversion, turnover, or set-piece lost.',
              readAs:
                'Higher count = more times you had the ball. Ends after conversion (not at try alone), knock-on, penalty conceded, or set-piece lost.',
            },
          } satisfies KpiDef,
          {
            id: 'possessions-opp',
            label: 'Possessions (opp)',
            value: String(stats.possessionsOpp),
            sub:
              stats.passesPerPossessionOpp != null
                ? `${stats.passesPerPossessionOpp} opp passes / poss`
                : undefined,
            help: {
              meaning:
                'Opponent attack spells inferred from their try/conversion sequences, opp passes logged, and restart/set-piece outcomes.',
              readAs: 'Lower is often better — fewer times they held the ball through a full phase.',
            },
          } satisfies KpiDef,
          {
            id: 'possessions-total',
            label: 'Total possessions',
            value: String(stats.possessionsTotal),
            sub: `${stats.possessionsUs} us · ${stats.possessionsOpp} opp`,
            help: {
              meaning: 'Combined attack possessions for both teams in the match.',
              readAs: 'Use with Time & phases to estimate how long each team had the ball per possession.',
            },
          } satisfies KpiDef,
        ]
      : []),
    {
      id: 'system-moments',
      label: 'System moments',
      value: String(stats.systemMoments),
      sub:
        stats.systemMomentsPerOffenseMin != null
          ? `${stats.systemMomentsPerOffenseMin} / offense min`
          : undefined,
      drilldown: 'system-moments',
      help: {
        meaning: 'Positive attack system plays logged with the gold System Moment button.',
        formula: 'Rate = system moments ÷ offense playing time (minutes)',
        readAs: 'Higher rate = more structured attack actions per minute with the ball.',
      },
    },
    {
      id: 'possession-swings',
      label: 'Possession swings',
      value: String(stats.possessionSwings),
      sub:
        stats.defenseRucksWon > 0
          ? `${fmtPct(stats.possessionSwingPct)} of ${stats.defenseRucksWon} def ruck wins`
          : undefined,
      help: {
        meaning:
          'Defense ruck won, then your team completes a pass within 45 seconds — a turnover that immediately turns into attack.',
        readAs: 'Higher count and % = more successful steal-and-go sequences after defensive ruck wins.',
      },
    },
    {
      id: 'restart-receive',
      label: 'Restart receive won %',
      value: fmtPct(stats.attackRestartWonPct),
      sub:
        stats.attackRestarts > 0
          ? `${stats.attackRestartsWon}W · ${stats.attackRestartsLost}L of ${stats.attackRestarts} restarts`
          : undefined,
      drilldown: 'attack-restarts',
      help: {
        meaning:
          'When receiving kickoffs/restarts in Attack, share where you logged W on the restart (won possession). Only restarts with W or L count — penalized/free-kick outcomes are excluded.',
        formula: 'Attack restart wins ÷ (wins + losses)',
        readAs:
          'Yes — ~42% means you won roughly 4 in 10 receiving restarts that had a clear W/L. Higher is better.',
      },
    },
  ];

  const discipline: KpiDef[] = [
    ...(stats.forcedTurnovers > 0
      ? [
          {
            id: 'forced-turnovers',
            label: 'Forced turnovers',
            value: String(stats.forcedTurnovers),
            sub: 'Logged from Defense (gold button)',
            drilldown: 'forced-turnovers' as const,
            help: {
              meaning:
                'Positive defensive turnovers you logged deliberately — e.g. dominant tackle forcing a knock-on.',
              readAs: 'Higher is better. Each tap is one forced turnover event; no formula — just your button logs.',
            },
          } satisfies KpiDef,
        ]
      : []),
    {
      id: 'pen-net-attack',
      label: 'Pen net (attack)',
      value: fmtSigned(stats.penaltyNetAttack),
      sub: `${stats.penAttackAwarded} awarded − ${stats.penAttackConceded} conceded`,
      drilldown: ['pen-attack-awarded', 'pen-attack-conceded'],
      help: {
        meaning: 'Penalty differential while logged on the Attack tab.',
        formula: 'Pen + (awarded) − Pen − (conceded) in attack',
        readAs: '+6 is good — you drew six more attack-phase penalties than you gave away. Negative is bad.',
      },
    },
    {
      id: 'pen-net-defense',
      label: 'Pen net (defense)',
      value: fmtSigned(stats.penaltyNetDefense),
      sub: `${stats.penDefenseAwarded} awarded − ${stats.penDefenseConceded} conceded`,
      drilldown: ['pen-defense-awarded', 'pen-defense-conceded'],
      help: {
        meaning: 'Penalty differential while logged on the Defense tab.',
        formula: 'Pen + (awarded) − Pen − (conceded) in defense',
        readAs: '−3 means three more defense-phase penalties conceded than awarded. Higher (positive) is better.',
      },
    },
    {
      id: 'error-clusters',
      label: 'Costly knock-ons',
      value: stats.knockOns > 0 ? `${stats.errorClusters}/${stats.knockOns}` : String(stats.errorClusters),
      sub: 'knock-ons → turnover within 90s',
      drilldown: 'knock-ons',
      help: {
        meaning:
          'Knock-ons where the opponent scored a try or you lost a set piece (restart/ruck/scrum/lineout lost on defense) within 90 seconds.',
        formula: 'Counted knock-ons with a scoring/possession-loss event soon after',
        readAs:
          '6/10 means six of ten knock-ons were quickly punished. Lower fraction is better — fewer errors that hurt immediately.',
      },
    },
    {
      id: 'try-drought',
      label: 'Longest try drought',
      value: fmtMin(stats.longestTryDroughtMs),
      drilldown: 'tries',
      help: {
        meaning: 'Longest gap between your tries in this match (or selected matches).',
        readAs: 'Shorter gaps = more consistent scoring. Only shown when you scored 2+ tries.',
      },
    },
    {
      id: 'try-gap',
      label: 'Avg try gap',
      value: fmtMin(stats.avgTryGapMs),
      drilldown: 'tries',
      help: {
        meaning: 'Average time between your tries.',
        readAs: 'Lower = tries coming more frequently across the game.',
      },
    },
    {
      id: 'scoring-burst',
      label: 'Max pts / 2 min',
      value: String(stats.maxPointsIn2Min),
      help: {
        meaning: 'Most points you scored in any rolling 2-minute window.',
        readAs: 'Shows your best scoring burst — useful for momentum spells.',
      },
    },
  ];

  return (
    <div className="inferred-stats-grid">
      <p className="muted tgs-card-sub inferred-stats-intro">
        Tap any metric for what it means, how to read it, and the underlying log entries.
      </p>

      {hasRuckBreakdownData(stats.ruckByPhase) && (
        <RuckPhaseBreakdownPanel breakdown={stats.ruckByPhase} />
      )}

      <h4 className="tgs-card-subtitle">Ball speed & retention</h4>
      <KpiRow
        defs={ballSpeed}
        expandedKey={expandedKey}
        onToggle={toggle}
        idPrefix={idPrefix}
        events={events}
        substitutions={substitutions}
        playersById={playersById}
        filmSession={filmSession}
        matchLabelsByMatchId={matchLabelsByMatchId}
        matchOrder={matchOrder}
      />

      <h4 className="tgs-card-subtitle">Structure & pressure</h4>
      <KpiRow
        defs={structure}
        expandedKey={expandedKey}
        onToggle={toggle}
        idPrefix={idPrefix}
        events={events}
        substitutions={substitutions}
        playersById={playersById}
        filmSession={filmSession}
        matchLabelsByMatchId={matchLabelsByMatchId}
        matchOrder={matchOrder}
      />

      <h4 className="tgs-card-subtitle">Discipline & momentum</h4>
      <KpiRow
        defs={discipline}
        expandedKey={expandedKey}
        onToggle={toggle}
        idPrefix={idPrefix}
        events={events}
        substitutions={substitutions}
        playersById={playersById}
        filmSession={filmSession}
        matchLabelsByMatchId={matchLabelsByMatchId}
        matchOrder={matchOrder}
      />
    </div>
  );
}
