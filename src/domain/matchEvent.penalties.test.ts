import { describe, expect, it } from 'vitest';
import { penaltyTypesForPicker, penaltyTypesForSetPiecePicker } from '@/domain/matchEvent';

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

describe('penaltyTypesForSetPiecePicker', () => {
  it('restart P+ and P− use aerial / dangerous-play infractions (no offside)', () => {
    const awarded = penaltyTypesForSetPiecePicker('restart', 'attack', 'awarded').map((t) => t.id);
    const conceded = penaltyTypesForSetPiecePicker('restart', 'defense', 'conceded').map((t) => t.id);
    expect(awarded).toEqual(['playing_man_in_air', 'high_tackle', 'dangerous_play']);
    expect(conceded).toEqual(['playing_man_in_air', 'high_tackle', 'dangerous_play']);
    expect(awarded).not.toContain('offside');
  });

  it('scrum lists driving, offside, scrummage, and collapsing', () => {
    const awarded = penaltyTypesForSetPiecePicker('scrum', 'attack', 'awarded').map((t) => t.id);
    const conceded = penaltyTypesForSetPiecePicker('scrum', 'defense', 'conceded').map((t) => t.id);
    expect(awarded).toEqual(['driving_up', 'offside', 'scrummage', 'collapsing']);
    expect(conceded).toEqual(['driving_up', 'offside', 'scrummage', 'collapsing']);
  });

  it('lineout lists offside, man in air, and lineout offence', () => {
    const ids = penaltyTypesForSetPiecePicker('lineout', 'attack', 'awarded').map((t) => t.id);
    expect(ids).toEqual(['offside', 'playing_man_in_air', 'lineout_offence']);
  });

  it('ruck attack P+ lists defense breakdown infringements', () => {
    expect(penaltyTypesForSetPiecePicker('ruck', 'attack', 'awarded').map((t) => t.id)).toEqual([
      'not_rolling_away',
      'not_releasing',
      'offside',
      'hands_in_ruck',
      'dangerous_play',
      'side_entry',
    ]);
  });

  it('ruck attack P− lists our breakdown infringements', () => {
    expect(penaltyTypesForSetPiecePicker('ruck', 'attack', 'conceded').map((t) => t.id)).toEqual([
      'holding_on',
      'hands_in_ruck',
      'off_feet',
      'sealing_off',
      'offside',
      'side_entry',
    ]);
  });

  it('ruck defense P+ lists opponent possession infringements', () => {
    expect(penaltyTypesForSetPiecePicker('ruck', 'defense', 'awarded').map((t) => t.id)).toEqual([
      'holding_on',
      'hands_in_ruck',
      'off_feet',
      'sealing_off',
      'offside',
      'dangerous_play',
    ]);
  });

  it('ruck defense P− lists tackler/defender infringements', () => {
    expect(penaltyTypesForSetPiecePicker('ruck', 'defense', 'conceded').map((t) => t.id)).toEqual([
      'not_releasing',
      'not_rolling_away',
      'offside',
      'hands_in_ruck',
      'side_entry',
      'off_feet',
    ]);
  });

  it('ruck attack P+ and P− use phase-appropriate infractions', () => {
    const awarded = penaltyTypesForSetPiecePicker('ruck', 'attack', 'awarded').map((t) => t.id);
    const conceded = penaltyTypesForSetPiecePicker('ruck', 'attack', 'conceded').map((t) => t.id);
    expect(awarded).toContain('not_rolling_away');
    expect(awarded).not.toContain('holding_on');
    expect(conceded).toContain('holding_on');
    expect(conceded).not.toContain('not_rolling_away');
  });
});
