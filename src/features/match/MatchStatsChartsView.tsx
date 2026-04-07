import type { ReactNode } from 'react';
import type { MatchAnalyticsSnapshot, SetPieceSplit } from '@/domain/matchAnalytics';
import type { MatchEventKind } from '@/domain/matchEvent';
import type { KindCounts } from '@/domain/matchStats';
import { kindLabel } from '@/domain/matchStats';
import type { ZoneId } from '@/domain/zone';
import { ZONE_IDS } from '@/domain/zone';

export type MatchStatsScoringRow = {
  id: string;
  label: string;
  tries: number;
  conversions: number;
};

type Props = {
  kindOrder: MatchEventKind[];
  byKind: KindCounts;
  tacklesMade: number;
  tacklesMissed: number;
  substCount: number;
  triesZ: Record<ZoneId, number>;
  scoringRows: MatchStatsScoringRow[];
  periodRows: { period: number; count: number }[];
  timeHistogram: { bins: number[]; maxMs: number };
  analytics: MatchAnalyticsSnapshot;
};

function max1(n: number): number {
  return Math.max(1, n);
}

function pct(value: number, max: number): number {
  return Math.round((value / max1(max)) * 1000) / 10;
}

function ChartBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="live-stats-chart-block">
      <h3 className="live-stats-chart-title">{title}</h3>
      {description ? <p className="muted live-stats-chart-desc">{description}</p> : null}
      {children}
    </div>
  );
}

function setPieceStackTotal(sp: SetPieceSplit): number {
  return sp.won + sp.lost + sp.penalized + sp.freeKick;
}

function SetPieceOutcomeStack({ label, sp }: { label: string; sp: SetPieceSplit }) {
  const t = setPieceStackTotal(sp);
  if (t === 0) {
    return (
      <div className="live-stats-setpiece-chart-block">
        <div className="live-stats-hbar-label-row">
          <span className="live-stats-hbar-label">{label}</span>
          <span className="live-stats-hbar-value muted">—</span>
        </div>
      </div>
    );
  }
  return (
    <div className="live-stats-setpiece-chart-block">
      <div className="live-stats-hbar-label-row">
        <span className="live-stats-hbar-label">{label}</span>
        <span className="live-stats-hbar-value tabular-nums">
          W {sp.won} · L {sp.lost}
          {sp.freeKick > 0 ? <> · FK {sp.freeKick}</> : null} · Pen {sp.penalized}
        </span>
      </div>
      <div
        className="live-stats-setpiece-stack"
        role="img"
        aria-label={`${label}: ${sp.won} won, ${sp.lost} lost, ${sp.penalized} penalized, ${sp.freeKick} free kick`}
      >
        <div className="live-stats-setpiece-seg live-stats-setpiece-seg--won" style={{ flex: sp.won }} />
        <div className="live-stats-setpiece-seg live-stats-setpiece-seg--lost" style={{ flex: sp.lost }} />
        <div className="live-stats-setpiece-seg live-stats-setpiece-seg--fk" style={{ flex: sp.freeKick }} />
        <div className="live-stats-setpiece-seg live-stats-setpiece-seg--pen" style={{ flex: sp.penalized }} />
      </div>
    </div>
  );
}

function HBarRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: number }) {
  const w = pct(value, max);
  return (
    <div className="live-stats-hbar">
      <div className="live-stats-hbar-label-row">
        <span className="live-stats-hbar-label">{label}</span>
        <span className="live-stats-hbar-value tabular-nums">{value}</span>
      </div>
      <div className="live-stats-hbar-track" role="presentation">
        <div
          className={`live-stats-hbar-fill live-stats-hbar-fill--tone-${((tone % 6) + 6) % 6}`}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

export function MatchStatsChartsView({
  kindOrder,
  byKind,
  tacklesMade,
  tacklesMissed,
  substCount,
  triesZ,
  scoringRows,
  periodRows,
  timeHistogram,
  analytics,
}: Props) {
  const eventMixRows = [
    ...kindOrder.map((kind) => ({ label: kindLabel(kind), value: byKind[kind] ?? 0, kind: `k-${kind}` })),
    { label: 'Substitutions', value: substCount, kind: 'subs' },
  ];
  const eventMixMax = Math.max(1, ...eventMixRows.map((r) => r.value));

  const tackleTotal = tacklesMade + tacklesMissed;
  const madePct = tackleTotal > 0 ? pct(tacklesMade, tackleTotal) : 0;
  const missedPct = tackleTotal > 0 ? pct(tacklesMissed, tackleTotal) : 0;

  const zoneRows = ZONE_IDS.map((z) => ({ label: z, value: triesZ[z] ?? 0 }));
  const zoneMax = Math.max(1, ...zoneRows.map((r) => r.value));

  const periodMax = Math.max(1, ...periodRows.map((r) => r.count), 0);
  const histMax = Math.max(1, ...timeHistogram.bins, 0);

  const scoringBars = scoringRows.map((r) => ({
    id: r.id,
    label: r.label,
    value: r.tries + r.conversions,
    tries: r.tries,
    conversions: r.conversions,
  }));
  const scoringMax = Math.max(1, ...scoringBars.map((r) => r.value), 0);

  const ter = analytics.territory;
  const terSum = ter.defensive + ter.middle + ter.attack;
  const terMax = Math.max(1, terSum);

  const ownKickDecided = analytics.ownKick.made + analytics.ownKick.missed;
  const oppKickDecided = analytics.oppKick.made + analytics.oppKick.missed;

  return (
    <div className="live-stats-charts" aria-label="Visual analytics">
      <ChartBlock
        title="Points & margin"
        description="Rugby points from logged tries and made conversions (same as the live scoreboard)."
      >
        {analytics.ownPoints + analytics.oppPoints > 0 ? (
          <div className="live-stats-points-viz">
            <div
              className="live-stats-points-bar"
              role="img"
              aria-label={`${analytics.ownPoints} us, ${analytics.oppPoints} them`}
            >
              <div
                className="live-stats-points-seg live-stats-points-seg--us"
                style={{
                  width: `${pct(analytics.ownPoints, analytics.ownPoints + analytics.oppPoints)}%`,
                }}
              />
              <div
                className="live-stats-points-seg live-stats-points-seg--opp"
                style={{
                  width: `${pct(analytics.oppPoints, analytics.ownPoints + analytics.oppPoints)}%`,
                }}
              />
            </div>
            <div className="live-stats-points-legend">
              <span>
                <span className="live-stats-dot live-stats-dot--us" /> Us {analytics.ownPoints}
              </span>
              <span>
                <span className="live-stats-dot live-stats-dot--opp" /> Opp {analytics.oppPoints}
              </span>
            </div>
          </div>
        ) : (
          <p className="muted live-stats-chart-empty">No scoring events logged yet.</p>
        )}
      </ChartBlock>

      <ChartBlock
        title="Set piece outcomes"
        description="Scrums, lineouts, rucks, and kick/receive restarts — won, lost, free kick, or penalized."
      >
        <div className="live-stats-setpiece-chart-list">
          <SetPieceOutcomeStack label="Scrums" sp={analytics.scrums} />
          <SetPieceOutcomeStack label="Lineouts" sp={analytics.lineouts} />
          <SetPieceOutcomeStack label="Rucks" sp={analytics.rucks} />
          <SetPieceOutcomeStack label="Restarts" sp={analytics.restarts} />
        </div>
        <div className="live-stats-setpiece-legend muted">
          <span>
            <span className="live-stats-setpiece-dot live-stats-setpiece-dot--won" /> Won
          </span>
          <span>
            <span className="live-stats-setpiece-dot live-stats-setpiece-dot--lost" /> Lost
          </span>
          <span>
            <span className="live-stats-setpiece-dot live-stats-setpiece-dot--fk" /> Free kick
          </span>
          <span>
            <span className="live-stats-setpiece-dot live-stats-setpiece-dot--pen" /> Penalized
          </span>
        </div>
      </ChartBlock>

      <ChartBlock
        title="Subs & cards (Us vs Opp)"
        description="Substitutions from roster changes vs opponent subs; cards from penalties / Opp tab."
      >
        <div className="live-stats-hbar-list">
          <HBarRow label="Our subs" value={analytics.subsOurs} max={Math.max(1, analytics.subsOurs, analytics.subsOpp)} tone={0} />
          <HBarRow label="Opponent subs" value={analytics.subsOpp} max={Math.max(1, analytics.subsOurs, analytics.subsOpp)} tone={1} />
          <HBarRow
            label="Our YC / RC"
            value={analytics.cardsOurs.yc + analytics.cardsOurs.rc}
            max={Math.max(1, analytics.cardsOurs.yc + analytics.cardsOurs.rc, analytics.cardsOpp.yc + analytics.cardsOpp.rc)}
            tone={2}
          />
          <HBarRow
            label="Opp YC / RC"
            value={analytics.cardsOpp.yc + analytics.cardsOpp.rc}
            max={Math.max(1, analytics.cardsOurs.yc + analytics.cardsOurs.rc, analytics.cardsOpp.yc + analytics.cardsOpp.rc)}
            tone={3}
          />
        </div>
      </ChartBlock>

      <ChartBlock
        title="Conversion kicks (decided)"
        description="Made vs missed when you logged the outcome — legacy kicks without outcome are omitted here."
      >
        {ownKickDecided + oppKickDecided > 0 ? (
          <div className="live-stats-stack-wrap">
            {ownKickDecided > 0 ? (
              <p className="live-stats-kick-line muted">
                Us: {analytics.ownKick.made} made · {analytics.ownKick.missed} missed
              </p>
            ) : null}
            {oppKickDecided > 0 ? (
              <p className="live-stats-kick-line muted">
                Opp: {analytics.oppKick.made} made · {analytics.oppKick.missed} missed
              </p>
            ) : null}
            {ownKickDecided > 0 ? (
              <div className="live-stats-stack-bar live-stats-stack-bar--kick" aria-label="Own conversion outcomes">
                <div
                  className="live-stats-stack-seg live-stats-stack-seg--made"
                  style={{ width: `${pct(analytics.ownKick.made, ownKickDecided)}%` }}
                />
                <div
                  className="live-stats-stack-seg live-stats-stack-seg--missed"
                  style={{ width: `${pct(analytics.ownKick.missed, ownKickDecided)}%` }}
                />
              </div>
            ) : null}
            {oppKickDecided > 0 ? (
              <div className="live-stats-stack-bar live-stats-stack-bar--kick" aria-label="Opponent conversion outcomes">
                <div
                  className="live-stats-stack-seg live-stats-stack-seg--made"
                  style={{ width: `${pct(analytics.oppKick.made, oppKickDecided)}%` }}
                />
                <div
                  className="live-stats-stack-seg live-stats-stack-seg--missed"
                  style={{ width: `${pct(analytics.oppKick.missed, oppKickDecided)}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted live-stats-chart-empty">No made/missed conversion outcomes logged yet.</p>
        )}
      </ChartBlock>

      <ChartBlock
        title="Own tries by territory"
        description="Z1–2 own end · Z3–4 midfield · Z5–6 attacking third (zoned tries only)."
      >
        {terSum > 0 ? (
          <div className="live-stats-hbar-list">
            <HBarRow label="Own end (Z1–2)" value={ter.defensive} max={terMax} tone={0} />
            <HBarRow label="Midfield (Z3–4)" value={ter.middle} max={terMax} tone={1} />
            <HBarRow label="Attack third (Z5–6)" value={ter.attack} max={terMax} tone={2} />
          </div>
        ) : (
          <p className="muted live-stats-chart-empty">No zoned tries yet — try logging zone on scores.</p>
        )}
      </ChartBlock>

      <ChartBlock
        title="Event mix"
        description="Relative volume of logged event types (same totals as Numbers view)."
      >
        <div className="live-stats-hbar-list">
          {eventMixRows.map((r, i) => (
            <HBarRow key={r.kind} label={r.label} value={r.value} max={eventMixMax} tone={i} />
          ))}
        </div>
      </ChartBlock>

      <ChartBlock
        title="Tackle outcomes"
        description={tackleTotal === 0 ? 'No tackle rows logged yet.' : 'Share of logged tackles (made vs missed).'}
      >
        {tackleTotal > 0 ? (
          <div className="live-stats-stack-wrap">
            <div className="live-stats-stack-bar" role="img" aria-label={`${tacklesMade} made, ${tacklesMissed} missed`}>
              <div
                className="live-stats-stack-seg live-stats-stack-seg--made"
                style={{ width: `${madePct}%` }}
                title={`Made ${tacklesMade}`}
              />
              <div
                className="live-stats-stack-seg live-stats-stack-seg--missed"
                style={{ width: `${missedPct}%` }}
                title={`Missed ${tacklesMissed}`}
              />
            </div>
            <div className="live-stats-stack-legend">
              <span>
                <span className="live-stats-dot live-stats-dot--made" /> Made {tacklesMade}
              </span>
              <span>
                <span className="live-stats-dot live-stats-dot--missed" /> Missed {tacklesMissed}
              </span>
            </div>
          </div>
        ) : (
          <p className="muted live-stats-chart-empty">No tackle outcomes recorded yet.</p>
        )}
      </ChartBlock>

      <ChartBlock
        title="Activity by period"
        description="Event counts per match period — useful for tempo and fatigue patterns."
      >
        {periodRows.length > 0 ? (
          <div className="live-stats-hbar-list">
            {periodRows.map((r, i) => (
              <HBarRow key={r.period} label={`P${r.period}`} value={r.count} max={periodMax} tone={i + 2} />
            ))}
          </div>
        ) : (
          <p className="muted live-stats-chart-empty">No events yet.</p>
        )}
      </ChartBlock>

      <ChartBlock
        title="Match time density"
        description={
          timeHistogram.maxMs > 0
            ? 'Where events cluster on the match clock — spikes can show “trains” of play.'
            : 'Bins by match time once the clock has advanced beyond 0:00.'
        }
      >
        {timeHistogram.bins.some((b) => b > 0) ? (
          <div className="live-stats-spark-wrap" role="img" aria-label="Histogram of events over match time">
            {timeHistogram.bins.map((count, i) => {
              const h = pct(count, histMax);
              return (
                <div key={i} className="live-stats-spark-col">
                  <div className="live-stats-spark-bar-wrap">
                    <div className="live-stats-spark-bar" style={{ height: `${h}%` }} title={`${count} events`} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted live-stats-chart-empty">Not enough spread on the clock yet.</p>
        )}
      </ChartBlock>

      <ChartBlock title="Tries by zone" description="Only tries logged with a field zone (same as Numbers view).">
        <div className="live-stats-hbar-list">
          {zoneRows.map((r, i) => (
            <HBarRow key={r.label} label={r.label} value={r.value} max={zoneMax} tone={i} />
          ))}
        </div>
      </ChartBlock>

      {scoringBars.length > 0 ? (
        <ChartBlock
          title="Scoring volume by player"
          description="Bar length = tries + conversions logged (not rugby points)."
        >
          <div className="live-stats-hbar-list">
            {scoringBars.map((r, i) => (
              <div key={r.id} className="live-stats-hbar">
                <div className="live-stats-hbar-label-row">
                  <span className="live-stats-hbar-label">{r.label}</span>
                  <span className="live-stats-hbar-meta tabular-nums">
                    {r.tries > 0 ? `${r.tries}T` : ''}
                    {r.tries > 0 && r.conversions > 0 ? ' ' : ''}
                    {r.conversions > 0 ? `${r.conversions}C` : ''}
                  </span>
                </div>
                <div className="live-stats-hbar-track" role="presentation">
                  <div
                    className={`live-stats-hbar-fill live-stats-hbar-fill--tone-${((i % 6) + 6) % 6}`}
                    style={{ width: `${pct(r.value, scoringMax)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartBlock>
      ) : null}
    </div>
  );
}
