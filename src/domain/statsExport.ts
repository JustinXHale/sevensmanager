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
import type { MatchRecord } from '@/domain/match';
import type { MatchEventRecord } from '@/domain/matchEvent';
import type { PlayerRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import { triesAndConversionsByPlayer } from '@/domain/matchStats';
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

function scorersSection(
  events: MatchEventRecord[],
  playersById: Map<string, PlayerRecord>,
): string {
  const byPlayer = triesAndConversionsByPlayer(events);
  const rows = [...byPlayer.entries()]
    .map(([id, v]) => ({
      label: playersById.get(id) ? formatPlayerLabel(playersById.get(id)!) : 'Player',
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
  return `<h2>Scorers</h2>
    <table class="stats-table">
      <thead><tr><th>Player</th><th>Tries</th><th>Conv</th><th>Pts</th></tr></thead>
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

  const phaseBlock = phase
    ? `<div class="stats-kpi-grid">
        <div class="stats-kpi"><span class="stats-kpi-label">Offense</span><span class="stats-kpi-value">${phase.offensePct}%</span><span class="stats-kpi-sub">${fmtDurationMs(phase.offenseMs)}</span></div>
        <div class="stats-kpi"><span class="stats-kpi-label">Defense</span><span class="stats-kpi-value">${phase.defensePct}%</span><span class="stats-kpi-sub">${fmtDurationMs(phase.defenseMs)}</span></div>
      </div>`
    : '';

  const inferredList = inferredBullets(inferred);
  const inferredBlock = inferredList
    ? `<h2>Inferred insights</h2><ul class="stats-bullets">${inferredList}</ul>`
    : '';

  const body = `
    <header class="stats-page-header">
      <h1 class="stats-page-title">${escapeHtml(title)}</h1>
      <p class="stats-page-meta">${escapeHtml(meta.join(' · '))}</p>
    </header>
    <div class="stats-score-banner">
      <div class="stats-score-main">${snapshot.ownPoints} – ${snapshot.oppPoints}</div>
      <div class="stats-score-sub">Points</div>
    </div>
    <div class="stats-kpi-grid">
      <div class="stats-kpi"><span class="stats-kpi-label">Tries</span><span class="stats-kpi-value">${snapshot.ownTries} – ${snapshot.oppTries}</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Tackle %</span><span class="stats-kpi-value">${fmtPct(tacklePct)}</span><span class="stats-kpi-sub">${snapshot.tackles.made}M · ${snapshot.tackles.missed}X</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Conv kick %</span><span class="stats-kpi-value">${fmtPct(ownKickPct)} / ${fmtPct(oppKickPct)}</span><span class="stats-kpi-sub">Us / Opp</span></div>
      <div class="stats-kpi"><span class="stats-kpi-label">Subs</span><span class="stats-kpi-value">${snapshot.subsOurs} – ${snapshot.subsOpp}</span></div>
    </div>
    ${phaseBlock ? `<h2>Playing time</h2>${phaseBlock}` : ''}
    <h2>Set pieces</h2>
    <table class="stats-table">
      <thead><tr><th></th><th>W</th><th>L</th><th>Pen</th><th>FK</th><th>Won %</th></tr></thead>
      <tbody>
        ${setPieceTableRow('Scrums', snapshot.scrums)}
        ${setPieceTableRow('Lineouts', snapshot.lineouts)}
        ${setPieceTableRow('Rucks', snapshot.rucks)}
        ${setPieceTableRow('Restarts', snapshot.restarts)}
      </tbody>
    </table>
    ${inferredBlock}
    ${scorersSection(events, playersById)}
    ${topListSection('Top penalties', penTypes.map((r) => ({ label: r.label, count: r.count })))}
    ${topListSection('Top negatives', negActions.map((r) => ({ label: r.label, count: r.count })))}
    <footer class="stats-page-footer">SevensManager · ${escapeHtml(new Date().toLocaleDateString())}</footer>
  `;

  return wrapExportPage(body);
}

export type GlobalStatsExportInput = {
  team: TeamRecord;
  competitionLabel?: string | null;
  aggregate: TeamGlobalAggregate;
  tacklePct: number | null;
  inferred: InferredMatchStats;
  phase: ReturnType<typeof phaseTimeSplit>;
  matchCount: number;
};

export function buildGlobalOnePagerHtml(input: GlobalStatsExportInput): string {
  const { team, competitionLabel, aggregate, tacklePct, inferred, phase, matchCount } = input;
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
    ${inferredBlock}
    <footer class="stats-page-footer">SevensManager · ${escapeHtml(new Date().toLocaleDateString())}</footer>
  `;

  return wrapExportPage(body);
}

function wrapExportPage(bodyHtml: string): string {
  return `<section class="stats-export-page">${bodyHtml}</section>`;
}

const EXPORT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #111;
    background: #fff;
  }
  .stats-export-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.25in 0.85in;
    page-break-after: always;
  }
  .stats-export-page:last-child { page-break-after: auto; }
  .stats-page-header { margin-bottom: 1.25rem; border-bottom: 2px solid #1a3a2a; padding-bottom: 0.75rem; }
  .stats-page-title { margin: 0 0 0.35rem; font-size: 1.5rem; font-weight: 700; color: #1a3a2a; }
  .stats-page-meta { margin: 0; font-size: 0.9rem; color: #444; }
  .stats-score-banner { text-align: center; margin: 1rem 0 1.25rem; padding: 0.85rem; background: #f4f7f5; border-radius: 8px; }
  .stats-score-main { font-size: 2rem; font-weight: 800; letter-spacing: 0.02em; }
  .stats-score-sub { font-size: 0.8rem; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
  .stats-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem; margin-bottom: 1rem; }
  .stats-kpi { padding: 0.55rem 0.65rem; border: 1px solid #ddd; border-radius: 6px; }
  .stats-kpi-label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  .stats-kpi-value { display: block; font-size: 1.15rem; font-weight: 700; margin-top: 0.15rem; }
  .stats-kpi-sub { display: block; font-size: 0.78rem; color: #666; }
  h2 { margin: 1.1rem 0 0.5rem; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; color: #1a3a2a; }
  .stats-table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; font-size: 0.9rem; }
  .stats-table th, .stats-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #e5e5e5; text-align: left; }
  .stats-table th { font-size: 0.75rem; text-transform: uppercase; color: #666; }
  .stats-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .stats-table--compact td:last-child { text-align: right; font-weight: 600; }
  .stats-bullets { margin: 0 0 0.75rem; padding-left: 1.2rem; }
  .stats-bullets li { margin-bottom: 0.25rem; }
  .stats-page-footer { margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #ddd; font-size: 0.75rem; color: #888; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stats-export-page { padding: 0.5in 0.6in; }
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
