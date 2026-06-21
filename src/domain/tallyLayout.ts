import type { SetPiecePenaltyContext } from '@/domain/matchEvent';

export type TallyAttackButtonId =
  | 'pass'
  | 'offload'
  | 'line_break'
  | 'try'
  | 'negative_action'
  | 'knock_on';

export type TallyDefenseButtonId =
  | 'tackle_made'
  | 'tackle_missed'
  | 'defense_pass'
  | 'try_conceded'
  | 'forced_turnover';

export type TallySharedButtonId = 'penalty_conceded' | 'penalty_awarded' | 'system_moment';

export type TallyGridButtonId = TallyAttackButtonId | TallyDefenseButtonId | TallySharedButtonId;

export type TallySetPieceId = SetPiecePenaltyContext;

export type TallyLayout = {
  attack: TallyGridButtonId[];
  defense: TallyGridButtonId[];
  setPieces: TallySetPieceId[];
};

export const DEFAULT_TALLY_ATTACK_ORDER: TallyGridButtonId[] = [
  'pass',
  'offload',
  'line_break',
  'try',
  'negative_action',
  'knock_on',
  'penalty_conceded',
  'penalty_awarded',
  'system_moment',
];

export const DEFAULT_TALLY_DEFENSE_ORDER: TallyGridButtonId[] = [
  'tackle_made',
  'tackle_missed',
  'defense_pass',
  'try_conceded',
  'penalty_conceded',
  'penalty_awarded',
  'forced_turnover',
];

export const DEFAULT_TALLY_SETPIECE_ORDER: TallySetPieceId[] = [
  'restart',
  'ruck',
  'scrum',
  'lineout',
];

export const DEFAULT_TALLY_LAYOUT: TallyLayout = {
  attack: DEFAULT_TALLY_ATTACK_ORDER,
  defense: DEFAULT_TALLY_DEFENSE_ORDER,
  setPieces: DEFAULT_TALLY_SETPIECE_ORDER,
};

const STORAGE_KEY = 'sevensManager.tallyLayout.v1';

const ATTACK_IDS = new Set<string>([
  'pass',
  'offload',
  'line_break',
  'try',
  'negative_action',
  'knock_on',
  'penalty_conceded',
  'penalty_awarded',
  'system_moment',
]);

const DEFENSE_IDS = new Set<string>([
  'tackle_made',
  'tackle_missed',
  'defense_pass',
  'try_conceded',
  'penalty_conceded',
  'penalty_awarded',
  'forced_turnover',
]);

const SET_PIECE_IDS = new Set<string>(['restart', 'ruck', 'scrum', 'lineout']);

function reconcileOrder<T extends string>(saved: unknown, defaults: readonly T[], allowed: Set<string>): T[] {
  const raw = Array.isArray(saved) ? saved.filter((x): x is T => typeof x === 'string' && allowed.has(x)) : [];
  const out = [...raw];
  for (const id of defaults) {
    if (!out.includes(id)) out.push(id);
  }
  return out.filter((id, i) => out.indexOf(id) === i);
}

export function loadTallyLayout(): TallyLayout {
  if (typeof localStorage === 'undefined') return DEFAULT_TALLY_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TALLY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<TallyLayout>;
    return {
      attack: reconcileOrder(parsed.attack, DEFAULT_TALLY_ATTACK_ORDER, ATTACK_IDS),
      defense: reconcileOrder(parsed.defense, DEFAULT_TALLY_DEFENSE_ORDER, DEFENSE_IDS),
      setPieces: reconcileOrder(parsed.setPieces, DEFAULT_TALLY_SETPIECE_ORDER, SET_PIECE_IDS),
    };
  } catch {
    return DEFAULT_TALLY_LAYOUT;
  }
}

export function saveTallyLayout(layout: TallyLayout): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota / private mode */
  }
}

export function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

export function tallyLayoutForPhase(layout: TallyLayout, phase: 'attack' | 'defense'): TallyGridButtonId[] {
  return phase === 'attack' ? layout.attack : layout.defense;
}
