import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Old `/match/:id/roster` URLs → same match with Roster tab selected. */
export function MatchRosterRedirect() {
  const { matchId } = useParams<{ matchId: string }>();
  const location = useLocation();
  if (!matchId) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/match/${matchId}?tab=roster`} replace state={location.state} />;
}
