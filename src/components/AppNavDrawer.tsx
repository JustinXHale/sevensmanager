import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_LOGO_URL } from '@/config/appMeta';

const APP_VERSION = __APP_VERSION__;

const LAST_MATCH_KEY = 'sevensManager.recentMatch';

type RecentMatch = { id: string; label: string };

function readRecentMatch(): RecentMatch | null {
  try {
    const raw = localStorage.getItem(LAST_MATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.label === 'string') return parsed;
  } catch { /* ignore */ }
  return null;
}

export function writeRecentMatch(id: string, label: string) {
  try {
    localStorage.setItem(LAST_MATCH_KEY, JSON.stringify({ id, label }));
  } catch { /* quota / private mode */ }
}

export function clearRecentMatchIfStale(matchId: string) {
  try {
    const cur = readRecentMatch();
    if (cur && cur.id === matchId) localStorage.removeItem(LAST_MATCH_KEY);
  } catch { /* ignore */ }
}

const REFLOG_URL = 'https://justinxhale.github.io/reflog-site/';

function OtherProjectsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dlgRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dlgRef}
      className="bottom-sheet-dialog"
      aria-label="Other projects"
      onCancel={() => onClose()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <div className="bottom-sheet-header">
          <h3 className="bottom-sheet-title">Other projects</h3>
          <button type="button" className="bottom-sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="other-projects-body">
          <div className="other-project-card">
            <h4 className="other-project-name">RefLog</h4>
            <p className="other-project-desc">
              The modern referee&apos;s match companion. Log matches, review performance,
              and improve your refereeing — all from your phone.
            </p>
            <a href={REFLOG_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary other-project-link">
              Visit RefLog
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={14} height={14}>
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.25-.182a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22h-2.19a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
          <div className="other-project-card other-project-card--soon">
            <h4 className="other-project-name">Referee IQ</h4>
            <p className="other-project-desc">
              Training and development tools for rugby referees.
            </p>
            <span className="other-project-badge">Coming soon</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dlgRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dlgRef}
      className="bottom-sheet-dialog"
      aria-label="About SevensManager"
      onCancel={() => onClose()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bottom-sheet bottom-sheet--tall">
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <div className="bottom-sheet-header">
          <h3 className="bottom-sheet-title">About</h3>
          <button type="button" className="bottom-sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="about-sheet-body">
          <div className="about-hero">
            <img src={APP_LOGO_URL} alt="" className="about-logo" width={64} height={64} />
            <div>
              <h4 className="about-app-name">SevensManager</h4>
              <p className="about-version">Version {APP_VERSION}</p>
            </div>
          </div>
          <p className="about-description">
            I built SevensManager for myself first: I&apos;m back in coaching rugby sevens and
            volunteered to help with data analytics when we have match video. The catch is you
            don&apos;t always get video at tournaments — so I wanted a way to capture useful
            analytics live, from the sideline, without slowing down to watch the game through a
            spreadsheet. Quick, efficient, and honest enough to review after the final whistle.
          </p>

          <hr className="about-divider" />

          <h4 className="about-section-title">A bit about me</h4>
          <img
            src={`${import.meta.env.BASE_URL}family.png`}
            alt="Justin X. Hale with his family"
            className="about-photo"
          />
          <p className="about-text">
            My rugby path started as a player, then I spent years as a referee — including
            assignments in MLR (as an AR), international 7s, and USA Rugby championships. That side of the
            game taught me how fast sevens moves and how much detail you can miss if your tools
            get in the way. Off the field I&apos;m a product designer at Red Hat.
          </p>
          <p className="about-text">
            I&apos;m sharing this as open source because if it helps my sideline, it might help
            someone else&apos;s too. Use it, fork it, and send ideas, the more voices, the better
            the product gets.
          </p>
          <p className="about-text">
            None of it works without my family. My wife Darleny and our daughter Sofia keep me
            grounded, theyre the reason I care about doing things right, on the field and in
            the code.
          </p>

          <hr className="about-divider" />

          <h4 className="about-section-title">Other projects</h4>
          <div className="about-other-projects">
            <div className="about-other-project">
              <strong>RefLog</strong> — The modern referee&apos;s match companion.{' '}
              <a href={REFLOG_URL} target="_blank" rel="noopener noreferrer">Visit RefLog</a>
            </div>
            <div className="about-other-project">
              <strong>Referee IQ</strong> — Training and development tools for rugby referees.{' '}
              <span className="muted">Coming soon</span>
            </div>
          </div>

          <hr className="about-divider" />

          <p className="about-copyright">&copy; {new Date().getFullYear()} Justin X. Hale</p>
        </div>
      </div>
    </dialog>
  );
}

/* SVG icon helpers (20×20 viewBox, fill=currentColor) */
const IconHome = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
  </svg>
);
const IconMatch = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
  </svg>
);
const IconBook = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path d="M10.75 16.82A7.462 7.462 0 0 1 15 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0 0 18 15.06V4.94a.75.75 0 0 0-.546-.722A9.006 9.006 0 0 0 15 3.8c-1.857 0-3.553.586-4.959 1.56a.25.25 0 0 0-.082.283v11.177ZM9.25 16.82V5.643a.25.25 0 0 0-.082-.283A7.956 7.956 0 0 0 5 3.8a9.006 9.006 0 0 0-2.454.418A.75.75 0 0 0 2 4.94v10.12a.75.75 0 0 0 .954.722A7.462 7.462 0 0 1 5 15.5c1.579 0 3.042.5 4.25 1.32Z" />
  </svg>
);
const IconGear = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
  </svg>
);
const IconGrid = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.5A2.25 2.25 0 0 0 4.25 9h2.5A2.25 2.25 0 0 0 9 6.75v-2.5A2.25 2.25 0 0 0 6.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 2 13.25v2.5A2.25 2.25 0 0 0 4.25 18h2.5A2.25 2.25 0 0 0 9 15.75v-2.5A2.25 2.25 0 0 0 6.75 11h-2.5ZM11 4.25A2.25 2.25 0 0 1 13.25 2h2.5A2.25 2.25 0 0 1 18 4.25v2.5A2.25 2.25 0 0 1 15.75 9h-2.5A2.25 2.25 0 0 1 11 6.75v-2.5ZM13.25 11A2.25 2.25 0 0 0 11 13.25v2.5A2.25 2.25 0 0 0 13.25 18h2.5A2.25 2.25 0 0 0 18 15.75v-2.5A2.25 2.25 0 0 0 15.75 11h-2.5Z" clipRule="evenodd" />
  </svg>
);
const IconInfo = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
  </svg>
);

export function AppNavDrawer() {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const location = useLocation();
  const panelId = useId();
  const dlgRef = useRef<HTMLDialogElement>(null);

  const recentMatch = readRecentMatch();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <div className={`app-nav-drawer-wrap${open ? ' app-nav-drawer-wrap-open' : ''}`}>
        <button
          type="button"
          className="app-nav-hamburger"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="app-nav-hamburger-bar" aria-hidden />
          <span className="app-nav-hamburger-bar" aria-hidden />
          <span className="app-nav-hamburger-bar" aria-hidden />
        </button>
      </div>
      <dialog
        ref={dlgRef}
        className="app-nav-drawer-dialog"
        aria-label="Navigation"
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <nav id={panelId} className={`app-nav-drawer${open ? ' app-nav-drawer-open' : ''}`} aria-hidden={false}>
          <div className="app-nav-drawer-head">
            <div className="app-nav-drawer-brand">
              <img src={APP_LOGO_URL} alt="" className="app-nav-drawer-logo" width={144} height={144} />
            </div>
            <button
              type="button"
              className="app-nav-drawer-close"
              aria-label="Close menu"
              onClick={close}
            >
              <span aria-hidden>×</span>
            </button>
          </div>

          {/* Primary navigation */}
          <ul className="app-nav-drawer-list">
            <li>
              <Link to="/" className="app-nav-drawer-link" onClick={close}>
                <IconHome /> Clubs
              </Link>
            </li>
            {recentMatch && (
              <li>
                <Link to={`/match/${recentMatch.id}`} className="app-nav-drawer-link" onClick={close}>
                  <IconMatch />
                  <span className="app-nav-link-stack">
                    <span>Recent match</span>
                    <span className="app-nav-link-sub">{recentMatch.label}</span>
                  </span>
                </Link>
              </li>
            )}
          </ul>

          <hr className="app-nav-drawer-divider" />

          {/* Utility */}
          <ul className="app-nav-drawer-list">
            <li>
              <Link to="/glossary" className="app-nav-drawer-link" onClick={close}>
                <IconBook /> Glossary
              </Link>
            </li>
            <li>
              <span className="app-nav-drawer-link app-nav-drawer-link--disabled" aria-disabled="true">
                <IconGear /> Settings
                <span className="app-nav-coming-soon">Coming soon</span>
              </span>
            </li>
            <li>
              <span className="app-nav-drawer-link app-nav-drawer-link--disabled" aria-disabled="true">
                <IconUser /> Profile
                <span className="app-nav-coming-soon">Coming soon</span>
              </span>
            </li>
            <li>
              <button type="button" className="app-nav-drawer-link app-nav-drawer-btn" onClick={() => { close(); setProjectsOpen(true); }}>
                <IconGrid /> Other projects
              </button>
            </li>
            <li>
              <button type="button" className="app-nav-drawer-link app-nav-drawer-btn" onClick={() => { close(); setAboutOpen(true); }}>
                <IconInfo /> About
              </button>
            </li>
          </ul>
        </nav>
      </dialog>
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <OtherProjectsSheet open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </>
  );
}
