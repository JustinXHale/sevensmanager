import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppNavDrawer } from '@/components/AppNavDrawer';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAppChrome } from '@/context/AppChromeContext';
import { CompetitionDetailPage } from '@/features/admin/CompetitionDetailPage';
import { ClubLandingPage } from '@/features/clubs/ClubLandingPage';
import { CompetitionHomePage } from '@/features/admin/CompetitionHomePage';
import { TeamHubPage } from '@/features/admin/TeamHubPage';
import { MatchLivePage } from '@/features/match/MatchLivePage';
import { MatchRosterRedirect } from '@/features/match/MatchRosterRedirect';
import { NewMatchPage } from '@/features/match/NewMatchPage';
import { ScheduleImportPage } from '@/features/match/ScheduleImportPage';
import { APP_DISPLAY_NAME } from '@/config/appMeta';
import './App.css';

function AppHeader() {
  const { teamHeader } = useAppChrome();

  if (teamHeader?.minimalBackOnly && teamHeader.backTo) {
    return (
      <header className="app-header app-header--match-minimal">
        <Link
          to={teamHeader.backTo}
          className="app-header-back-link app-header-back-link--labeled"
          aria-label={teamHeader.backAriaLabel ?? 'Go back'}
        >
          ← Back
        </Link>
        <AppNavDrawer />
      </header>
    );
  }

  if (teamHeader?.backTo) {
    return (
      <header className="app-header app-header--drill">
        <div className="app-header-drill">
          <Link
            to={teamHeader.backTo}
            className="app-header-back-link"
            aria-label={teamHeader.backAriaLabel ?? 'Go back'}
          >
            ←
          </Link>
          <span className="app-header-drill-title" title={teamHeader.title ?? ''}>
            {teamHeader.title ?? ''}
          </span>
        </div>
        <AppNavDrawer />
      </header>
    );
  }

  const clubBar = teamHeader?.clubCompetitionsBar;

  return (
    <header className="app-header app-header--main">
      <div className="app-header-menu-anchor">
        <AppNavDrawer />
      </div>
      <div className="app-header-title-wrap">
        <div className="app-header-title-block">
          <Link to="/" className="app-title">
            {APP_DISPLAY_NAME}
          </Link>
          {clubBar ? (
            <div className="app-header-club-name" title={clubBar.teamName}>
              {clubBar.teamName}
            </div>
          ) : teamHeader && (teamHeader.title || teamHeader.subtitle) ? (
            <div className="app-header-team" aria-label="Current club">
              <span className="app-header-team-name">{teamHeader.title ?? ''}</span>
              {teamHeader.subtitle ? (
                <span className="app-header-team-sub">{teamHeader.subtitle}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {clubBar ? (
        <div className="app-header-trailing-anchor">
          <button
            type="button"
            className="app-header-icon-btn"
            onClick={() => clubBar.onEditTeam()}
            aria-label="Edit club"
          >
            <svg className="app-header-pencil-icon" viewBox="0 0 24 24" width={20} height={20} aria-hidden>
              <path
                fill="currentColor"
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <InstallPrompt />
      <UpdatePrompt />
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ClubLandingPage />} />
            <Route path="/club/:clubId/competitions" element={<CompetitionHomePage />} />
            <Route path="/matches" element={<Navigate to="/" replace />} />
            <Route path="/matches/new" element={<NewMatchPage />} />
            <Route path="/matches/import" element={<ScheduleImportPage />} />
            <Route path="/competition/:competitionId" element={<CompetitionDetailPage />} />
            <Route path="/team/:teamId" element={<TeamHubPage />} />
            <Route path="/match/:matchId/roster" element={<MatchRosterRedirect />} />
            <Route path="/match/:matchId" element={<MatchLivePage />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
