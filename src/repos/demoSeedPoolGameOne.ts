import type {
  ConversionOutcome,
  FieldLengthBandId,
  MatchEventKind,
  NegativeActionId,
  OffloadTone,
  PassVariant,
  PenaltyCard,
  PenaltyTypeId,
  PlayPhaseContext,
  SetPieceOutcome,
  TackleOutcome,
  TackleQuality,
} from '@/domain/matchEvent';
import type { PlayerRecord } from '@/domain/player';
import type { ZoneId } from '@/domain/zone';
import { addMatchEvent } from './matchEventsRepo';

const HALF_MS = 7 * 60 * 1000;
const FULL_REG_MS = 14 * 60 * 1000;

function periodForMatchMs(ms: number): number {
  if (ms >= FULL_REG_MS) return 3;
  if (ms >= HALF_MS) return 2;
  return 1;
}

export type SeedRow = {
  ms: number;
  kind: MatchEventKind;
  jersey?: number;
  zoneId?: ZoneId;
  fieldLengthBand?: FieldLengthBandId;
  tackleOutcome?: TackleOutcome;
  tackleQuality?: TackleQuality;
  passVariant?: PassVariant;
  offloadTone?: OffloadTone;
  penaltyType?: PenaltyTypeId;
  penaltyCard?: PenaltyCard;
  setPieceOutcome?: SetPieceOutcome;
  playPhaseContext?: PlayPhaseContext;
  negativeActionId?: NegativeActionId;
  conversionOutcome?: ConversionOutcome;
  linkPrevPass?: boolean;
};

const PASS_ZONES: ZoneId[] = [
  'Z3', 'Z4', 'Z5', 'Z6', 'Z5', 'Z4', 'Z3', 'Z4', 'Z5', 'Z6', 'Z5', 'Z4', 'Z3', 'Z2', 'Z3', 'Z4', 'Z5', 'Z5', 'Z6', 'Z6',
  'Z5', 'Z4', 'Z3', 'Z4', 'Z5', 'Z6', 'Z5', 'Z4', 'Z3', 'Z3', 'Z4', 'Z5', 'Z6', 'Z5', 'Z4', 'Z3', 'Z4', 'Z5', 'Z5',
  'Z4', 'Z3', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z5', 'Z4', 'Z3', 'Z4', 'Z5', 'Z6', 'Z5', 'Z4', 'Z3', 'Z4', 'Z5', 'Z6',
];

const DEF_ZONES: ZoneId[] = ['Z1', 'Z2', 'Z3', 'Z2', 'Z3', 'Z1', 'Z2', 'Z3', 'Z2', 'Z3', 'Z4', 'Z3', 'Z2', 'Z1', 'Z2', 'Z3'];

const PENALTY_ROTATION: { type: PenaltyTypeId; card?: PenaltyCard }[] = [
  { type: 'offside' },
  { type: 'hands_in_ruck' },
  { type: 'side_entry' },
  { type: 'not_releasing' },
  { type: 'collapsing' },
  { type: 'not_rolling_away' },
  { type: 'sealing_off' },
  { type: 'scrummage' },
  { type: 'lineout_offence' },
  { type: 'deliberate_knock_on' },
  { type: 'neck_roll' },
  { type: 'high_tackle', card: 'yellow' },
  { type: 'dangerous_play' },
  { type: 'offside' },
  { type: 'hands_in_ruck' },
  { type: 'high_tackle', card: 'yellow' },
  { type: 'side_entry' },
  { type: 'not_releasing' },
  { type: 'collapsing' },
];

const BAND_FOR_ZONE: Record<ZoneId, FieldLengthBandId> = {
  Z1: 'own_22',
  Z2: 'own_half',
  Z3: 'own_half',
  Z4: 'opp_half',
  Z5: 'opp_half',
  Z6: 'opp_22',
};

const TQ_CYCLE: TackleQuality[] = ['dominant', 'neutral', 'neutral', 'passive', 'neutral', 'dominant', 'neutral', 'neutral', 'neutral', 'passive'];

/**
 * Dense "full game" log covering all event kinds and analytics-relevant fields.
 * P1 + P2 + short P3 (extra time).
 */
export function buildPoolGameOneSeedRows(): SeedRow[] {
  const rows: SeedRow[] = [];
  let t = 0;
  let penaltyIdx = 0;
  let tqIdx = 0;
  let passIdx = 0;

  const push = (r: SeedRow) => { rows.push(r); };

  const passRow = (ms: number, jersey: number, zone: ZoneId): SeedRow => {
    passIdx++;
    const isOffload = passIdx % 7 === 0;
    return {
      ms,
      kind: 'pass',
      jersey,
      zoneId: zone,
      fieldLengthBand: BAND_FOR_ZONE[zone],
      passVariant: isOffload ? 'offload' : 'standard',
      offloadTone: isOffload ? (['negative', 'neutral', 'positive'] as const)[passIdx % 3] : undefined,
    };
  };

  const tackleRow = (ms: number, jersey: number, outcome: TackleOutcome, zone: ZoneId): SeedRow => {
    const quality: TackleQuality | undefined = outcome === 'made' ? TQ_CYCLE[tqIdx++ % TQ_CYCLE.length] : undefined;
    return {
      ms,
      kind: 'tackle',
      jersey,
      tackleOutcome: outcome,
      tackleQuality: quality,
      zoneId: zone,
      fieldLengthBand: BAND_FOR_ZONE[zone],
    };
  };

  // ---- P1: opening set pieces ----
  push({ ms: t, kind: 'scrum', zoneId: 'Z4', setPieceOutcome: 'won', playPhaseContext: 'attack' });
  t += 9_000;
  push({ ms: t, kind: 'lineout', zoneId: 'Z3', setPieceOutcome: 'won', playPhaseContext: 'attack' });
  t += 7_000;

  // P1 — possession chain (many passes with bands + some offloads)
  for (let i = 0; i < 30; i++) {
    push(passRow(t, (i % 13) + 1, PASS_ZONES[i % PASS_ZONES.length]!));
    t += 1_800 + (i % 9) * 220;
  }

  // Line break
  push({ ms: t, kind: 'line_break', jersey: 5, zoneId: 'Z5', fieldLengthBand: 'opp_half', passVariant: 'standard' });
  t += 3_000;

  // More passes
  for (let i = 30; i < 48; i++) {
    push(passRow(t, (i % 13) + 1, PASS_ZONES[i % PASS_ZONES.length]!));
    t += 1_800 + (i % 9) * 220;
  }

  // Ruck → pass pairs
  push({ ms: t, kind: 'ruck', zoneId: 'Z5', setPieceOutcome: 'won', playPhaseContext: 'attack', linkPrevPass: true });
  t += 4_000;
  push(passRow(t, 5, 'Z4'));
  t += 2_800;
  push(passRow(t, 9, 'Z5'));
  t += 3_200;

  // Negative action: knock-on
  push({ ms: t, kind: 'negative_action', jersey: 9, zoneId: 'Z5', negativeActionId: 'knock_on' });
  t += 5_000;

  // Opponent scrum from the knock-on, they score
  push({ ms: t, kind: 'opponent_try', zoneId: 'Z2' });
  t += 20_000;
  push({ ms: t, kind: 'opponent_conversion', zoneId: 'Z2', conversionOutcome: 'made' });
  t += 15_000;

  // Defensive tackles phase
  for (let i = 0; i < 22; i++) {
    push(tackleRow(
      t,
      [5, 6, 7, 1, 2, 3, 4, 11, 12, 13, 5, 6, 7, 1, 2, 3][i % 16]!,
      i % 5 === 0 || i % 8 === 0 ? 'missed' : 'made',
      DEF_ZONES[i % DEF_ZONES.length]!,
    ));
    t += 3_200 + (i % 6) * 450;
  }

  // Penalties phase (variety of types)
  for (let i = 0; i < 10; i++) {
    const spec = PENALTY_ROTATION[penaltyIdx % PENALTY_ROTATION.length]!;
    penaltyIdx++;
    push({
      ms: t,
      kind: 'team_penalty',
      jersey: (i % 7) + 1,
      zoneId: ['Z2', 'Z3', 'Z4', 'Z3', 'Z2', 'Z3', 'Z4', 'Z3', 'Z2', 'Z3'][i] as ZoneId,
      penaltyType: spec.type,
      penaltyCard: spec.card,
    });
    t += 8_000 + (i % 4) * 1_800;
  }

  // More passes
  for (let i = 0; i < 20; i++) {
    push(passRow(t, ((i + 4) % 13) + 1, PASS_ZONES[(i + 11) % PASS_ZONES.length]!));
    t += 2_000 + (i % 7) * 280;
  }

  // Negative: bad pass
  push({ ms: t, kind: 'negative_action', jersey: 3, zoneId: 'Z4', negativeActionId: 'bad_pass' });
  t += 4_000;

  // Set pieces with outcomes
  push({ ms: t, kind: 'scrum', zoneId: 'Z4', setPieceOutcome: 'won', playPhaseContext: 'defense' });
  t += 5_500;
  push({ ms: t, kind: 'lineout', zoneId: 'Z5', setPieceOutcome: 'lost', playPhaseContext: 'attack' });
  t += 4_500;

  // Ruck → pass pairs (6 pairs)
  for (let i = 0; i < 6; i++) {
    const zone = (['Z4', 'Z5', 'Z5', 'Z4', 'Z5', 'Z4'] as ZoneId[])[i]!;
    push(passRow(t, (i % 13) + 1, PASS_ZONES[(i + 3) % PASS_ZONES.length]!));
    t += 2_400;
    push({ ms: t, kind: 'ruck', zoneId: zone, setPieceOutcome: 'won', playPhaseContext: 'attack', linkPrevPass: true });
    t += 3_800;
  }

  // Line break → Try
  push({ ms: t, kind: 'line_break', jersey: 8, zoneId: 'Z6', fieldLengthBand: 'opp_22', passVariant: 'offload', offloadTone: 'positive' });
  t += 4_000;
  push({ ms: t, kind: 'try', jersey: 8, zoneId: 'Z6' });
  t += 22_000;
  push({ ms: t, kind: 'conversion', jersey: 8, zoneId: 'Z6', conversionOutcome: 'made' });
  t += 28_000;

  // More possession
  for (let i = 0; i < 10; i++) {
    push(passRow(t, ((i + 1) % 13) + 1, PASS_ZONES[(i + 19) % PASS_ZONES.length]!));
    t += 2_400 + (i % 4) * 300;
  }

  // Opponent sub
  push({ ms: t, kind: 'opponent_substitution' });
  t += 3_000;

  // Negative: forward pass
  push({ ms: t, kind: 'negative_action', jersey: 7, zoneId: 'Z3', negativeActionId: 'forward_pass' });
  t += 5_000;

  // ---- P2: Second half ----
  t = Math.max(t, HALF_MS + 4_000);

  push({ ms: t, kind: 'scrum', zoneId: 'Z3', setPieceOutcome: 'penalized', playPhaseContext: 'defense' });
  t += 6_500;

  // Passes (44 across both halves)
  for (let i = 0; i < 30; i++) {
    push(passRow(t, (i % 13) + 1, PASS_ZONES[(i + 5) % PASS_ZONES.length]!));
    t += 1_900 + (i % 10) * 240;
  }

  // Line break in second half
  push({ ms: t, kind: 'line_break', jersey: 2, zoneId: 'Z4', fieldLengthBand: 'opp_half', passVariant: 'standard' });
  t += 3_500;

  // More passes
  for (let i = 30; i < 44; i++) {
    push(passRow(t, (i % 13) + 1, PASS_ZONES[(i + 5) % PASS_ZONES.length]!));
    t += 1_900 + (i % 10) * 240;
  }

  // Ruck with phase context
  push({ ms: t, kind: 'ruck', zoneId: 'Z4', setPieceOutcome: 'won', playPhaseContext: 'attack', linkPrevPass: true });
  t += 4_500;

  // Opponent try
  push({ ms: t, kind: 'opponent_try', zoneId: 'Z4' });
  t += 18_000;
  push({ ms: t, kind: 'opponent_conversion', zoneId: 'Z4', conversionOutcome: 'missed' });
  t += 12_000;

  // Defensive tackles (second half)
  for (let i = 0; i < 20; i++) {
    push(tackleRow(
      t,
      [4, 5, 6, 7, 1, 2, 3, 11, 12, 13, 4, 5, 6, 7, 1, 2, 3, 11, 12, 13][i % 20]!,
      i % 6 === 0 ? 'missed' : 'made',
      DEF_ZONES[(i + 2) % DEF_ZONES.length]!,
    ));
    t += 3_600 + (i % 5) * 500;
  }

  // More penalties (second half)
  for (let i = 0; i < 8; i++) {
    const spec = PENALTY_ROTATION[penaltyIdx % PENALTY_ROTATION.length]!;
    penaltyIdx++;
    push({
      ms: t,
      kind: 'team_penalty',
      jersey: ((i + 3) % 13) + 1,
      zoneId: ['Z3', 'Z4', 'Z3', 'Z2', 'Z3', 'Z4', 'Z3', 'Z4'][i] as ZoneId,
      penaltyType: spec.type,
      penaltyCard: spec.card,
    });
    t += 8_500 + (i % 3) * 2_800;
  }

  // Opponent card
  push({ ms: t, kind: 'opponent_card', penaltyCard: 'yellow' });
  t += 5_000;

  // Negative: knock-on leads to turnover
  push({ ms: t, kind: 'negative_action', jersey: 11, zoneId: 'Z5', negativeActionId: 'knock_on' });
  t += 4_000;

  // Set pieces with defense phase
  push({ ms: t, kind: 'lineout', zoneId: 'Z3', setPieceOutcome: 'won', playPhaseContext: 'defense' });
  t += 5_000;
  push({ ms: t, kind: 'scrum', zoneId: 'Z4', setPieceOutcome: 'lost', playPhaseContext: 'attack' });
  t += 7_000;

  // More passes
  for (let i = 0; i < 18; i++) {
    push(passRow(t, ((i + 6) % 13) + 1, PASS_ZONES[(i + 23) % PASS_ZONES.length]!));
    t += 2_100 + (i % 6) * 200;
  }

  push({ ms: t, kind: 'lineout', zoneId: 'Z4', setPieceOutcome: 'won', playPhaseContext: 'attack' });
  t += 5_500;
  push({ ms: t, kind: 'scrum', zoneId: 'Z3', setPieceOutcome: 'won', playPhaseContext: 'attack' });
  t += 7_000;

  // Line break → second try
  push({ ms: t, kind: 'line_break', jersey: 2, zoneId: 'Z5', fieldLengthBand: 'opp_half', passVariant: 'standard' });
  t += 3_000;
  push({ ms: t, kind: 'try', jersey: 2, zoneId: 'Z5' });
  t += 26_000;
  push({ ms: t, kind: 'conversion', jersey: 2, zoneId: 'Z5', conversionOutcome: 'made' });
  t += 40_000;

  for (let i = 0; i < 8; i++) {
    push(passRow(t, (i % 13) + 1, PASS_ZONES[(i + 40) % PASS_ZONES.length]!));
    t += 2_800;
  }

  // Opponent sub + card
  push({ ms: t, kind: 'opponent_substitution' });
  t += 2_000;

  // ---- P3: Extra time ----
  t = Math.max(t, FULL_REG_MS + 6_000);

  push({ ms: t, kind: 'scrum', zoneId: 'Z4', setPieceOutcome: 'won', playPhaseContext: 'attack' });
  t += 5_000;

  for (let i = 0; i < 12; i++) {
    push(passRow(t, ((i + 2) % 13) + 1, PASS_ZONES[(i + 7) % PASS_ZONES.length]!));
    t += 2_200;
  }

  // Ruck sequence in extra time
  push({ ms: t, kind: 'ruck', zoneId: 'Z5', setPieceOutcome: 'won', playPhaseContext: 'attack', linkPrevPass: true });
  t += 3_500;
  push(passRow(t, 4, 'Z5'));
  t += 2_200;
  push({ ms: t, kind: 'ruck', zoneId: 'Z5', setPieceOutcome: 'penalized', playPhaseContext: 'attack', linkPrevPass: true });
  t += 4_000;

  // ET tackles
  for (let i = 0; i < 6; i++) {
    push(tackleRow(
      t,
      [6, 7, 1, 2, 3, 4][i]!,
      i % 3 === 0 ? 'missed' : 'made',
      DEF_ZONES[(i + 4) % DEF_ZONES.length]!,
    ));
    t += 4_500;
  }

  // Negative: bad pass in ET
  push({ ms: t, kind: 'negative_action', jersey: 10, zoneId: 'Z4', negativeActionId: 'bad_pass' });
  t += 4_000;

  // ET penalties
  for (let i = 0; i < 4; i++) {
    const spec = PENALTY_ROTATION[penaltyIdx % PENALTY_ROTATION.length]!;
    penaltyIdx++;
    push({
      ms: t,
      kind: 'team_penalty',
      jersey: ((i + 5) % 13) + 1,
      zoneId: 'Z3',
      penaltyType: spec.type,
      penaltyCard: spec.card,
    });
    t += 9_500;
  }

  // Opponent try in ET
  push({ ms: t, kind: 'opponent_try', zoneId: 'Z5' });
  t += 15_000;
  push({ ms: t, kind: 'opponent_conversion', zoneId: 'Z5', conversionOutcome: 'made' });
  t += 10_000;

  // Final ruck and lineout
  push({ ms: t, kind: 'ruck', zoneId: 'Z4', setPieceOutcome: 'lost', playPhaseContext: 'defense', linkPrevPass: true });
  t += 3_500;
  push({ ms: t, kind: 'lineout', zoneId: 'Z5', setPieceOutcome: 'won', playPhaseContext: 'defense' });

  return rows;
}

/** Insert demo events for Pool A — Game 1 (three periods with full analytics coverage). */
export async function seedPoolGameOneFullTimeline(matchId: string, players: PlayerRecord[]): Promise<void> {
  const pid = (n: number) => players.find((p) => p.number === n)?.id;
  const script = buildPoolGameOneSeedRows();
  let lastPassId: string | undefined;

  for (const r of script) {
    const period = periodForMatchMs(r.ms);
    const playerId = r.jersey != null ? pid(r.jersey) : undefined;

    const needsPlayer =
      r.kind === 'pass' ||
      r.kind === 'try' ||
      r.kind === 'conversion' ||
      r.kind === 'tackle' ||
      r.kind === 'team_penalty' ||
      r.kind === 'line_break' ||
      r.kind === 'negative_action';
    if (needsPlayer && r.jersey != null && !playerId) continue;

    const precedingPassEventId =
      r.kind === 'ruck' && r.linkPrevPass && lastPassId ? lastPassId : undefined;

    const rec = await addMatchEvent({
      matchId,
      kind: r.kind,
      matchTimeMs: r.ms,
      period,
      zoneId: r.zoneId,
      fieldLengthBand: r.fieldLengthBand,
      playerId,
      tackleOutcome: r.tackleOutcome,
      tackleQuality: r.tackleQuality,
      passVariant: r.passVariant,
      offloadTone: r.offloadTone,
      penaltyType: r.penaltyType,
      penaltyCard: r.penaltyCard,
      setPieceOutcome: r.setPieceOutcome,
      playPhaseContext: r.playPhaseContext,
      negativeActionId: r.negativeActionId,
      precedingPassEventId,
      ...(r.conversionOutcome ? { conversionOutcome: r.conversionOutcome } : {}),
    });

    if (r.kind === 'pass') lastPassId = rec.id;
  }
}
