import { describe, expect, it } from 'vitest';
import type { AttackingPlayerSlot } from './attackingPlay';
import {
  ballPositionAtTime,
  ballStateAtTime,
  createDefaultAttackingPlayDocument,
  globalTimeToPhaseLocal,
  normalizePhaseSlice,
  normalizePlayDocumentV2,
  passSegmentEndpoints,
  playerPositionAtTime,
  pointAlongPolyline,
  polylineLength,
  speedToUnitsPerSec,
  totalPlayDurationSec,
} from './attackingPlay';

describe('polylineLength', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 0, y: 0 }])).toBe(0);
  });

  it('sums segment lengths', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(polylineLength(pts)).toBeCloseTo(2);
  });
});

describe('pointAlongPolyline', () => {
  it('returns first point when d is 0', () => {
    const pts = [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.2 },
    ];
    expect(pointAlongPolyline(pts, 0)).toEqual(pts[0]);
  });

  it('returns last point when d exceeds length', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    expect(pointAlongPolyline(pts, 999)).toEqual(pts[1]);
  });
});

describe('speedToUnitsPerSec', () => {
  it('is zero for non-positive speed', () => {
    expect(speedToUnitsPerSec(0)).toBe(0);
    expect(speedToUnitsPerSec(-1)).toBe(0);
  });

  it('increases with speed', () => {
    expect(speedToUnitsPerSec(10)).toBeGreaterThan(speedToUnitsPerSec(5));
  });
});

function phaseDoc(chain: AttackingPlayerSlot[], passAt: number) {
  const base = createDefaultAttackingPlayDocument();
  const ph0 = normalizePhaseSlice({
    ...base.phases[0]!,
    possessionChain: chain,
    passArrivalTimeSec: [passAt],
    durationSec: 5,
  });
  return normalizePlayDocumentV2({ ...base, phases: [ph0, ...base.phases.slice(1)] });
}

describe('ballStateAtTime', () => {
  it('returns holder for single-node chain', () => {
    const doc = normalizePlayDocumentV2({
      ...createDefaultAttackingPlayDocument(),
      phases: [
        normalizePhaseSlice({
          ...createDefaultAttackingPlayDocument().phases[0]!,
          possessionChain: [3],
          passArrivalTimeSec: [],
          durationSec: 5,
        }),
        ...createDefaultAttackingPlayDocument().phases.slice(1),
      ],
    });
    const ph = doc.phases[0]!;
    expect(ballStateAtTime(ph, 0)).toEqual({ kind: 'with', slot: 3 });
    expect(ballStateAtTime(ph, 99)).toEqual({ kind: 'with', slot: 3 });
  });

  it('transitions through pass window', () => {
    const doc = phaseDoc([1, 2] as AttackingPlayerSlot[], 2);
    const ph = doc.phases[0]!;
    expect(ballStateAtTime(ph, 0)).toEqual({ kind: 'with', slot: 1 });
    const mid = ballStateAtTime(ph, 2 - 0.35 / 2);
    expect(mid.kind).toBe('pass');
    if (mid.kind === 'pass') {
      expect(mid.fromSlot).toBe(1);
      expect(mid.toSlot).toBe(2);
      expect(mid.arrivalSec).toBe(2);
      expect(mid.passStartSec).toBeCloseTo(2 - 0.35);
      expect(mid.u).toBeGreaterThan(0);
      expect(mid.u).toBeLessThan(1);
    }
    expect(ballStateAtTime(ph, 3)).toEqual({ kind: 'with', slot: 2 });
  });
});

describe('passSegmentEndpoints', () => {
  it('uses pass start for passer and arrival for receiver', () => {
    const doc = phaseDoc([1, 2] as AttackingPlayerSlot[], 2);
    const ph = doc.phases[0]!;
    const m = new Map(ph.players.map((p) => [p.slot, p] as const));
    const ends = passSegmentEndpoints(ph, 0, m);
    expect(ends).not.toBeNull();
    const passStart = 2 - 0.35;
    const p1 = ph.players.find((p) => p.slot === 1)!;
    const p2 = ph.players.find((p) => p.slot === 2)!;
    expect(ends!.from).toEqual(playerPositionAtTime(p1, passStart));
    expect(ends!.to).toEqual(playerPositionAtTime(p2, 2));
  });
});

describe('ballPositionAtTime', () => {
  it('lerps along fixed throw-to-catch segment during pass', () => {
    const doc = phaseDoc([1, 2] as AttackingPlayerSlot[], 2);
    const ph = doc.phases[0]!;
    const m = new Map(ph.players.map((p) => [p.slot, p] as const));
    const ends = passSegmentEndpoints(ph, 0, m)!;
    const midT = 2 - 0.35 / 2;
    const pos = ballPositionAtTime(ph, midT, m);
    const u = 0.5;
    expect(pos.x).toBeCloseTo(ends.from.x + (ends.to.x - ends.from.x) * u);
    expect(pos.y).toBeCloseTo(ends.from.y + (ends.to.y - ends.from.y) * u);
  });
});

describe('globalTimeToPhaseLocal', () => {
  it('maps cumulative time across phases', () => {
    const doc = createDefaultAttackingPlayDocument();
    const total = totalPlayDurationSec(doc);
    expect(total).toBeGreaterThan(0);
    const at0 = globalTimeToPhaseLocal(doc, 0);
    expect(at0.phaseIndex).toBe(0);
    expect(at0.tLocal).toBe(0);
    const d0 = doc.phases[0]!.durationSec;
    const atMid = globalTimeToPhaseLocal(doc, d0 + 0.5);
    expect(atMid.phaseIndex).toBe(1);
    expect(atMid.tLocal).toBeCloseTo(0.5);
  });
});
