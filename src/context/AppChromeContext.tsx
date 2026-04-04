import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type TeamHeaderState = {
  /** Shown in default header or drill row (omit when using minimalBackOnly). */
  title?: string;
  /** Shown under title when not using drill layout (e.g. live match). */
  subtitle?: string;
  /**
   * When set, header shows a single compact row: back + title (e.g. team hub).
   * Omit for stacked title + subtitle under the app name (e.g. match live).
   */
  backTo?: string;
  /** Accessible name for the back control (drill arrow or minimal link). */
  backAriaLabel?: string;
  /**
   * Match (and similar) screens: only a back link — no app title, tag, or team line.
   * Saves vertical space; requires `backTo`.
   */
  minimalBackOnly?: boolean;
  /**
   * `/club/:id/competitions`: team name under app title + edit control in header.
   * Mutually exclusive with using `title`/`subtitle` for the default header stack.
   */
  clubCompetitionsBar?: {
    teamName: string;
    onEditTeam: () => void;
  };
};

type AppChromeContextValue = {
  teamHeader: TeamHeaderState | null;
  setTeamHeader: (next: TeamHeaderState | null) => void;
};

const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [teamHeader, setTeamHeaderState] = useState<TeamHeaderState | null>(null);
  const setTeamHeader = useCallback((next: TeamHeaderState | null) => {
    setTeamHeaderState(next);
  }, []);
  const value = useMemo(() => ({ teamHeader, setTeamHeader }), [teamHeader, setTeamHeader]);
  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}

export function useAppChrome(): AppChromeContextValue {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error('useAppChrome must be used within AppChromeProvider');
  }
  return ctx;
}
