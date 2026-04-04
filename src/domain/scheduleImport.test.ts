import { describe, expect, it } from 'vitest';
import { parseScheduleCsv } from './scheduleImport';

describe('parseScheduleCsv', () => {
  it('parses header and rows', () => {
    const { rows, errors } = parseScheduleCsv(
      `ourTeamName,opponentName,kickoffDate\nHuns,Eagles,2026-06-01T14:00:00.000Z\n`,
    );
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].ourTeamName).toBe('Huns');
    expect(rows[0].opponentName).toBe('Eagles');
  });

  it('reports missing columns', () => {
    const { rows, errors } = parseScheduleCsv(`foo,bar\n1,2\n`);
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => e.includes('headers'))).toBe(true);
  });

  it('reads location column', () => {
    const { rows, errors } = parseScheduleCsv(
      `ourTeamName,opponentName,location\nA,B,Main pitch\n`,
    );
    expect(errors).toHaveLength(0);
    expect(rows[0]?.location).toBe('Main pitch');
  });
});
