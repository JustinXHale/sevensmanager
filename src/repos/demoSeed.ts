import { localDayDateString } from '@/domain/daySchedule';
import { seedMatchWithData, seedSyntheticMinutes } from '@/utils/seedMatchData';
import { createCompetition } from './competitionsRepo';
import { addDayScheduleItem } from './dayScheduleRepo';
import { createMatch } from './matchesRepo';
import { listPlayers } from './rosterRepo';
import { createTeam } from './teamsRepo';
import { listTeamMembers, updateTeamMember } from './teamMembersRepo';
import { addWeighIn } from './weighInsRepo';
import { seedPoolGameOneFullTimeline } from './demoSeedPoolGameOne';
import { db } from './db';

/** Shown in the competitions list; idempotent \u2014 second run is a no-op. */
export const DEMO_COMPETITION_NAME = 'Demo: Coastal 7s 2026';

const TEAM_A = 'Northside Huns';
const TEAM_B = 'South Bay RFC';

/** Jersey labels for a full squad (1\u201313). */
const DEMO_SQUAD_NAMES = [
  'Mason H.',
  'Jordan P.',
  'Sam V.',
  'Alex T.',
  'Te R.',
  'Kris M.',
  'Charlie N.',
  'Liam S.',
  'Noah F.',
  'Ben K.',
  'Josh W.',
  'Tom A.',
  'Dan L.',
];

export type DemoSeedResult =
  | { ok: true; message: string; competitionId: string }
  | { ok: false; message: string };

/**
 * Rich event timelines on all four matches, day schedule, weigh-ins, named jerseys.
 * Safe to call once; skips if the demo competition name already exists.
 */
export async function seedDemoCoastalPack(clubId: string): Promise<DemoSeedResult> {
  const comps = await db.competitions.toArray();
  if (comps.some((c) => c.name === DEMO_COMPETITION_NAME)) {
    return {
      ok: false,
      message: `"${DEMO_COMPETITION_NAME}" is already in your list. Delete it first if you want a fresh sample.`,
    };
  }

  const comp = await createCompetition(DEMO_COMPETITION_NAME, clubId);
  const north = await createTeam(comp.id, TEAM_A);
  const south = await createTeam(comp.id, TEAM_B);

  const northMembers = await listTeamMembers(north.id);
  for (const m of northMembers) {
    const idx = (m.number ?? 1) - 1;
    const nm = DEMO_SQUAD_NAMES[idx] ?? '';
    if (nm) {
      await updateTeamMember(m.id, { name: nm });
    }
  }

  const southMembers = await listTeamMembers(south.id);
  for (let i = 0; i < Math.min(7, southMembers.length); i++) {
    const m = southMembers[i]!;
    await updateTeamMember(m.id, { name: `Guest ${i + 1}` });
  }

  const m1 = await createMatch({
    title: 'Pool A \u2014 Game 1',
    ourTeamName: TEAM_A,
    opponentName: 'East End Magpies',
    opponentAbbreviation: 'EEM',
    kickoffDate: new Date('2026-06-14T10:00:00').toISOString(),
    location: 'Harbour Stadium \u00b7 Field 1',
    competition: DEMO_COMPETITION_NAME,
    competitionId: comp.id,
    teamId: north.id,
  });

  const m2 = await createMatch({
    title: 'Pool A \u2014 Game 2',
    ourTeamName: TEAM_A,
    opponentName: 'West Hill RFC',
    opponentAbbreviation: 'WHR',
    kickoffDate: new Date('2026-06-14T15:30:00').toISOString(),
    location: 'Harbour Stadium \u00b7 Field 2',
    competition: DEMO_COMPETITION_NAME,
    competitionId: comp.id,
    teamId: north.id,
  });

  const m3 = await createMatch({
    title: 'Cup semi-final',
    ourTeamName: TEAM_A,
    opponentName: 'Coastal Select',
    opponentAbbreviation: 'CSL',
    kickoffDate: new Date('2026-06-15T09:15:00').toISOString(),
    location: 'Harbour Stadium \u00b7 Field 1',
    competition: DEMO_COMPETITION_NAME,
    competitionId: comp.id,
    teamId: north.id,
  });

  const m4 = await createMatch({
    title: 'South Bay \u00b7 Pool match',
    ourTeamName: TEAM_B,
    opponentName: 'Harbor United',
    opponentAbbreviation: 'HBU',
    kickoffDate: new Date('2026-06-14T12:45:00').toISOString(),
    location: 'Training Ground B',
    competition: DEMO_COMPETITION_NAME,
    competitionId: comp.id,
    teamId: south.id,
  });

  // Game 1: curated timeline with full analytics fields
  const playersM1 = await listPlayers(m1.id, false);
  await seedPoolGameOneFullTimeline(m1.id, playersM1);
  await seedSyntheticMinutes(m1.id, playersM1);

  // Games 2\u20134: randomized full-depth event data (different profiles)
  await seedMatchWithData(m2.id, 'tight');
  await seedMatchWithData(m3.id, 'blowout');
  await seedMatchWithData(m4.id, 'open');

  const day1 = '2026-06-13';
  const day2 = '2026-06-14';
  await addDayScheduleItem({
    teamId: north.id,
    dayDate: day1,
    startMinutes: 18 * 60,
    endMinutes: 18 * 60 + 45,
    label: 'Team meeting \u00b7 team room',
    kind: 'other',
  });
  await addDayScheduleItem({
    teamId: north.id,
    dayDate: day1,
    startMinutes: 19 * 60 + 30,
    label: 'Carb-heavy meal',
    kind: 'meal',
  });
  await addDayScheduleItem({
    teamId: north.id,
    dayDate: day2,
    startMinutes: 7 * 60,
    endMinutes: 7 * 60 + 45,
    label: 'Breakfast \u00b7 hotel',
    kind: 'meal',
  });
  await addDayScheduleItem({
    teamId: north.id,
    dayDate: day2,
    startMinutes: 9 * 60,
    endMinutes: 9 * 60 + 45,
    label: 'Warm-up \u00b7 Field 1 side',
    kind: 'warmup',
  });
  await addDayScheduleItem({
    teamId: north.id,
    dayDate: day2,
    startMinutes: 10 * 60 + 15,
    label: 'Pool A \u2014 vs East End (demo match)',
    kind: 'match',
  });

  const sortedNorth = (await listTeamMembers(north.id)).sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const mem1 = sortedNorth[0];
  const mem2 = sortedNorth[1];
  const t0 = new Date('2026-06-14T08:00:00').getTime();
  if (mem1) {
    await addWeighIn({
      teamMemberId: mem1.id,
      matchId: m1.id,
      recordedAt: t0,
      weightKg: 79.4,
      phase: 'pre',
    });
    await addWeighIn({
      teamMemberId: mem1.id,
      matchId: m1.id,
      recordedAt: t0 + 3.5 * 60 * 60 * 1000,
      weightKg: 78.55,
      phase: 'post',
    });
  }
  if (mem2) {
    await addWeighIn({
      teamMemberId: mem2.id,
      matchId: m1.id,
      recordedAt: t0 + 15 * 60 * 1000,
      weightKg: 74.2,
      phase: 'pre',
    });
    await addWeighIn({
      teamMemberId: mem2.id,
      matchId: m1.id,
      recordedAt: t0 + 3.5 * 60 * 60 * 1000,
      weightKg: 73.6,
      phase: 'post',
    });
  }

  const today = localDayDateString();
  await addDayScheduleItem({
    teamId: north.id,
    dayDate: today,
    startMinutes: 12 * 60,
    label: 'Extra block (today \u2014 scroll schedule to this date)',
    kind: 'other',
  });

  return {
    ok: true,
    competitionId: comp.id,
    message: `Added "${DEMO_COMPETITION_NAME}" with ${TEAM_A}, ${TEAM_B}, four matches with full analytics data, schedule, and weigh-ins.`,
  };
}
