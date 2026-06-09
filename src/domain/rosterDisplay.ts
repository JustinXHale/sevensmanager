import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { SQUAD_MAX, statusSortKey } from '@/domain/player';

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

export type RosterDisplayOrders = {
  on: string[];
  bench: string[];
  off: string[];
};

/** On-field list for Live: deduped squad, `on` only, sorted by number. */
export function dedupeOnFieldPlayers(players: PlayerRecord[]): PlayerRecord[] {
  return orderOnFieldPlayers(players, null);
}

/**
 * Players in a status group in display order. When `orderIds` is null/empty, order matches jersey
 * number. When `orderIds` is set, walk that list and keep players still in the group; append any
 * new ids by jersey (e.g. roster edits).
 */
export function orderPlayersInStatus(
  players: PlayerRecord[],
  status: PlayerStatus,
  orderIds: string[] | null,
  max?: number,
): PlayerRecord[] {
  const inStatus = dedupeSquadPlayers(players).filter((p) => p.status === status);
  if (!orderIds?.length) {
    const sorted = [...inStatus].sort(byJerseyNumber);
    return max != null ? sorted.slice(0, max) : sorted;
  }
  const byId = new Map(inStatus.map((p) => [p.id, p] as const));
  const out: PlayerRecord[] = [];
  const used = new Set<string>();
  for (const id of orderIds) {
    const p = byId.get(id);
    if (p) {
      out.push(p);
      used.add(id);
    }
  }
  const rest = inStatus.filter((p) => !used.has(p.id)).sort(byJerseyNumber);
  out.push(...rest);
  return max != null ? out.slice(0, max) : out;
}

/**
 * On-field players in display order. When `orderIds` is null/empty, order matches jersey number
 * (same as legacy `dedupeOnFieldPlayers`). When `orderIds` is set, walk that list and keep players
 * still on field; append any new on-field players by jersey (e.g. roster edits).
 */
export function orderOnFieldPlayers(players: PlayerRecord[], orderIds: string[] | null): PlayerRecord[] {
  return orderPlayersInStatus(players, 'on', orderIds);
}

/**
 * Merge a preferred id order with who is actually in a status group: keep sequence for ids still
 * present; append any new ids (sorted by jersey). If `prev` is null, start from jersey order.
 */
export function reconcileStatusOrder(
  prev: string[] | null,
  allPlayers: PlayerRecord[],
  status: PlayerStatus,
  max?: number,
): string[] {
  const inStatus = dedupeSquadPlayers(allPlayers).filter((p) => p.status === status);
  if (!prev?.length) {
    const ids = [...inStatus].sort(byJerseyNumber).map((p) => p.id);
    return max != null ? ids.slice(0, max) : ids;
  }
  const ids = new Set(inStatus.map((p) => p.id));
  const used = new Set<string>();
  const out: string[] = [];
  for (const id of prev) {
    if (ids.has(id)) {
      out.push(id);
      used.add(id);
    }
  }
  const extra = inStatus.filter((p) => !used.has(p.id)).sort(byJerseyNumber);
  out.push(...extra.map((p) => p.id));
  return max != null ? out.slice(0, max) : out;
}

/**
 * Merge a preferred id order with who is actually on field: keep sequence for ids still on,
 * append any new on-field ids (sorted by jersey). If `prev` is null, start from jersey order.
 */
export function reconcileOnFieldOrder(prev: string[] | null, allPlayers: PlayerRecord[]): string[] {
  return reconcileStatusOrder(prev, allPlayers, 'on');
}

export function reconcileAllRosterOrders(
  players: PlayerRecord[],
  stored: Partial<RosterDisplayOrders> | null | undefined,
): RosterDisplayOrders {
  return {
    on: reconcileStatusOrder(stored?.on ?? null, players, 'on'),
    bench: reconcileStatusOrder(stored?.bench ?? null, players, 'bench'),
    off: reconcileStatusOrder(stored?.off ?? null, players, 'off'),
  };
}

/** Swap a player id one step up or down within an order list; returns null if no move. */
export function moveIdInOrder(
  order: string[],
  id: string,
  direction: 'up' | 'down',
): string[] | null {
  const idx = order.indexOf(id);
  if (idx === -1) return null;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= order.length) return null;
  const next = [...order];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  return next;
}

/** Insert `id` before `beforeId` (or append when `beforeId` is null). Removes duplicate `id` first. */
export function insertIdInOrder(order: string[], id: string, beforeId: string | null): string[] {
  const without = order.filter((x) => x !== id);
  if (beforeId === null) return [...without, id];
  const idx = without.indexOf(beforeId);
  if (idx === -1) return [...without, id];
  return [...without.slice(0, idx), id, ...without.slice(idx)];
}

export function ordersEqual(a: string[], b: string[] | undefined): boolean {
  const bb = b ?? [];
  if (a.length !== bb.length) return false;
  return a.every((id, i) => id === bb[i]);
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
