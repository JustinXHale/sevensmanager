/**
 * Dev-only utility: populate a match with realistic rugby sevens event data.
 * Call via the "Seed data" button in the admin panel (dev builds only).
 */
import type {
  ConversionOutcome,
  FieldLengthBandId,
  NegativeActionId,
  PenaltyCard,
  PenaltyTypeId,
  PassVariant,
  PlayPhaseContext,
  SetPieceOutcome,
  TackleOutcome,
  TackleQuality,
  OffloadTone,
} from '@/domain/matchEvent';
import type { ZoneId } from '@/domain/zone';
import { ZONE_IDS } from '@/domain/zone';
import { ON_FIELD_MAX } from '@/domain/player';
import { addMatchEvent } from '@/repos/matchEventsRepo';
import { getSession, saveSession } from '@/repos/matchesRepo';
import { listPlayers } from '@/repos/rosterRepo';

const ZONES: ZoneId[] = [...ZONE_IDS];
const BANDS: FieldLengthBandId[] = ['own_22', 'own_half', 'opp_half', 'opp_22'];
const PENALTY_TYPES: PenaltyTypeId[] = [
  'offside', 'hands_in_ruck', 'high_tackle', 'neck_roll', 'side_entry',
  'collapsing', 'not_releasing', 'not_rolling_away', 'sealing_off', 'other',
];
const NEG_ACTIONS: NegativeActionId[] = ['bad_pass', 'knock_on', 'forward_pass'];
const TQ: TackleQuality[] = ['dominant', 'neutral', 'passive'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function maybe<T>(chance: number, val: T): T | undefined {
  return Math.random() < chance ? val : undefined;
}

type EventSeed = Parameters<typeof addMatchEvent>[0];

function generateEventsForMatch(
  matchId: string,
  playerIds: string[],
  profile: 'tight' | 'open' | 'blowout',
): EventSeed[] {
  const events: EventSeed[] = [];
  const halves = 2;
  const halfLengthMs = 7 * 60 * 1000;

  let clockMs = 0;

  for (let period = 1; period <= halves; period++) {
    clockMs = 0;
    const periodEvents = profile === 'tight' ? 60 : profile === 'open' ? 80 : 100;

    for (let i = 0; i < periodEvents; i++) {
      clockMs += Math.floor(Math.random() * (halfLengthMs / periodEvents) * 1.6) + 500;
      if (clockMs > halfLengthMs) clockMs = halfLengthMs - Math.floor(Math.random() * 5000);

      const roll = Math.random();
      const pid = pick(playerIds);
      const zone = pick(ZONES);
      const band = pick(BANDS);
      const phase: PlayPhaseContext = Math.random() < 0.6 ? 'attack' : 'defense';

      if (roll < 0.28) {
        const pv: PassVariant = Math.random() < 0.2 ? 'offload' : 'standard';
        const ot: OffloadTone | undefined = pv === 'offload' ? pick(['negative', 'neutral', 'positive'] as const) : undefined;
        events.push({ matchId, kind: 'pass', matchTimeMs: clockMs, period, playerId: pid, zoneId: zone, fieldLengthBand: band, passVariant: pv, offloadTone: ot });
      } else if (roll < 0.48) {
        const outcome: TackleOutcome = Math.random() < 0.82 ? 'made' : 'missed';
        const quality = outcome === 'made' ? pick(TQ) : undefined;
        events.push({ matchId, kind: 'tackle', matchTimeMs: clockMs, period, playerId: pid, zoneId: zone, fieldLengthBand: band, tackleOutcome: outcome, tackleQuality: quality });
      } else if (roll < 0.56) {
        const spOutcome: SetPieceOutcome = Math.random() < 0.7 ? 'won' : Math.random() < 0.5 ? 'lost' : 'penalized';
        events.push({ matchId, kind: 'ruck', matchTimeMs: clockMs, period, zoneId: zone, setPieceOutcome: spOutcome, playPhaseContext: phase });
      } else if (roll < 0.62) {
        const spOutcome: SetPieceOutcome = Math.random() < 0.65 ? 'won' : Math.random() < 0.5 ? 'lost' : 'penalized';
        events.push({ matchId, kind: 'scrum', matchTimeMs: clockMs, period, zoneId: zone, setPieceOutcome: spOutcome, playPhaseContext: phase });
      } else if (roll < 0.68) {
        const spOutcome: SetPieceOutcome = Math.random() < 0.6 ? 'won' : Math.random() < 0.5 ? 'lost' : 'penalized';
        events.push({ matchId, kind: 'lineout', matchTimeMs: clockMs, period, zoneId: zone, setPieceOutcome: spOutcome, playPhaseContext: phase });
      } else if (roll < 0.73) {
        events.push({ matchId, kind: 'line_break', matchTimeMs: clockMs, period, playerId: pid, zoneId: zone, fieldLengthBand: band, passVariant: Math.random() < 0.15 ? 'offload' : 'standard' });
      } else if (roll < 0.80) {
        const penType = pick(PENALTY_TYPES);
        const card: PenaltyCard | undefined = maybe(0.12, Math.random() < 0.8 ? 'yellow' : 'red');
        events.push({ matchId, kind: 'team_penalty', matchTimeMs: clockMs, period, playerId: pid, zoneId: zone, penaltyType: penType, penaltyCard: card });
      } else if (roll < 0.86) {
        const negId = pick(NEG_ACTIONS);
        events.push({ matchId, kind: 'negative_action', matchTimeMs: clockMs, period, playerId: pid, zoneId: zone, negativeActionId: negId });
      } else if (roll < 0.91) {
        const tryZone = pick(['Z4', 'Z5', 'Z6'] as const) as ZoneId;
        events.push({ matchId, kind: 'try', matchTimeMs: clockMs, period, playerId: pid, zoneId: tryZone });
        clockMs += 2000;
        const convOutcome: ConversionOutcome = Math.random() < 0.65 ? 'made' : 'missed';
        events.push({ matchId, kind: 'conversion', matchTimeMs: clockMs, period, playerId: pid, zoneId: tryZone, conversionOutcome: convOutcome });
      } else if (roll < 0.96) {
        const tryZone = pick(ZONES);
        events.push({ matchId, kind: 'opponent_try', matchTimeMs: clockMs, period, zoneId: tryZone });
        clockMs += 2000;
        const convOutcome: ConversionOutcome = Math.random() < 0.55 ? 'made' : 'missed';
        events.push({ matchId, kind: 'opponent_conversion', matchTimeMs: clockMs, period, zoneId: tryZone, conversionOutcome: convOutcome });
      } else if (roll < 0.98) {
        events.push({ matchId, kind: 'opponent_substitution', matchTimeMs: clockMs, period });
      } else {
        const card: PenaltyCard = Math.random() < 0.75 ? 'yellow' : 'red';
        events.push({ matchId, kind: 'opponent_card', matchTimeMs: clockMs, period, penaltyCard: card });
      }
    }
  }
  return events;
}

export async function seedMatchWithData(
  matchId: string,
  profile: 'tight' | 'open' | 'blowout' = 'open',
): Promise<number> {
  const players = await listPlayers(matchId);
  const playerIds = players.filter((p) => p.status === 'on' || p.status === 'bench').map((p) => p.id);
  if (playerIds.length === 0) throw new Error('No players on match roster');

  const seeds = generateEventsForMatch(matchId, playerIds, profile);
  for (const seed of seeds) {
    await addMatchEvent(seed);
  }

  await seedSyntheticMinutes(matchId, players);
  return seeds.length;
}

/**
 * Write synthetic playerMinutesMs into the session based on roster status.
 * On-field starters get ~full match (14 min), bench players get partial time
 * (simulating subs coming on midway through).
 */
export async function seedSyntheticMinutes(
  matchId: string,
  players: { id: string; status: string; number: number | null }[],
): Promise<void> {
  const session = await getSession(matchId);
  if (!session) return;

  const fullMatchMs = 14 * 60 * 1000;
  const mins: Record<string, number> = {};

  for (const p of players) {
    if (p.status === 'on') {
      mins[p.id] = fullMatchMs + Math.floor(Math.random() * 30_000);
    } else if (p.status === 'bench') {
      const played = (p.number ?? 8) <= ON_FIELD_MAX + 3;
      if (played) {
        mins[p.id] = Math.floor(fullMatchMs * (0.25 + Math.random() * 0.35));
      }
    }
  }

  await saveSession({
    ...session,
    playerMinutesMs: mins,
    minutesLedgerMatchMs: fullMatchMs,
  });
}
