import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { ON_FIELD_MAX, SQUAD_MAX, statusSortKey } from '@/domain/player';

/** Primary label: #n plus optional name (RefLog-style). */
export function formatPlayerLabel(p: PlayerRecord): string {
  const num = p.number != null ? `#${p.number}` : '?';
  const n = p.name.trim();
  return n ? `${num} ${n}` : num;
}

/** Name only — use when jersey/number is shown in a separate column. */
export function formatPlayerNameOnly(p: PlayerRecord): string {
  const n = p.name.trim();
  return n || '—';
}

/**
 * Full squad: at most one player row per jersey number (1–{SQUAD_MAX}). Duplicate ids or duplicate
 * numbers resolve to the newest `createdAt`. Rows outside 1–{SQUAD_MAX} are kept by unique id.
 */
export function dedupeSquadPlayers(players: PlayerRecord[]): PlayerRecord[] {
  const byId = new Map<string, PlayerRecord>();
  for (const p of players) {
    byId.set(p.id, p);
  }
  const uniqById = [...byId.values()];
  const byJersey = new Map<number, PlayerRecord>();
  const noJersey: PlayerRecord[] = [];
  for (const p of uniqById.sort((a, b) => b.createdAt - a.createdAt)) {
    const n = p.number;
    if (n == null || n < 1 || n > SQUAD_MAX) {
      noJersey.push(p);
      continue;
    }
    if (!byJersey.has(n)) {
      byJersey.set(n, p);
    }
  }
  return [...byJersey.values(), ...noJersey];
}

const byJerseyNumber = (a: PlayerRecord, b: PlayerRecord) =>
  (a.number ?? 999) - (b.number ?? 999);

/** On-field list for Live: deduped squad, `on` only, sorted by number. */
export function dedupeOnFieldPlayers(players: PlayerRecord[]): PlayerRecord[] {
  return orderOnFieldPlayers(players, null);
}

/**
 * On-field players in display order. When `orderIds` is null/empty, order matches jersey number
 * (same as legacy `dedupeOnFieldPlayers`). When `orderIds` is set, walk that list and keep players
 * still on field; append any new on-field players by jersey (e.g. roster edits).
 */
export function orderOnFieldPlayers(players: PlayerRecord[], orderIds: string[] | null): PlayerRecord[] {
  const onField = dedupeSquadPlayers(players).filter((p) => p.status === 'on');
  if (!orderIds?.length) {
    return [...onField].sort(byJerseyNumber).slice(0, ON_FIELD_MAX);
  }
  const byId = new Map(onField.map((p) => [p.id, p] as const));
  const out: PlayerRecord[] = [];
  const used = new Set<string>();
  for (const id of orderIds) {
    const p = byId.get(id);
    if (p) {
      out.push(p);
      used.add(id);
    }
  }
  const rest = onField.filter((p) => !used.has(p.id)).sort(byJerseyNumber);
  out.push(...rest);
  return out.slice(0, ON_FIELD_MAX);
}

/**
 * Merge a preferred id order with who is actually on field: keep sequence for ids still on,
 * append any new on-field ids (sorted by jersey). If `prev` is null, start from jersey order.
 */
export function reconcileOnFieldOrder(prev: string[] | null, allPlayers: PlayerRecord[]): string[] {
  const onField = dedupeSquadPlayers(allPlayers).filter((p) => p.status === 'on');
  if (!prev?.length) {
    return [...onField].sort(byJerseyNumber).map((p) => p.id).slice(0, ON_FIELD_MAX);
  }
  const onIds = new Set(onField.map((p) => p.id));
  const used = new Set<string>();
  const out: string[] = [];
  for (const id of prev) {
    if (onIds.has(id)) {
      out.push(id);
      used.add(id);
    }
  }
  const extra = onField.filter((p) => !used.has(p.id)).sort(byJerseyNumber);
  out.push(...extra.map((p) => p.id));
  return out.slice(0, ON_FIELD_MAX);
}

export function sortPlayersRefLogStyle(
  players: PlayerRecord[],
  sortByStatus: boolean,
): PlayerRecord[] {
  const byNum = (a: PlayerRecord, b: PlayerRecord) => {
    const na = a.number ?? 999;
    const nb = b.number ?? 999;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  };
  const copy = [...players];
  if (!sortByStatus) {
    return copy.sort(byNum);
  }
  return copy.sort((a, b) => {
    const d = statusSortKey(a.status) - statusSortKey(b.status);
    if (d !== 0) return d;
    return byNum(a, b);
  });
}

export function countByStatus(players: PlayerRecord[], s: PlayerStatus): number {
  return players.filter((p) => p.status === s).length;
}
