import {
  computeMatchAnalyticsSnapshot,
  kickDecidedSuccessPct,
  type SetPieceSplit,
} from '@/domain/matchAnalytics';
import {
  negativeActionBreakdown,
  penaltyCountByType,
  phaseTimeSplit,
} from '@/domain/matchAnalyticsDeep';
import { computeInferredMatchStats } from '@/domain/inferredStats';
import type { InferredMatchStats } from '@/domain/inferredStats';
import { formatClock } from '@/domain/matchClock';
import type { MatchRecord } from '@/domain/match';
import type { MatchEventRecord } from '@/domain/matchEvent';
import type { PlayerRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import { sortMatchEventsByTime, triesAndConversionsByPlayer } from '@/domain/matchStats';
import type { TeamGlobalAggregate } from '@/domain/teamGlobalStats';
import type { TeamRecord } from '@/domain/team';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(n: number | null): string {
  return n != null ? `${n}%` : '—';
}

function fmtDurationMs(ms: number | null): string {
  if (ms == null) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function setPieceWonPct(sp: SetPieceSplit): string {
  const d = sp.won + sp.lost;
  return d > 0 ? fmtPct(Math.round((sp.won / d) * 1000) / 10) : '—';
}

function setPieceTableRow(label: string, sp: SetPieceSplit): string {
  return `<tr>
    <td>${escapeHtml(label)}</td>
    <td class="num">${sp.won}</td>
    <td class="num">${sp.lost}</td>
    <td class="num">${sp.penalized}</td>
    <td class="num">${sp.freeKick}</td>
    <td class="num">${setPieceWonPct(sp)}</td>
  </tr>`;
}

function inferredBullets(stats: InferredMatchStats): string {
  const lines: string[] = [];
  if (stats.attackPasses > 0 || stats.defensePasses > 0) {
    lines.push(`Passes: ${stats.attackPasses} attack · ${stats.defensePasses} opp logged`);
  }
  if (stats.attackRuckWonPct != null) {
    lines.push(`Attack ruck won: ${fmtPct(stats.attackRuckWonPct)}`);
  }
  if (stats.lineBreakToTryPct != null) {
    lines.push(`Line break → try: ${fmtPct(stats.lineBreakToTryPct)}`);
  }
  if (stats.attackRestartWonPct != null) {
    lines.push(
      `Restart receive won: ${fmtPct(stats.attackRestartWonPct)} (${stats.attackRestartsWon}W · ${stats.attackRestartsLost}L)`,
    );
  }
  if (stats.systemMoments > 0) {
    lines.push(`System moments: ${stats.systemMoments}`);
  }
  if (stats.forcedTurnovers > 0) {
    lines.push(`Forced turnovers: ${stats.forcedTurnovers}`);
  }
  if (stats.penaltiesConceded > 0 || stats.penaltyNetAttack !== 0 || stats.penaltyNetDefense !== 0) {
    lines.push(
      `Penalties conceded: ${stats.penaltiesConceded} (attack ${stats.penaltyNetAttack >= 0 ? '+' : ''}${stats.penaltyNetAttack}, defense ${stats.penaltyNetDefense >= 0 ? '+' : ''}${stats.penaltyNetDefense})`,
    );
  }
  if (stats.knockOns > 0) {
    lines.push(`Knock-ons: ${stats.knockOns}`);
  }
  if (stats.errorClusters > 0) {
    lines.push(`Error clusters (90s): ${stats.errorClusters}`);
  }
  return lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
}

function playerLabel(playersById: Map<string, PlayerRecord>, playerId?: string): string {
  if (!playerId) return 'Unassigned';
  const p = playersById.get(playerId);
  return p ? formatPlayerLabel(p) : 'Player';
}

function scorersTableSection(
  events: MatchEventRecord[],
  playersById: Map<string, PlayerRecord>,
): string {
  const byPlayer = triesAndConversionsByPlayer(events);
  const rows = [...byPlayer.entries()]
    .map(([id, v]) => ({
      label: playerLabel(playersById, id),
      tries: v.tries,
      conversions: v.conversions,
      pts: v.tries * 5 + v.conversions * 2,
    }))
    .filter((r) => r.tries > 0 || r.conversions > 0)
    .sort((a, b) => b.pts - a.pts || b.tries - a.tries);
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.tries}</td><td class="num">${r.conversions}</td><td class="num">${r.pts}</td></tr>`,
    )
    .join('');
  return `<h2>Scoring — by player</h2>
    <table class="stats-table stats-table--tight">
      <thead><tr><th>Player</th><th>Tries</th><th>Conv</th><th>Pts</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function scoringLogSection(
  events: MatchEventRecord[],
  playersById: Map<string, PlayerRecord>,
): string {
  const rows = sortMatchEventsByTime(events).filter(
    (e) => e.deletedAt == null && (e.kind === 'try' || e.kind === 'conversion'),
  );
  if (rows.length === 0) return '';
  const body = rows
    .map((e) => {
      const who = playerLabel(playersById, e.playerId);
      const kind =
        e.kind === 'try'
          ? 'Try'
          : e.conversionOutcome === 'missed'
            ? 'Conversion missed'
            : e.conversionOutcome === 'made'
              ? 'Conversion'
              : 'Conversion';
      return `<tr><td class="num">P${e.period} ${formatClock(e.matchTimeMs)}</td><td>${escapeHtml(kind)}</td><td>${escapeHtml(who)}</td></tr>`;
    })
    .join('');
  return `<h2>Scoring — log</h2>
    <table class="stats-table stats-table--tight">
      <thead><tr><th>Time</th><th></th><th>Player</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function topListSection(title: string, rows: { label: string; count: number }[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .slice(0, 6)
    .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.count}</td></tr>`)
    .join('');
  return `<h2>${escapeHtml(title)}</h2>
    <table class="stats-table stats-table--compact">
      <tbody>${body}</tbody>
    </table>`;
}

export type MatchStatsExportInput = {
  match: MatchRecord;
  events: MatchEventRecord[];
  substitutionCount: number;
  playersById: Map<string, PlayerRecord>;
  kickoffLabel?: string | null;
};

export function buildMatchOnePagerHtml(input: MatchStatsExportInput): string {
  const { match, events, substitutionCount, playersById, kickoffLabel } = input;
  const snapshot = computeMatchAnalyticsSnapshot(events, substitutionCount);
  const inferred = computeInferredMatchStats(events);
  const phase = phaseTimeSplit(events);
  const penTypes = penaltyCountByType(events);
  const negActions = negativeActionBreakdown(events);
  const ownKickPct = kickDecidedSuccessPct(snapshot.ownKick.made, snapshot.ownKick.missed);
  const oppKickPct = kickDecidedSuccessPct(snapshot.oppKick.made, snapshot.oppKick.missed);
  const tt = snapshot.tackles.made + snapshot.tackles.missed;
  const tacklePct = tt > 0 ? Math.round((snapshot.tackles.made / tt) * 1000) / 10 : null;

  const us = match.ourTeamName?.trim() || 'Us';
  const them = match.opponentName?.trim() || 'Opponent';
  const title = match.title?.trim() || `${us} vs ${them}`;
  const meta: string[] = [`${us} vs ${them}`];
  if (match.competition?.trim()) meta.push(match.competition.trim());
  if (kickoffLabel) meta.push(kickoffLabel);

  const inferredList = inferredBullets(inferred);
  const inferredBlock = inferredList
    ? `<h2>Highlights</h2><ul class="stats-bullets stats-bullets--compact">${inferredList}</ul>`
    : '';

  const penaltiesBlock = topListSection(
    'Top penalties',
    penTypes.map((r) => ({ label: r.label, count: r.count })),
  );
  const negativesBlock = topListSection(
    'Top negatives',
    negActions.map((r) => ({ label: r.label, count: r.count })),
  );
  const disciplineRow =
    penaltiesBlock || negativesBlock
      ? `<div class="stats-two-col">${penaltiesBlock}${negativesBlock}</div>`
      : '';

  const body = `
    <header class="stats-page-header stats-page-header--compact">
      <h1 class="stats-page-title">${escapeHtml(title)}</h1>
      <p class="stats-page-meta">${escapeHtml(meta.join(' · '))}</p>
    </header>
    <div class="stats-score-banner stats-score-banner--compact">
      <div class="stats-score-main">${snapshot.ownPoints} – ${snapshot.oppPoints}</div>
      <div class="stats-score-sub">Points · Tries ${snapshot.ownTries}–${snapshot.oppTries}</div>
    </div>
    <div class="stats-kpi-grid stats-kpi-grid--4">
      <div class="stats-kpi"><span class="stats-kpi-label">Tackle %</span><span class="stats-kpi-value">${fmtPct(tacklePct)}</span><span class="stats-kpi-sub">${snapshot.tackles.made}M · ${snapshot.tackles.missed}X</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Conv kick %</span><span class="stats-kpi-value">${fmtPct(ownKickPct)} / ${fmtPct(oppKickPct)}</span><span class="stats-kpi-sub">Us / Opp</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Subs</span><span class="stats-kpi-value">${snapshot.subsOurs} – ${snapshot.subsOpp}</span></div>
      ${phase ? `<div class="stats-kpi"><span class="stats-kpi-label">Off / Def</span><span class="stats-kpi-value">${phase.offensePct}% / ${phase.defensePct}%</span></div>` : ''}
    </div>
    ${scoringLogSection(events, playersById)}
    ${scorersTableSection(events, playersById)}
    <h2>Set pieces</h2>
    <table class="stats-table stats-table--tight">
      <thead><tr><th></th><th>W</th><th>L</th><th>Pen</th><th>FK</th><th>Won %</th></tr></thead>
      <tbody>
        ${setPieceTableRow('Scrums', snapshot.scrums)}
        ${setPieceTableRow('Lineouts', snapshot.lineouts)}
        ${setPieceTableRow('Rucks', snapshot.rucks)}
        ${setPieceTableRow('Restarts', snapshot.restarts)}
      </tbody>
    </table>
    ${inferredBlock}
    ${disciplineRow}
    <footer class="stats-page-footer">SevensManager · ${escapeHtml(new Date().toLocaleDateString())}</footer>
  `;

  return wrapExportPage(body, 'match');
}

export type PooledScorerRow = { label: string; tries: number; conversions: number; pts: number };

export function pooledScorersFromMatches(
  rows: { events: MatchEventRecord[]; players: Iterable<PlayerRecord> }[],
): PooledScorerRow[] {
  const totals = new Map<string, { label: string; tries: number; conversions: number }>();
  for (const row of rows) {
    const playersById = new Map([...row.players].map((p) => [p.id, p]));
    for (const [pid, v] of triesAndConversionsByPlayer(row.events)) {
      const p = playersById.get(pid);
      const key = p?.teamMemberId ?? (p?.number != null ? `jersey:${p.number}` : pid);
      const label = p ? formatPlayerLabel(p) : 'Player';
      const cur = totals.get(key) ?? { label, tries: 0, conversions: 0 };
      cur.tries += v.tries;
      cur.conversions += v.conversions;
      if (p) cur.label = formatPlayerLabel(p);
      totals.set(key, cur);
    }
  }
  return [...totals.values()]
    .map((r) => ({ ...r, pts: r.tries * 5 + r.conversions * 2 }))
    .filter((r) => r.tries > 0 || r.conversions > 0)
    .sort((a, b) => b.pts - a.pts || b.tries - a.tries);
}

function pooledScorersTableSection(rows: PooledScorerRow[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.tries}</td><td class="num">${r.conversions}</td><td class="num">${r.pts}</td></tr>`,
    )
    .join('');
  return `<h2>Scoring — by player (season)</h2>
    <table class="stats-table stats-table--tight">
      <thead><tr><th>Player</th><th>Tries</th><th>Conv</th><th>Pts</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

export type GlobalStatsExportInput = {
  team: TeamRecord;
  competitionLabel?: string | null;
  aggregate: TeamGlobalAggregate;
  tacklePct: number | null;
  inferred: InferredMatchStats;
  phase: ReturnType<typeof phaseTimeSplit>;
  matchCount: number;
  pooledScorers?: PooledScorerRow[];
};

export function buildGlobalOnePagerHtml(input: GlobalStatsExportInput): string {
  const { team, competitionLabel, aggregate, tacklePct, inferred, phase, matchCount, pooledScorers } = input;
  const meta: string[] = [team.name];
  if (competitionLabel) meta.push(competitionLabel);
  meta.push(`${matchCount} match${matchCount === 1 ? '' : 'es'}`);

  const phaseBlock = phase
    ? `<div class="stats-kpi-grid">
        <div class="stats-kpi"><span class="stats-kpi-label">Offense</span><span class="stats-kpi-value">${phase.offensePct}%</span><span class="stats-kpi-sub">${fmtDurationMs(phase.offenseMs)}</span></div>
        <div class="stats-kpi"><span class="stats-kpi-label">Defense</span><span class="stats-kpi-value">${phase.defensePct}%</span><span class="stats-kpi-sub">${fmtDurationMs(phase.defenseMs)}</span></div>
      </div>`
    : '';

  const inferredList = inferredBullets(inferred);
  const inferredBlock = inferredList
    ? `<h2>Inferred insights (pooled)</h2><ul class="stats-bullets">${inferredList}</ul>`
    : '';

  const body = `
    <header class="stats-page-header">
      <h1 class="stats-page-title">Global stats</h1>
      <p class="stats-page-meta">${escapeHtml(meta.join(' · '))}</p>
    </header>
    <div class="stats-kpi-grid">
      <div class="stats-kpi"><span class="stats-kpi-label">Matches</span><span class="stats-kpi-value">${aggregate.gameCount}</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Events logged</span><span class="stats-kpi-value">${aggregate.totalEvents}</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Points (Σ)</span><span class="stats-kpi-value">${aggregate.sumOwnPoints} – ${aggregate.sumOppPoints}</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Tries (Σ)</span><span class="stats-kpi-value">${aggregate.sumOwnTries} – ${aggregate.sumOppTries}</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Tackle %</span><span class="stats-kpi-value">${fmtPct(tacklePct)}</span><span class="stats-kpi-sub">${aggregate.tacklesMade}M · ${aggregate.tacklesMissed}X</span></div>
    </div>
    ${phaseBlock ? `<h2>Playing time (pooled)</h2>${phaseBlock}` : ''}
    ${pooledScorers ? pooledScorersTableSection(pooledScorers) : ''}
    ${inferredBlock}
    <footer class="stats-page-footer">SevensManager · ${escapeHtml(new Date().toLocaleDateString())}</footer>
  `;

  return wrapExportPage(body, 'global');
}

function wrapExportPage(bodyHtml: string, variant: 'match' | 'global'): string {
  return `<section class="stats-export-page stats-export-page--${variant}">${bodyHtml}</section>`;
}

const EXPORT_STYLES = `
  @page { size: letter portrait; margin: 0.35in; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 9pt;
    line-height: 1.3;
    color: #111;
    background: #fff;
  }
  .stats-export-page {
    max-width: 100%;
    margin: 0;
    padding: 0;
    page-break-after: always;
  }
  .stats-export-page--match {
    font-size: 8pt;
    line-height: 1.25;
  }
  .stats-export-page:last-child { page-break-after: auto; }
  .stats-page-header { margin-bottom: 0.5rem; border-bottom: 2px solid #1a3a2a; padding-bottom: 0.35rem; }
  .stats-page-header--compact { margin-bottom: 0.4rem; }
  .stats-page-title { margin: 0 0 0.15rem; font-size: 1.15rem; font-weight: 700; color: #1a3a2a; }
  .stats-page-meta { margin: 0; font-size: 0.78rem; color: #444; }
  .stats-score-banner { text-align: center; margin: 0.4rem 0 0.5rem; padding: 0.45rem; background: #f4f7f5; border-radius: 6px; }
  .stats-score-banner--compact { margin: 0.35rem 0 0.45rem; padding: 0.35rem; }
  .stats-score-main { font-size: 1.45rem; font-weight: 800; letter-spacing: 0.02em; }
  .stats-score-sub { font-size: 0.68rem; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
  .stats-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.35rem; margin-bottom: 0.45rem; }
  .stats-kpi-grid--4 { grid-template-columns: repeat(4, 1fr); }
  .stats-kpi { padding: 0.3rem 0.4rem; border: 1px solid #ddd; border-radius: 4px; }
  .stats-kpi-label { display: block; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
  .stats-kpi-value { display: block; font-size: 0.9rem; font-weight: 700; margin-top: 0.05rem; }
  .stats-kpi-sub { display: block; font-size: 0.65rem; color: #666; }
  h2 { margin: 0.45rem 0 0.2rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #1a3a2a; }
  .stats-table { width: 100%; border-collapse: collapse; margin-bottom: 0.35rem; font-size: 0.78rem; }
  .stats-table--tight th, .stats-table--tight td { padding: 0.15rem 0.3rem; }
  .stats-table th, .stats-table td { padding: 0.2rem 0.35rem; border-bottom: 1px solid #e5e5e5; text-align: left; }
  .stats-table th { font-size: 0.62rem; text-transform: uppercase; color: #666; }
  .stats-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .stats-table--compact td:last-child { text-align: right; font-weight: 600; }
  .stats-bullets { margin: 0 0 0.35rem; padding-left: 1rem; }
  .stats-bullets--compact { columns: 2; column-gap: 0.75rem; }
  .stats-bullets--compact li { margin-bottom: 0.08rem; break-inside: avoid; }
  .stats-bullets li { margin-bottom: 0.15rem; }
  .stats-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .stats-page-footer { margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid #ddd; font-size: 0.62rem; color: #888; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stats-export-page--match .stats-page-title { font-size: 1rem; }
    .stats-export-page--match h2 { margin-top: 0.35rem; }
    .stats-export-page--match .stats-table { margin-bottom: 0.25rem; }
  }
`;

export function buildStatsExportDocument(pages: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SevensManager stats export</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

export function openStatsExport(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Could not open export window — allow pop-ups for this site.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    win.print();
  }, 350);
}
