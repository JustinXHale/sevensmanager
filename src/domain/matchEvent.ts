import type { ZoneId } from '@/domain/zone';

/** Logged events (own team). Set pieces + per-player actions. */
export type MatchEventKind =
  | 'scrum'
  | 'lineout'
  | 'team_penalty'
  | 'pass'
  | 'tackle'
  | 'try'
  | 'conversion'
  | 'opponent_try'
  | 'opponent_conversion'
  | 'opponent_substitution'
  | 'opponent_card'
  | 'ruck'
  | 'line_break'
  | 'negative_action';

/** All event kinds (for filters, iteration). Order is not significant. */
export const MATCH_EVENT_KINDS: readonly MatchEventKind[] = [
  'scrum',
  'lineout',
  'team_penalty',
  'pass',
  'tackle',
  'try',
  'conversion',
  'opponent_try',
  'opponent_conversion',
  'opponent_substitution',
  'opponent_card',
  'ruck',
  'line_break',
  'negative_action',
];

/** Handling / skill errors (attack) — pick type then zone. */
export const NEGATIVE_ACTION_IDS = ['bad_pass', 'knock_on', 'forward_pass'] as const;
export type NegativeActionId = (typeof NEGATIVE_ACTION_IDS)[number];

const NEGATIVE_ACTION_LABEL: Record<NegativeActionId, string> = {
  bad_pass: 'Bad pass',
  knock_on: 'Knock-on',
  forward_pass: 'Forward pass',
};

/** Removed from UI (same as knock-on); still may exist on older rows. */
const LEGACY_NEGATIVE_AS_KNOCK_ON = new Set(['lost_ball', 'handling_error']);

export function negativeActionLabel(id: string | undefined): string {
  if (!id) return 'Negative play';
  if (LEGACY_NEGATIVE_AS_KNOCK_ON.has(id)) return 'Knock-on';
  return NEGATIVE_ACTION_LABEL[id as NegativeActionId] ?? id;
}

/** Semicircle pills: short label + full title. Order matches {@link NEGATIVE_ACTION_IDS}. */
export const NEGATIVE_ACTION_RING: { id: NegativeActionId; label: string; title: string; toneClass: string }[] =
  NEGATIVE_ACTION_IDS.map((id) => ({
    id,
    label: id === 'bad_pass' ? 'Bad pass' : id === 'knock_on' ? 'Knock-on' : 'Forward',
    title: NEGATIVE_ACTION_LABEL[id],
    toneClass: 'live-zone-flower-pill--tone-bad',
  }));

/** Persisted on older rows only — display as knock-on via {@link negativeActionLabel}. */
export type LegacyNegativeActionId = 'lost_ball' | 'handling_error';
export type StoredNegativeActionId = NegativeActionId | LegacyNegativeActionId;

/** When `kind === 'tackle'`, whether the tackle was completed. Legacy rows may omit this (treated as made). */
export type TackleOutcome = 'made' | 'missed';

/** When `kind === 'conversion'`: kick result. Legacy rows may omit (display as generic “Conversion”). */
export type ConversionOutcome = 'made' | 'missed';

/** When `kind === 'tackle'` and made: first ring in zone picker (legacy rows omit → treated as neutral). */
export type TackleQuality = 'dominant' | 'neutral' | 'passive';

/**
 * Offload **quality** when `passVariant === 'offload'` (Neg / Neu / Pos). Standard passes omit this.
 * Legacy rows may only have `offloadOutcome` — use {@link resolveOffloadTone}.
 */
export type OffloadTone = 'negative' | 'neutral' | 'positive';

/** Pass / line_break: standard pass vs offload (offload then has {@link OffloadTone}). */
export type PassVariant = 'standard' | 'offload';

/** @deprecated IndexedDB only */
export type OffloadOutcome = 'won' | 'lost';

/** For scrum / lineout / ruck: result of the restart (incl. penalty against). */
export type SetPieceOutcome = 'won' | 'lost' | 'penalized';

/** Live Attack/Defense switcher context when a set piece is logged. */
export type PlayPhaseContext = 'attack' | 'defense';

/** Optional discipline card on `team_penalty` events. */
export type PenaltyCard = 'yellow' | 'red';

export const PENALTY_TYPES = [
  { id: 'offside', label: 'Offside' },
  { id: 'hands_in_ruck', label: 'Hands in ruck' },
  { id: 'high_tackle', label: 'High tackle' },
  { id: 'neck_roll', label: 'Neck roll' },
  { id: 'side_entry', label: 'Side entry' },
  { id: 'collapsing', label: 'Collapsing maul/ruck' },
  { id: 'not_releasing', label: 'Not releasing' },
  { id: 'not_rolling_away', label: 'Not rolling away' },
  { id: 'sealing_off', label: 'Sealing off' },
  { id: 'scrummage', label: 'Scrummage (binding/angle)' },
  { id: 'lineout_offence', label: 'Lineout offence' },
  { id: 'dangerous_play', label: 'Dangerous play' },
  { id: 'deliberate_knock_on', label: 'Deliberate knock-on' },
  { id: 'other', label: 'Other' },
] as const;

export type PenaltyTypeId = (typeof PENALTY_TYPES)[number]['id'];

export function penaltyTypeLabel(id: PenaltyTypeId): string {
  return PENALTY_TYPES.find((p) => p.id === id)?.label ?? id;
}

/** Payload for logging a team penalty from the live row UI. */
export type TeamPenaltyPayload = {
  penaltyType: PenaltyTypeId;
  card?: PenaltyCard;
  /** Required when `penaltyType` is `other` (free-text infraction). */
  penaltyDetail?: string;
};

/** Pitch length band for logged pass / try / conversion (zone flower level 2). */
export const FIELD_LENGTH_BAND_IDS = ['own_22', 'own_half', 'opp_half', 'opp_22'] as const;
export type FieldLengthBandId = (typeof FIELD_LENGTH_BAND_IDS)[number];

const FIELD_LENGTH_BAND_SHORT: Record<FieldLengthBandId, string> = {
  own_22: '22',
  own_half: 'H',
  opp_half: 'OH',
  opp_22: 'O22',
};

export function fieldLengthBandShortLabel(id: FieldLengthBandId): string {
  return FIELD_LENGTH_BAND_SHORT[id];
}

/**
 * CSS classes for Area ring pills (order matches {@link FIELD_LENGTH_BAND_IDS}).
 * Own half: danger red in 22, standard red before halfway; attacking half: greens toward opp 22.
 */
export const FIELD_LENGTH_BAND_PILL_CLASSNAMES = [
  'live-zone-flower-pill--field-own22',
  'live-zone-flower-pill--field-own-half',
  'live-zone-flower-pill--field-opp-half',
  'live-zone-flower-pill--field-opp22',
] as const;

/** Width labels on level-1 semicircle (maps to Z1…Z6). */
export const WIDTH_LEVEL_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'] as const;

/** Zone flower result: width (zone) always; length band omitted for try only. */
export type ZoneFlowerPick = {
  zoneId: ZoneId;
  fieldLengthBand?: FieldLengthBandId;
  /** Tackle made: first ring (Passive / Neutral / Dominant). */
  tackleQuality?: TackleQuality;
  /** Pass / line_break: standard vs offload before Offload ring. */
  passVariant?: PassVariant;
  /** Pass / line_break: only when `passVariant === 'offload'`. */
  offloadTone?: OffloadTone;
  /** For `kind === 'negative_action'`. */
  negativeActionId?: NegativeActionId;
  /** For `kind === 'conversion'` (location comes from paired try, not the flower). */
  conversionOutcome?: ConversionOutcome;
};


export interface MatchEventRecord {
  id: string;
  matchId: string;
  kind: MatchEventKind;
  matchTimeMs: number;
  period: number;
  createdAt: number;
  /** Own-team player (required for team_penalty in UI; stored when set). */
  playerId?: string;
  penaltyType?: PenaltyTypeId;
  /** When set, a card was selected for this penalty (optional in UI). */
  penaltyCard?: PenaltyCard;
  /** Free text when `penaltyType === 'other'` or extra detail. */
  penaltyDetail?: string;
  /** Soft-delete: set when removed from the live log (Phase 3). */
  deletedAt?: number;
  /** For `kind === 'tackle'`. */
  tackleOutcome?: TackleOutcome;
  /** For `kind === 'tackle'` when made. */
  tackleQuality?: TackleQuality;
  /** For `kind === 'pass'` / `line_break` when `passVariant === 'offload'` (or legacy rows). */
  offloadTone?: OffloadTone;
  /** Pass / line_break: `standard` = no offload quality; `offload` requires {@link offloadTone}. */
  passVariant?: PassVariant;
  /** @deprecated Legacy pass offload; prefer `offloadTone`. */
  offloadOutcome?: OffloadOutcome;
  /** For `kind === 'ruck'`: optional link to a prior pass event. */
  precedingPassEventId?: string;
  /** For `kind === 'scrum' | 'lineout' | 'ruck`: won/lost on the restart. */
  setPieceOutcome?: SetPieceOutcome;
  /** For set-piece kinds: Attack vs Defense mode when logged. */
  playPhaseContext?: PlayPhaseContext;
  /** Team-relative field zone (own goal → opp goal). See PRODUCT_SPEC §5.2. */
  zoneId?: ZoneId;
  /**
   * Length along the pitch (team-relative): own 22 → own half → opp half → opp 22.
   * Set from the zone flower (pass / try / conversion / tackle M·X); optional on older rows.
   */
  fieldLengthBand?: FieldLengthBandId;
  /** For `kind === 'negative_action'` (legacy `lost_ball` / `handling_error` may remain on disk). */
  negativeActionId?: StoredNegativeActionId;
  /** For `kind === 'conversion'` / `opponent_conversion`. */
  conversionOutcome?: ConversionOutcome;
}

/** True when logged tries exceed conversions (next score on Tr buttons should be a conversion). */
export function matchOwesConversion(
  events: Pick<MatchEventRecord, 'kind' | 'deletedAt'>[],
): boolean {
  let tries = 0;
  let convs = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'try') tries += 1;
    if (e.kind === 'conversion') convs += 1;
  }
  return tries > convs;
}

/** Fallback zone when a try row has no `zoneId` (legacy). Matches Live default strip. */
export const DEFAULT_TRY_ZONE_ID: ZoneId = 'Z4';

/**
 * Location for the next conversion kick: same as the **oldest try** that does not yet have a logged
 * conversion after it (FIFO). `fieldLengthBand` is copied from that try when set.
 */
export function pendingConversionKickFromEvents(
  events: Pick<
    MatchEventRecord,
    'kind' | 'deletedAt' | 'matchTimeMs' | 'createdAt' | 'zoneId' | 'fieldLengthBand'
  >[],
): { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null {
  const ordered = [...events]
    .filter((e) => e.deletedAt == null)
    .sort((a, b) => {
      const t = a.matchTimeMs - b.matchTimeMs;
      if (t !== 0) return t;
      return a.createdAt - b.createdAt;
    });
  const queue: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId }[] = [];
  for (const e of ordered) {
    if (e.kind === 'try') {
      queue.push({
        zoneId: e.zoneId ?? DEFAULT_TRY_ZONE_ID,
        fieldLengthBand: e.fieldLengthBand,
      });
    } else if (e.kind === 'conversion') {
      if (queue.length > 0) queue.shift();
    }
  }
  return queue.length > 0 ? queue[0] : null;
}

/** True when logged opponent tries exceed opponent conversions (next Opp chip should be conversion). */
export function matchOpponentOwesConversion(
  events: Pick<MatchEventRecord, 'kind' | 'deletedAt'>[],
): boolean {
  let tries = 0;
  let convs = 0;
  for (const e of events) {
    if (e.deletedAt != null) continue;
    if (e.kind === 'opponent_try') tries += 1;
    if (e.kind === 'opponent_conversion') convs += 1;
  }
  return tries > convs;
}

/** Next opponent conversion kick location from FIFO pairing of opponent_try / opponent_conversion. */
export function pendingOpponentConversionKickFromEvents(
  events: Pick<
    MatchEventRecord,
    'kind' | 'deletedAt' | 'matchTimeMs' | 'createdAt' | 'zoneId' | 'fieldLengthBand'
  >[],
): { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId } | null {
  const ordered = [...events]
    .filter((e) => e.deletedAt == null)
    .sort((a, b) => {
      const t = a.matchTimeMs - b.matchTimeMs;
      if (t !== 0) return t;
      return a.createdAt - b.createdAt;
    });
  const queue: { zoneId: ZoneId; fieldLengthBand?: FieldLengthBandId }[] = [];
  for (const e of ordered) {
    if (e.kind === 'opponent_try') {
      queue.push({
        zoneId: e.zoneId ?? DEFAULT_TRY_ZONE_ID,
        fieldLengthBand: e.fieldLengthBand,
      });
    } else if (e.kind === 'opponent_conversion') {
      if (queue.length > 0) queue.shift();
    }
  }
  return queue.length > 0 ? queue[0] : null;
}

/**
 * Whether this pass/line_break row should count toward **offload quality** stats (Neg / Neu / Pos).
 * Standard passes and explicit `passVariant === 'standard'` are excluded; legacy rows (no `passVariant`) still count.
 */
export function eventCountsTowardOffloadStats(
  e: Pick<MatchEventRecord, 'kind' | 'passVariant'>,
): boolean {
  if (e.kind !== 'pass' && e.kind !== 'line_break') return false;
  if (e.passVariant === 'standard') return false;
  return true;
}

/** Normalize pass / line_break rows for analytics and display (legacy `passVariant` / `offloadOutcome`). */
export function resolveOffloadTone(
  e: Pick<MatchEventRecord, 'kind' | 'offloadTone' | 'passVariant' | 'offloadOutcome'>,
): OffloadTone {
  if (e.kind !== 'pass' && e.kind !== 'line_break') return 'neutral';
  if (e.offloadTone) return e.offloadTone;
  if (e.kind === 'pass' && e.passVariant === 'offload') {
    if (e.offloadOutcome === 'lost') return 'negative';
    if (e.offloadOutcome === 'won') return 'positive';
  }
  return 'neutral';
}

/** Yellow / red cards shown after a player’s name in the live UI (from logged team_penalty events). */
export type PlayerDisciplineBadges = { yellow: boolean; red: boolean };

export function emptyDisciplineBadges(): PlayerDisciplineBadges {
  return { yellow: false, red: false };
}

/** Aggregate card flags per player for the match (ignores soft-deleted events). */
export function accumulateDisciplineBadgesFromEvents(
  events: MatchEventRecord[],
): Record<string, PlayerDisciplineBadges> {
  const out: Record<string, PlayerDisciplineBadges> = {};
  for (const e of events) {
    if (e.kind !== 'team_penalty' || !e.playerId || e.deletedAt || !e.penaltyCard) continue;
    const prev = out[e.playerId] ?? { yellow: false, red: false };
    out[e.playerId] = {
      yellow: prev.yellow || e.penaltyCard === 'yellow',
      red: prev.red || e.penaltyCard === 'red',
    };
  }
  return out;
}
