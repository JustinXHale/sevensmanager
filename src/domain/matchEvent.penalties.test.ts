import { describe, expect, it } from 'vitest';
import { penaltyTypesForPicker } from '@/domain/matchEvent';

describe('penaltyTypesForPicker', () => {
  it('returns attack conceded infractions without Other', () => {
    const types = penaltyTypesForPicker('attack', 'conceded');
    expect(types.map((t) => t.id)).toContain('offside');
    expect(types.map((t) => t.id)).not.toContain('other');
  });

  it('differs attack awarded from attack conceded', () => {
    const conceded = penaltyTypesForPicker('attack', 'conceded').map((t) => t.id);
    const awarded = penaltyTypesForPicker('attack', 'awarded').map((t) => t.id);
    expect(awarded).toContain('high_tackle');
    expect(conceded).not.toContain('high_tackle');
  });

  it('returns defense-specific lists', () => {
    const defConceded = penaltyTypesForPicker('defense', 'conceded').map((t) => t.id);
    const defAwarded = penaltyTypesForPicker('defense', 'awarded').map((t) => t.id);
    expect(defConceded).toContain('neck_roll');
    expect(defAwarded).toContain('lineout_offence');
  });
});
