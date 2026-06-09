import { describe, expect, it } from 'vitest';
import type { PlayerRecord } from '@/domain/player';
import {
  insertIdInOrder,
  moveIdInOrder,
  orderPlayersInStatus,
  reconcileAllRosterOrders,
  reconcileOnFieldOrder,
} from '@/domain/rosterDisplay';

function player(id: string, number: number, status: PlayerRecord['status']): PlayerRecord {
  return {
    id,
    matchId: 'm1',
    name: '',
    number,
    status,
    createdAt: 1,
  };
}

describe('roster display order', () => {
  const squad = [
    player('a', 1, 'on'),
    player('b', 2, 'on'),
    player('c', 8, 'bench'),
    player('d', 3, 'on'),
  ];

  it('orderPlayersInStatus respects custom on-field order', () => {
    const ordered = orderPlayersInStatus(squad, 'on', ['d', 'b', 'a'], 7);
    expect(ordered.map((p) => p.number)).toEqual([3, 2, 1]);
  });

  it('reconcileOnFieldOrder keeps custom sequence and appends newcomers', () => {
    const reconciled = reconcileOnFieldOrder(['d', 'b'], squad);
    expect(reconciled).toEqual(['d', 'b', 'a']);
  });

  it('moveIdInOrder swaps neighbors', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(moveIdInOrder(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
    expect(moveIdInOrder(['a', 'b'], 'a', 'up')).toBeNull();
  });

  it('insertIdInOrder places before target or appends', () => {
    expect(insertIdInOrder(['a', 'b', 'c'], 'x', 'b')).toEqual(['a', 'x', 'b', 'c']);
    expect(insertIdInOrder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(insertIdInOrder(['a', 'b'], 'c', null)).toEqual(['a', 'b', 'c']);
  });

  it('reconcileAllRosterOrders fills every status group', () => {
    const orders = reconcileAllRosterOrders(squad, { on: ['d', 'b'] });
    expect(orders.on).toEqual(['d', 'b', 'a']);
    expect(orders.bench).toEqual(['c']);
    expect(orders.off).toEqual([]);
  });

  it('keeps all on-field players when more than seven', () => {
    const manyOn = [
      player('p1', 1, 'on'),
      player('p2', 2, 'on'),
      player('p3', 3, 'on'),
      player('p4', 4, 'on'),
      player('p5', 5, 'on'),
      player('p6', 6, 'on'),
      player('p7', 7, 'on'),
      player('p8', 8, 'on'),
    ];
    const ordered = orderPlayersInStatus(manyOn, 'on', null);
    expect(ordered).toHaveLength(8);
    expect(reconcileOnFieldOrder(null, manyOn)).toHaveLength(8);
  });
});
