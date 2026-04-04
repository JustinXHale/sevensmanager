import { useState } from 'react';
import type { MatchEventRecord } from '@/domain/matchEvent';
import type { PlayerRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import { ruckToFirstPassDurationsMs } from '@/domain/matchStats';
import { ZONE_IDS } from '@/domain/zone';
import {
  buildPlayerProfiles,
  buildZoneHeatRows,
  negativeActionBreakdown,
  penaltyCountByType,
  playerInvolvement,
  ruckSpeedByPeriod,
  ruckSpeedDistribution,
  ruckSpeedMedianMs,
  scoringTimeline,
  setPieceByPhase,
  tempoByPeriod,
  type PlayerProfile,
  type ZoneHeatRow,
} from '@/domain/matchAnalyticsDeep';

type Props = {
  events: MatchEventRecord[];
  playersById: Map<string, PlayerRecord>;
};

const BAD_ZONE_KINDS = new Set(['tackle_missed', 'negative', 'penalty']);

function zoneIntensityClass(value: number, max: number, bad?: boolean): string {
  if (max === 0 || value === 0) return 'deep-heat-z deep-heat-z--0';
  const pct = value / max;
  const prefix = bad ? 'bad-' : '';
  if (pct >= 0.75) return `deep-heat-z deep-heat-z--${prefix}4`;
  if (pct >= 0.5) return `deep-heat-z deep-heat-z--${prefix}3`;
  if (pct >= 0.25) return `deep-heat-z deep-heat-z--${prefix}2`;
  return `deep-heat-z deep-heat-z--${prefix}1`;
}

function ZoneHeatMap({ rows }: { rows: ZoneHeatRow[] }) {
  if (rows.length === 0) {
    return <p className="muted deep-section-empty">No events with zone data logged yet.</p>;
  }
  return (
    <div className="deep-heat-table" role="table" aria-label="Zone heat map">
      <div className="deep-heat-header" role="row">
        <span className="deep-heat-label" role="columnheader" />
        {ZONE_IDS.map((z) => (
          <span key={z} className="deep-heat-zh" role="columnheader">{z}</span>
        ))}
        <span className="deep-heat-zh deep-heat-zh--total" role="columnheader">{'\u03a3'}</span>
      </div>
      {rows.map((row) => {
        const rowMax = Math.max(...ZONE_IDS.map((z) => row.zones[z]));
        const bad = BAD_ZONE_KINDS.has(row.kind);
        return (
          <div key={row.kind} className={`deep-heat-row${bad ? ' deep-heat-row--bad' : ''}`} role="row">
            <span className="deep-heat-label" role="rowheader">{row.label}</span>
            {ZONE_IDS.map((z) => (
              <span
                key={z}
                className={zoneIntensityClass(row.zones[z], rowMax, bad)}
                role="cell"
                aria-label={`${row.label} ${z}: ${row.zones[z]}`}
              >
                {row.zones[z] > 0 ? row.zones[z] : ''}
              </span>
            ))}
            <span className="deep-heat-z deep-heat-z--total" role="cell">{row.total}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerProfileTable({
  profiles,
  playersById,
}: {
  profiles: Map<string, PlayerProfile>;
  playersById: Map<string, PlayerRecord>;
}) {
  const sorted = [...profiles.values()].sort((a, b) => playerInvolvement(b) - playerInvolvement(a));
  const [expanded, setExpanded] = useState<string | null>(null);

  if (sorted.length === 0) {
    return <p className="muted deep-section-empty">No player events logged yet.</p>;
  }

  return (
    <div className="deep-player-list">
      {sorted.map((p) => {
        const player = playersById.get(p.playerId);
        const label = player ? formatPlayerLabel(player) : p.playerId;
        const inv = playerInvolvement(p);
        const tMade = p.tackles.made;
        const tMissed = p.tackles.missed;
        const tacklePct = tMade + tMissed > 0 ? Math.round((tMade / (tMade + tMissed)) * 100) : null;
        const isExpanded = expanded === p.playerId;

        return (
          <div key={p.playerId} className={`deep-player-card${isExpanded ? ' deep-player-card--open' : ''}`}>
            <button
              type="button"
              className="deep-player-summary"
              aria-expanded={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : p.playerId)}
            >
              <span className="deep-player-name">{label}</span>
              <span className="deep-player-chips">
                {p.passes > 0 && <span className="deep-chip">{p.passes}P</span>}
                {tMade + tMissed > 0 && (
                  <span className="deep-chip">{tMade}T{tMissed > 0 ? ` ${tMissed}X` : ''}</span>
                )}
                {p.lineBreaks > 0 && <span className="deep-chip deep-chip--good">{p.lineBreaks}LB</span>}
                {p.tries > 0 && <span className="deep-chip deep-chip--good">{p.tries}Tr</span>}
                {p.negatives > 0 && <span className="deep-chip deep-chip--bad">{p.negatives}Neg</span>}
                {p.penalties > 0 && <span className="deep-chip deep-chip--bad">{p.penalties}Pen</span>}
              </span>
              <span className="deep-player-inv muted">{inv} acts</span>
            </button>
            {isExpanded && (
              <div className="deep-player-detail">
                <dl className="deep-player-dl">
                  <div className="deep-dl-pair">
                    <dt>Passes</dt>
                    <dd>{p.passes}{p.offloads > 0 ? ` (${p.offloads} offloads)` : ''}</dd>
                  </div>
                  <div className="deep-dl-pair">
                    <dt>Tackles</dt>
                    <dd>
                      {tMade}M / {tMissed}X{tacklePct != null ? ` (${tacklePct}%)` : ''}
                    </dd>
                  </div>
                  {tMade > 0 && (
                    <div className="deep-dl-pair">
                      <dt>Tackle quality</dt>
                      <dd>{p.tackles.dominant}D / {p.tackles.neutral}N / {p.tackles.passive}P</dd>
                    </div>
                  )}
                  <div className="deep-dl-pair">
                    <dt>Line breaks</dt>
                    <dd>{p.lineBreaks}</dd>
                  </div>
                  <div className="deep-dl-pair">
                    <dt>Tries / Conv.</dt>
                    <dd>{p.tries}T / {p.conversions.made}M {p.conversions.missed}X</dd>
                  </div>
                  {p.negatives > 0 && (
                    <div className="deep-dl-pair">
                      <dt>Negatives</dt>
                      <dd>
                        {Object.entries(p.negativeBreakdown).map(([nid, cnt]) => (
                          <span key={nid} className="deep-neg-tag">
                            {nid === 'bad_pass' ? 'Bad pass' : nid === 'knock_on' ? 'Knock-on' : nid === 'forward_pass' ? 'Fwd pass' : nid}{' '}
                            {cnt}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {p.penalties > 0 && (
                    <div className="deep-dl-pair">
                      <dt>Penalties</dt>
                      <dd>
                        {p.penalties}
                        {p.cards.yellow > 0 ? ` · ${p.cards.yellow} YC` : ''}
                        {p.cards.red > 0 ? ` · ${p.cards.red} RC` : ''}
                      </dd>
                    </div>
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

function RuckSpeedSection({ events }: { events: MatchEventRecord[] }) {
  const durations = ruckToFirstPassDurationsMs(events);
  const medianMs = ruckSpeedMedianMs(durations);
  const dist = ruckSpeedDistribution(durations);
  const byPeriod = ruckSpeedByPeriod(events);
  const distMax = Math.max(1, ...dist.map((b) => b.count));

  if (durations.length === 0) {
    return <p className="muted deep-section-empty">No ruck → pass pairs logged yet.</p>;
  }

  return (
    <div className="deep-ruck-section">
      <div className="deep-ruck-kpis">
        <div className="deep-ruck-kpi">
          <span className="deep-ruck-kpi-value">{(medianMs! / 1000).toFixed(1)}s</span>
          <span className="deep-ruck-kpi-label">Median</span>
        </div>
        <div className="deep-ruck-kpi">
          <span className="deep-ruck-kpi-value">{durations.length}</span>
          <span className="deep-ruck-kpi-label">Pairs</span>
        </div>
      </div>

      <h4 className="deep-sub-heading">Distribution</h4>
      <div className="deep-ruck-dist">
        {dist.map((b) => (
          <div key={b.label} className="deep-ruck-bucket">
            <div className="deep-ruck-bucket-bar-wrap">
              <div
                className="deep-ruck-bucket-bar"
                style={{ height: `${Math.round((b.count / distMax) * 100)}%` }}
              />
            </div>
            <span className="deep-ruck-bucket-count tabular-nums">{b.count}</span>
            <span className="deep-ruck-bucket-label muted">{b.label}</span>
          </div>
        ))}
      </div>

      {byPeriod.length > 1 && (
        <>
          <h4 className="deep-sub-heading">By period</h4>
          <div className="deep-ruck-period-list">
            {byPeriod.map((r) => (
              <div key={r.period} className="deep-ruck-period-row">
                <span className="deep-ruck-period-label">P{r.period}</span>
                <span className="tabular-nums">{(r.avgMs / 1000).toFixed(1)}s avg</span>
                <span className="muted">({r.count} pairs)</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PenaltyBreakdownSection({ events }: { events: MatchEventRecord[] }) {
  const rows = penaltyCountByType(events);
  if (rows.length === 0) {
    return <p className="muted deep-section-empty">No penalties with type logged yet.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="deep-penalty-list">
      {rows.map((r) => (
        <div key={r.type} className="deep-penalty-row">
          <span className="deep-penalty-label">{r.label}</span>
          <div className="deep-penalty-bar-track">
            <div className="deep-penalty-bar-fill" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </div>
          <span className="deep-penalty-count tabular-nums">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function NegativeBreakdownSection({ events }: { events: MatchEventRecord[] }) {
  const rows = negativeActionBreakdown(events);
  if (rows.length === 0) {
    return <p className="muted deep-section-empty">No negative actions logged yet.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="deep-penalty-list">
      {rows.map((r) => (
        <div key={r.id} className="deep-penalty-row">
          <span className="deep-penalty-label">{r.label}</span>
          <div className="deep-penalty-bar-track">
            <div className="deep-penalty-bar-fill deep-penalty-bar-fill--neg" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </div>
          <span className="deep-penalty-count tabular-nums">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function SetPiecePhaseSection({ events }: { events: MatchEventRecord[] }) {
  const kinds = ['scrum', 'lineout', 'ruck'] as const;
  const data = kinds.map((k) => ({ kind: k, breakdown: setPieceByPhase(events, k) }));
  const hasAny = data.some(
    (d) =>
      d.breakdown.attack.won + d.breakdown.attack.lost + d.breakdown.attack.penalized +
      d.breakdown.defense.won + d.breakdown.defense.lost + d.breakdown.defense.penalized > 0,
  );
  if (!hasAny) {
    return <p className="muted deep-section-empty">No set pieces with phase context logged yet.</p>;
  }
  const kindLabel = (k: string) => (k === 'scrum' ? 'Scrum' : k === 'lineout' ? 'Lineout' : 'Ruck');
  return (
    <div className="deep-setpiece-phase">
      {data.map(({ kind, breakdown }) => {
        const atk = breakdown.attack;
        const def = breakdown.defense;
        const atkTotal = atk.won + atk.lost + atk.penalized;
        const defTotal = def.won + def.lost + def.penalized;
        if (atkTotal + defTotal === 0) return null;
        return (
          <div key={kind} className="deep-setpiece-phase-block">
            <span className="deep-setpiece-phase-name">{kindLabel(kind)}</span>
            {atkTotal > 0 && (
              <div className="deep-setpiece-phase-line">
                <span className="deep-setpiece-phase-tag">Atk</span>
                <span className="tabular-nums">W{atk.won} L{atk.lost} P{atk.penalized}</span>
                <div className="deep-setpiece-phase-bar">
                  <div className="deep-sp-seg deep-sp-seg--won" style={{ flex: atk.won }} />
                  <div className="deep-sp-seg deep-sp-seg--lost" style={{ flex: atk.lost }} />
                  <div className="deep-sp-seg deep-sp-seg--pen" style={{ flex: atk.penalized }} />
                </div>
              </div>
            )}
            {defTotal > 0 && (
              <div className="deep-setpiece-phase-line">
                <span className="deep-setpiece-phase-tag">Def</span>
                <span className="tabular-nums">W{def.won} L{def.lost} P{def.penalized}</span>
                <div className="deep-setpiece-phase-bar">
                  <div className="deep-sp-seg deep-sp-seg--won" style={{ flex: def.won }} />
                  <div className="deep-sp-seg deep-sp-seg--lost" style={{ flex: def.lost }} />
                  <div className="deep-sp-seg deep-sp-seg--pen" style={{ flex: def.penalized }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TempoSection({ events }: { events: MatchEventRecord[] }) {
  const rows = tempoByPeriod(events);
  if (rows.length === 0) {
    return <p className="muted deep-section-empty">No event spread yet.</p>;
  }
  const maxRate = Math.max(1, ...rows.map((r) => r.perMinute));
  return (
    <div className="deep-tempo-list">
      {rows.map((r) => (
        <div key={r.period} className="deep-tempo-row">
          <span className="deep-tempo-label">P{r.period}</span>
          <div className="deep-tempo-bar-track">
            <div
              className="deep-tempo-bar-fill"
              style={{ width: `${Math.round((r.perMinute / maxRate) * 100)}%` }}
            />
          </div>
          <span className="deep-tempo-value tabular-nums">{r.perMinute}/min</span>
          <span className="deep-tempo-meta muted">({r.events} evts)</span>
        </div>
      ))}
    </div>
  );
}

function ScoringTimelineSection({ events }: { events: MatchEventRecord[] }) {
  const tl = scoringTimeline(events);
  if (tl.length === 0) {
    return <p className="muted deep-section-empty">No scoring events logged yet.</p>;
  }
  const maxPts = Math.max(1, ...tl.map((m) => Math.max(m.runningUs, m.runningOpp)));
  const fmtMin = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="deep-timeline">
      {tl.map((m, i) => (
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
  );
}

export function MatchDeepStatsView({ events, playersById }: Props) {
  const heatRows = buildZoneHeatRows(events);
  const profiles = buildPlayerProfiles(events);

  return (
    <div className="deep-stats-view" aria-label="Deep analytics">
      <section className="deep-section">
        <h3 className="deep-section-title">Zone heat map</h3>
        <p className="muted deep-section-lead">Event density across field zones — brighter = more activity.</p>
        <ZoneHeatMap rows={heatRows} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Player profiles</h3>
        <p className="muted deep-section-lead">Per-player totals ranked by involvement. Tap to expand.</p>
        <PlayerProfileTable profiles={profiles} playersById={playersById} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Ruck speed (ruck → pass)</h3>
        <p className="muted deep-section-lead">Time from each ruck to the next pass in the same half.</p>
        <RuckSpeedSection events={events} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Penalty breakdown</h3>
        <p className="muted deep-section-lead">Own team penalties by infraction type.</p>
        <PenaltyBreakdownSection events={events} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Negative actions</h3>
        <p className="muted deep-section-lead">Bad pass, knock-on, forward pass counts.</p>
        <NegativeBreakdownSection events={events} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Set pieces by phase</h3>
        <p className="muted deep-section-lead">Own ball (attack) vs opposition ball (defense) outcomes.</p>
        <SetPiecePhaseSection events={events} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Tempo</h3>
        <p className="muted deep-section-lead">Logged events per minute by period — proxy for intensity.</p>
        <TempoSection events={events} />
      </section>

      <section className="deep-section">
        <h3 className="deep-section-title">Scoring timeline</h3>
        <p className="muted deep-section-lead">Running score over match time.</p>
        <ScoringTimelineSection events={events} />
      </section>
    </div>
  );
}
