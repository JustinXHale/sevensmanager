/**
 * One row from a pasted CSV schedule (first line = headers).
 */
export interface ScheduleImportRow {
  title?: string;
  ourTeamName?: string;
  opponentName?: string;
  kickoffDate?: string;
  location?: string;
  competition?: string;
}

export interface ScheduleParseResult {
  rows: ScheduleImportRow[];
  errors: string[];
}

function normalizeRow(raw: Record<string, unknown>, index: number): ScheduleImportRow | string {
  const title = pickStr(raw, ['title', 'Title', 'name', 'Name']);
  const ourTeamName = pickStr(raw, ['ourTeamName', 'our_team', 'ourTeam', 'us', 'home', 'Home']);
  const opponentName = pickStr(raw, ['opponentName', 'opponent', 'Opponent', 'them', 'away', 'Away']);
  const competition = pickStr(raw, ['competition', 'Competition', 'tournament', 'Tournament']);
  const location = pickStr(raw, ['location', 'Location', 'venue', 'Venue', 'ground', 'Ground', 'field', 'Field', 'pitch', 'Pitch', 'site', 'Site']);
  let kickoffDate = pickStr(raw, ['kickoffDate', 'kickoff', 'Kickoff', 'start', 'Start', 'datetime']);

  if (kickoffDate) {
    const t = Date.parse(kickoffDate);
    if (Number.isNaN(t)) {
      return `Row ${index + 1}: invalid kickoffDate "${kickoffDate}"`;
    }
    kickoffDate = new Date(t).toISOString();
  }

  if (!title?.trim() && !ourTeamName?.trim() && !opponentName?.trim()) {
    return `Row ${index + 1}: need at least title, ourTeamName, or opponentName`;
  }

  return {
    title: title?.trim() || undefined,
    ourTeamName: ourTeamName?.trim() || undefined,
    opponentName: opponentName?.trim() || undefined,
    kickoffDate: kickoffDate || undefined,
    location: location?.trim() || undefined,
    competition: competition?.trim() || undefined,
  };
}

function pickStr(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return undefined;
}

/** First row = headers; comma-separated; use quotes for fields that contain commas. */
export function parseScheduleCsv(text: string): ScheduleParseResult {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    errors.push('CSV: need a header row and at least one data row.');
    return { rows: [], errors };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const idx = (name: string, ...alts: string[]) => {
    const all = [name, ...alts].map((s) => s.toLowerCase().replace(/\s+/g, ''));
    for (const a of all) {
      const j = header.indexOf(a);
      if (j >= 0) return j;
    }
    return -1;
  };

  const iTitle = idx('title', 'name', 'fixture');
  const iOur = idx('ourteamname', 'ourteam', 'us', 'home', 'hometeam');
  const iOpp = idx('opponentname', 'opponent', 'them', 'away', 'awayteam');
  const iKick = idx('kickoffdate', 'kickoff', 'start', 'datetime');
  const iLoc = idx('location', 'venue', 'ground', 'field', 'pitch', 'site');
  const iComp = idx('competition', 'tournament', 'pool');

  if (iOur < 0 && iOpp < 0 && iTitle < 0) {
    errors.push(
      'CSV headers must include at least one of: title, ourTeamName (or ourTeam/home), opponentName (or opponent/away).',
    );
    return { rows: [], errors };
  }

  const rows: ScheduleImportRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const raw: Record<string, unknown> = {};
    if (iTitle >= 0) raw.title = cells[iTitle];
    if (iOur >= 0) raw.ourTeamName = cells[iOur];
    if (iOpp >= 0) raw.opponentName = cells[iOpp];
    if (iKick >= 0) raw.kickoffDate = cells[iKick];
    if (iLoc >= 0) raw.location = cells[iLoc];
    if (iComp >= 0) raw.competition = cells[iComp];

    const out = normalizeRow(raw, r - 1);
    if (typeof out === 'string') {
      errors.push(out);
    } else {
      rows.push(out);
    }
  }

  return { rows, errors };
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ',') {
      result.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

export const SCHEDULE_CSV_EXAMPLE = `title,ourTeamName,opponentName,kickoffDate,location,competition
Pool A — Game 1,Hellraisers,Valley RFC,2026-07-12T10:00:00.000Z,Main pitch,Summer 7s
,Hellraisers,City Sevens,2026-07-12T11:00:00.000Z,Field 2,Summer 7s
`;
