import type { MatchSessionRecord } from '@/domain/match';
import type { PlayerRecord, PlayerStatus } from '@/domain/player';
import { cumulativeMatchTimeMs } from '@/domain/matchClock';

/**
 * Fold elapsed match time since `minutesLedgerMatchMs` into `playerMinutesMs` for everyone
 * currently on field. Call before pausing, adjusting clock, subs, or persisting.
 */
export function flushPlayerMinutes(
  session: MatchSessionRecord,
  players: PlayerRecord[],
  nowMs: number,
): MatchSessionRecord {
  const nowMatch = cumulativeMatchTimeMs(session, nowMs);
  const ledger = session.minutesLedgerMatchMs ?? nowMatch;
  const pending = Math.max(0, nowMatch - ledger);
  if (pending === 0) {
    return {
      ...session,
      minutesLedgerMatchMs: ledger,
      playerMinutesMs: { ...(session.playerMinutesMs ?? {}) },
    };
  }
  const mins = { ...(session.playerMinutesMs ?? {}) };
  for (const p of players) {
    if (p.status === 'on') {
      mins[p.id] = (mins[p.id] ?? 0) + pending;
    }
  }
  return {
    ...session,
    playerMinutesMs: mins,
    minutesLedgerMatchMs: nowMatch,
  };
}

/** Match minutes on the field for this player (includes in-progress segment while clock is running). */
export function derivedPlayerMinutesMs(
  session: MatchSessionRecord,
  playerId: string,
  status: PlayerStatus,
  nowMs: number,
): number {
  const base = session.playerMinutesMs?.[playerId] ?? 0;
  const ledger = session.minutesLedgerMatchMs;
  if (ledger === undefined || status !== 'on' || !session.clockRunning) {
    return base;
  }
  const nowMatch = cumulativeMatchTimeMs(session, nowMs);
  const pending = Math.max(0, nowMatch - ledger);
  return base + pending;
}

/** Display as m:ss (match clock style). */
export function formatPlayerMinutesLabel(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
