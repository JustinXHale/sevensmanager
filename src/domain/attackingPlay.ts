/** Normalized pitch coordinates (0–1). Origin top-left of attacking quarter. */
export type NormPoint = { x: number; y: number };

export type AttackingPlayerSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AttackingPlayerState = {
  slot: AttackingPlayerSlot;
  /** Rest / path anchor when path is empty */
  position: NormPoint;
  /** Running line in normalized space (solid). Empty = stationary at `position`. */
  pathPoints: NormPoint[];
  /** 0 = no motion along path; 1–10 scale for playback speed */
  speed: number;
  /** When this player starts moving along `pathPoints` (seconds from start of this phase) */
  startTimeSec: number;
};

/** One timeline slice: duration + who moves + ball chain (times relative to phase start). */
export type AttackingPhaseSlice = {
  durationSec: number;
  players: AttackingPlayerState[];
  possessionChain: AttackingPlayerSlot[];
  passArrivalTimeSec: number[];
};

/** Legacy single-timeline document (migrated to v2 on load). */
export type AttackingPlayDocumentV1 = {
  schemaVersion: 1;
  name: string;
  durationSec: number;
  snapStep: number | null;
  players: AttackingPlayerState[];
  possessionChain: AttackingPlayerSlot[];
  passArrivalTimeSec: number[];
};

export type AttackingPlayDocumentV2 = {
  schemaVersion: 2;
  name: string;
  snapStep: number | null;
  /** Exactly five chained phases; each builds on the end of the previous at playback. */
  phases: AttackingPhaseSlice[];
};

/** Ball / pass helpers use this shape (a single phase timeline). */
export type PhaseTimeline = Pick<
  AttackingPhaseSlice,
  'durationSec' | 'players' | 'possessionChain' | 'passArrivalTimeSec'
>;

/** IndexedDB row for saved canvas plays */
export type AttackingPlayRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  document: AttackingPlayDocumentV2;
};

export const PHASE_COUNT = 5;

export const ATTACKING_PLAY_SCHEMA_VERSION = 2 as const;

/** Fixed duration (seconds) for dotted pass flight animation */
export const PASS_FLIGHT_SEC = 0.35;

const SLOTS: AttackingPlayerSlot[] = [1, 2, 3, 4, 5, 6, 7];

function defaultKickoffPositions(): NormPoint[] {
  return [
    { x: 0.5, y: 0.88 },
    { x: 0.22, y: 0.62 },
    { x: 0.36, y: 0.52 },
    { x: 0.5, y: 0.45 },
    { x: 0.64, y: 0.52 },
    { x: 0.78, y: 0.62 },
    { x: 0.5, y: 0.72 },
  ];
}

function defaultPlayerForSlot(slot: AttackingPlayerSlot): AttackingPlayerState {
  const positions = defaultKickoffPositions();
  return {
    slot,
    position: positions[slot - 1]!,
    pathPoints: [],
    speed: 5,
    startTimeSec: 0,
  };
}

function normalizePlayersInSlice(players: AttackingPlayerState[]): AttackingPlayerState[] {
  return SLOTS.map((slot) => {
    const found = players.find((p) => p.slot === slot);
    if (found) return { ...found, slot };
    return defaultPlayerForSlot(slot);
  });
}

export function normalizePhaseSlice(slice: AttackingPhaseSlice): AttackingPhaseSlice {
  let chain = slice.possessionChain.filter((s) => s >= 1 && s <= 7) as AttackingPlayerSlot[];
  if (chain.length === 0) chain = [1];
  const need = Math.max(0, chain.length - 1);
  const passArrivalTimeSec = slice.passArrivalTimeSec.slice(0, need);
  const dur = Math.max(0.5, slice.durationSec);
  while (passArrivalTimeSec.length < need) {
    const prev = passArrivalTimeSec[passArrivalTimeSec.length - 1] ?? 1;
    passArrivalTimeSec.push(Math.min(dur - 0.1, prev + 0.8));
  }
  for (let i = 0; i < passArrivalTimeSec.length; i++) {
    passArrivalTimeSec[i] = Math.max(0, Math.min(dur, passArrivalTimeSec[i] ?? 0));
  }
  return {
    durationSec: dur,
    possessionChain: chain,
    passArrivalTimeSec,
    players: normalizePlayersInSlice(slice.players),
  };
}

function emptyPhaseSlice(durationSec: number): AttackingPhaseSlice {
  const positions = defaultKickoffPositions();
  const players: AttackingPlayerState[] = SLOTS.map((slot, i) => ({
    slot,
    position: positions[i]!,
    pathPoints: [],
    speed: 5,
    startTimeSec: 0,
  }));
  return normalizePhaseSlice({
    durationSec,
    players,
    possessionChain: [1],
    passArrivalTimeSec: [],
  });
}

export function createDefaultAttackingPlayDocument(name = 'Untitled play'): AttackingPlayDocumentV2 {
  const phases: AttackingPhaseSlice[] = [
    emptyPhaseSlice(12),
    emptyPhaseSlice(4),
    emptyPhaseSlice(4),
    emptyPhaseSlice(4),
    emptyPhaseSlice(4),
  ];
  let doc = normalizePlayDocumentV2({ schemaVersion: 2, name, snapStep: null, phases });
  for (let k = 1; k < PHASE_COUNT; k++) {
    doc = resyncPhaseFromPrevious(doc, k);
  }
  return doc;
}

function migrateV1ToV2(v1: AttackingPlayDocumentV1): AttackingPlayDocumentV2 {
  const p0 = normalizeLegacyV1Slice(v1);
  const phases: AttackingPhaseSlice[] = [
    p0,
    emptyPhaseSlice(4),
    emptyPhaseSlice(4),
    emptyPhaseSlice(4),
    emptyPhaseSlice(4),
  ];
  let doc = normalizePlayDocumentV2({ schemaVersion: 2, name: v1.name, snapStep: v1.snapStep, phases });
  for (let k = 1; k < PHASE_COUNT; k++) {
    doc = resyncPhaseFromPrevious(doc, k);
  }
  return doc;
}

function normalizeLegacyV1Slice(v1: AttackingPlayDocumentV1): AttackingPhaseSlice {
  let chain = v1.possessionChain.filter((s) => s >= 1 && s <= 7) as AttackingPlayerSlot[];
  if (chain.length === 0) chain = [1];
  const need = Math.max(0, chain.length - 1);
  const passArrivalTimeSec = v1.passArrivalTimeSec.slice(0, need);
  const dur = Math.max(0.5, v1.durationSec);
  while (passArrivalTimeSec.length < need) {
    const prev = passArrivalTimeSec[passArrivalTimeSec.length - 1] ?? 2;
    passArrivalTimeSec.push(Math.min(dur - 0.5, prev + 2));
  }
  const players = SLOTS.map((slot) => {
    const found = v1.players.find((p) => p.slot === slot);
    if (found) return { ...found, slot };
    return defaultPlayerForSlot(slot);
  });
  return normalizePhaseSlice({
    durationSec: dur,
    players,
    possessionChain: chain,
    passArrivalTimeSec,
  });
}

export function normalizePlayDocumentV2(doc: AttackingPlayDocumentV2): AttackingPlayDocumentV2 {
  let phases = doc.phases.slice(0, PHASE_COUNT).map((p) => normalizePhaseSlice(p));
  while (phases.length < PHASE_COUNT) {
    phases.push(emptyPhaseSlice(4));
  }
  phases = phases.slice(0, PHASE_COUNT).map((p) => normalizePhaseSlice(p));
  return { ...doc, schemaVersion: 2, phases };
}

/** Load from IndexedDB: migrate v1 → v2, normalize v2. */
export function ensurePlayDocument(raw: unknown): AttackingPlayDocumentV2 {
  if (!raw || typeof raw !== 'object') return createDefaultAttackingPlayDocument();
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion === 2 && Array.isArray(o.phases)) {
    return normalizePlayDocumentV2(o as AttackingPlayDocumentV2);
  }
  if (o.schemaVersion === 1) {
    return migrateV1ToV2(o as AttackingPlayDocumentV1);
  }
  // Unknown shape: treat as v1-like if it has players array
  if (Array.isArray(o.players) && typeof o.durationSec === 'number') {
    return migrateV1ToV2(o as unknown as AttackingPlayDocumentV1);
  }
  return createDefaultAttackingPlayDocument();
}

/**
 * Entering positions + paths for this phase.
 * Phase 0: stored layout. Later phases: base from end of previous phase when there is no path yet;
 * once a player has a path, stored `position` is used so token drags in this phase behave normally.
 */
export function resolvePlayersForPhase(doc: AttackingPlayDocumentV2, phaseIndex: number): AttackingPlayerState[] {
  const docN = normalizePlayDocumentV2(doc);
  const slice = docN.phases[phaseIndex]!;
  if (phaseIndex === 0) {
    return slice.players.map((p) => ({ ...p }));
  }
  const atEndPrev = phaseEndPositions(docN, phaseIndex - 1);
  return slice.players.map((sp) => {
    const forced = atEndPrev.get(sp.slot)!;
    const hasPath = sp.pathPoints.length >= 2;
    return {
      ...sp,
      position: hasPath ? { ...sp.position } : { ...forced },
    };
  });
}

/** Position of each jersey at end of phase `phaseIndex` (global sim through that phase). */
export function phaseEndPositions(doc: AttackingPlayDocumentV2, phaseIndex: number): Map<AttackingPlayerSlot, NormPoint> {
  const docN = normalizePlayDocumentV2(doc);
  const m = new Map<AttackingPlayerSlot, NormPoint>();
  const resolved = resolvePlayersForPhase(docN, phaseIndex);
  const slice = docN.phases[phaseIndex]!;
  const d = slice.durationSec;
  for (const p of resolved) {
    m.set(p.slot, playerPositionAtTime(p, d));
  }
  return m;
}

/** Copy end positions from phaseIndex-1 into stored positions for phaseIndex (keeps paths). */
export function resyncPhaseFromPrevious(doc: AttackingPlayDocumentV2, phaseIndex: number): AttackingPlayDocumentV2 {
  if (phaseIndex <= 0 || phaseIndex >= PHASE_COUNT) return normalizePlayDocumentV2(doc);
  const docN = normalizePlayDocumentV2(doc);
  const ends = phaseEndPositions(docN, phaseIndex - 1);
  const phases = docN.phases.map((ph, i) => {
    if (i !== phaseIndex) return ph;
    const players = ph.players.map((sp) => ({
      ...sp,
      position: { ...ends.get(sp.slot)! },
    }));
    return normalizePhaseSlice({ ...ph, players });
  });
  return normalizePlayDocumentV2({ ...docN, phases });
}

export function totalPlayDurationSec(doc: AttackingPlayDocumentV2): number {
  return normalizePlayDocumentV2(doc).phases.reduce((s, p) => s + p.durationSec, 0);
}

export function globalTimeToPhaseLocal(
  doc: AttackingPlayDocumentV2,
  globalT: number,
): { phaseIndex: number; tLocal: number } {
  const phases = normalizePlayDocumentV2(doc).phases;
  let remaining = Math.max(0, globalT);
  for (let i = 0; i < phases.length; i++) {
    const d = phases[i]!.durationSec;
    if (remaining < d || i === phases.length - 1) {
      return { phaseIndex: i, tLocal: Math.min(remaining, d) };
    }
    remaining -= d;
  }
  return { phaseIndex: phases.length - 1, tLocal: phases[phases.length - 1]!.durationSec };
}

export function phaseLocalToGlobalTime(doc: AttackingPlayDocumentV2, phaseIndex: number, tLocal: number): number {
  const phases = normalizePlayDocumentV2(doc).phases;
  let sum = 0;
  for (let i = 0; i < phaseIndex; i++) {
    sum += phases[i]!.durationSec;
  }
  return sum + Math.max(0, Math.min(phases[phaseIndex]!.durationSec, tLocal));
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function snapScalar(value: number, step: number | null): number {
  if (step == null || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapPoint(p: NormPoint, step: number | null): NormPoint {
  if (step == null || step <= 0) return { ...p };
  return { x: snapScalar(p.x, step), y: snapScalar(p.y, step) };
}

export function polylineLength(points: NormPoint[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

export function speedToUnitsPerSec(speed: number): number {
  if (speed <= 0) return 0;
  return (speed / 10) * 0.22;
}

export function pointAlongPolyline(points: NormPoint[], d: number): NormPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0]! };
  let remaining = Math.max(0, d);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg || i === points.length - 1) {
      if (seg < 1e-9) return { ...b };
      const t = Math.min(1, remaining / seg);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return { ...points[points.length - 1]! };
}

export function playerPathForMotion(p: AttackingPlayerState): NormPoint[] {
  if (p.pathPoints.length >= 2) return p.pathPoints;
  return [p.position, p.position];
}

export function playerPositionAtTime(p: AttackingPlayerState, tSec: number): NormPoint {
  const path = playerPathForMotion(p);
  if (tSec < p.startTimeSec) return { ...path[0]! };
  const elapsed = tSec - p.startTimeSec;
  const len = polylineLength(path);
  if (len < 1e-9) return { ...path[0]! };
  const dist = speedToUnitsPerSec(p.speed) * elapsed;
  const capped = Math.min(dist, len);
  return pointAlongPolyline(path, capped);
}

export type BallRenderState =
  | { kind: 'with'; slot: AttackingPlayerSlot }
  | {
      kind: 'pass';
      fromSlot: AttackingPlayerSlot;
      toSlot: AttackingPlayerSlot;
      u: number;
      arrivalSec: number;
      passStartSec: number;
    };

export function passSegmentEndpoints(
  phase: PhaseTimeline,
  passIndex: number,
  playersBySlot: Map<AttackingPlayerSlot, AttackingPlayerState>,
): { from: NormPoint; to: NormPoint } | null {
  const chain = phase.possessionChain;
  const times = phase.passArrivalTimeSec;
  if (passIndex < 0 || passIndex >= times.length) return null;
  const arrivalSec = times[passIndex]!;
  const a = chain[passIndex]!;
  const b = chain[passIndex + 1]!;
  const pa = playersBySlot.get(a);
  const pb = playersBySlot.get(b);
  if (!pa || !pb) return null;
  const passStartSec = Math.max(0, arrivalSec - PASS_FLIGHT_SEC);
  return {
    from: playerPositionAtTime(pa, passStartSec),
    to: playerPositionAtTime(pb, arrivalSec),
  };
}

export function ballStateAtTime(phase: PhaseTimeline, tSec: number): BallRenderState {
  const chain = phase.possessionChain;
  const times = phase.passArrivalTimeSec;
  if (chain.length === 0) return { kind: 'with', slot: 1 };
  if (chain.length === 1) return { kind: 'with', slot: chain[0]! };

  for (let i = 0; i < times.length; i++) {
    const arrivalSec = times[i]!;
    const passStartSec = Math.max(0, arrivalSec - PASS_FLIGHT_SEC);
    if (tSec < passStartSec) {
      return { kind: 'with', slot: chain[i]! };
    }
    if (tSec < arrivalSec) {
      const u = PASS_FLIGHT_SEC < 1e-6 ? 1 : (tSec - passStartSec) / PASS_FLIGHT_SEC;
      return {
        kind: 'pass',
        fromSlot: chain[i]!,
        toSlot: chain[i + 1]!,
        u: clamp01(u),
        arrivalSec,
        passStartSec,
      };
    }
  }
  return { kind: 'with', slot: chain[chain.length - 1]! };
}

export function ballPositionAtTime(
  phase: PhaseTimeline,
  tSec: number,
  playersBySlot: Map<AttackingPlayerSlot, AttackingPlayerState>,
): NormPoint {
  const getPos = (slot: AttackingPlayerSlot, atSec: number) => {
    const p = playersBySlot.get(slot);
    if (!p) return { x: 0.5, y: 0.5 };
    return playerPositionAtTime(p, atSec);
  };
  const state = ballStateAtTime(phase, tSec);
  if (state.kind === 'with') return getPos(state.slot, tSec);
  const pa = playersBySlot.get(state.fromSlot);
  const pb = playersBySlot.get(state.toSlot);
  if (!pa || !pb) return { x: 0.5, y: 0.5 };
  const from = playerPositionAtTime(pa, state.passStartSec);
  const to = playerPositionAtTime(pb, state.arrivalSec);
  return {
    x: from.x + (to.x - from.x) * state.u,
    y: from.y + (to.y - from.y) * state.u,
  };
}
