import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_LOGO_URL } from '@/config/appMeta';

const APP_VERSION = __APP_VERSION__;

const LINKS: { to: string; label: string }[] = [
  { to: '/', label: 'Clubs' },
  { to: '/matches/new', label: 'Add match' },
  { to: '/matches/import', label: 'Import schedule' },
];

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
            alt="Justin Hale with his family"
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

          <p className="about-copyright">&copy; {new Date().getFullYear()} Justin Hale</p>
        </div>
      </div>
    </dialog>
  );
}

export function AppNavDrawer() {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const location = useLocation();
  const panelId = useId();
  const dlgRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

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
              onClick={() => setOpen(false)}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <ul className="app-nav-drawer-list">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="app-nav-drawer-link" onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="app-nav-drawer-footer">
            <button
              type="button"
              className="app-nav-drawer-link app-nav-about-btn"
              onClick={() => { setOpen(false); setAboutOpen(true); }}
            >
              <svg className="app-nav-about-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width={18} height={18}>
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
              </svg>
              About
            </button>
          </div>
        </nav>
      </dialog>
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
