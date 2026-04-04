import { safeReturnPath } from '@/utils/safeReturnPath';

/**
 * `location.state` when opening `/match/:id` so “Back” can return to that screen
 * (e.g. team games tab). Default is competitions home `/`.
 */
export type MatchLiveLocationState = {
  matchesReturnTo?: string;
};

export function resolveMatchesReturnTo(state: unknown): string {
  if (!state || typeof state !== 'object') return '/';
  const raw = (state as MatchLiveLocationState).matchesReturnTo;
  if (typeof raw !== 'string' || !raw.trim()) return '/';
  return safeReturnPath(raw.trim()) ?? '/';
}

/**
 * Where “Back” from `/match/:id` should go: navigation state → `?returnTo=` → team admin hub → home.
 * State is often missing after refresh or opening in a new tab; query + `teamId` cover that.
 */
export function resolveMatchBackTarget(
  state: unknown,
  returnToSearchParam: string | null,
  teamId: string | undefined,
): string {
  const fromState = resolveMatchesReturnTo(state);
  if (fromState !== '/') return fromState;
  const fromQuery = safeReturnPath(returnToSearchParam);
  if (fromQuery) return fromQuery;
  if (teamId) return `/team/${teamId}?tab=admin&section=roster`;
  return '/';
}
