import { describe, expect, it } from 'vitest';
import { formatTeamMemberLabel } from '@/domain/teamMember';

describe('formatTeamMemberLabel', () => {
  it('shows number and name', () => {
    expect(formatTeamMemberLabel({ name: 'Alex', number: 4 })).toBe('#4 Alex');
  });

  it('shows only number when name empty', () => {
    expect(formatTeamMemberLabel({ name: '', number: 4 })).toBe('#4');
  });
});
