import { createCompetition } from './competitionsRepo';
import { createMatch } from './matchesRepo';
import { createTeam } from './teamsRepo';

/**
 * Creates a starter **Generic** competition, **Team A** (default sevens roster),
 * and a default match vs **Opponents** for onboarding / quick create.
 */
export async function scaffoldQuickStartForClub(clubId: string): Promise<{ competitionId: string }> {
  const comp = await createCompetition({ name: 'Generic', clubId });
  const team = await createTeam(comp.id, 'Team A');
  await createMatch({
    opponentName: 'Opponents',
    competitionId: comp.id,
    teamId: team.id,
  });
  return { competitionId: comp.id };
}
