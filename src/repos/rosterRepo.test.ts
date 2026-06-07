import { describe, expect, it } from 'vitest';
import { ON_FIELD_MAX, SQUAD_MAX } from '@/domain/player';
import { initialStatusForTeamMember } from './rosterRepo';

describe('initialStatusForTeamMember', () => {
  it('puts jerseys 1–7 on field then 8–13 on bench', () => {
    const counters = { on: 0, bench: 0 };
    const statuses: string[] = [];
    for (let n = 1; n <= SQUAD_MAX; n++) {
      statuses.push(initialStatusForTeamMember({ number: n }, counters));
    }
    expect(statuses.slice(0, ON_FIELD_MAX).every((s) => s === 'on')).toBe(true);
    expect(statuses.slice(ON_FIELD_MAX).every((s) => s === 'bench')).toBe(true);
    expect(counters.on).toBe(ON_FIELD_MAX);
    expect(counters.bench).toBe(SQUAD_MAX - ON_FIELD_MAX);
  });

  it('fills on then bench for members without jersey numbers', () => {
    const counters = { on: 0, bench: 0 };
    for (let i = 0; i < ON_FIELD_MAX; i++) {
      expect(initialStatusForTeamMember({ number: null }, counters)).toBe('on');
    }
    expect(initialStatusForTeamMember({ number: null }, counters)).toBe('bench');
  });
});
