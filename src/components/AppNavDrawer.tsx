import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { APP_LOGO_URL } from '@/config/appMeta';

const LINKS: { to: string; label: string }[] = [
  { to: '/', label: 'Clubs' },
  { to: '/matches/new', label: 'Add game' },
  { to: '/matches/import', label: 'Import schedule' },
];

export function AppNavDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const panelId = useId();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const overlay =
    open &&
    createPortal(
      <>
        <button
          type="button"
          className="app-nav-drawer-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
        <nav id={panelId} className="app-nav-drawer app-nav-drawer-open" aria-hidden={false}>
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
        </nav>
      </>,
      document.body,
    );

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
      {overlay}
    </>
  );
}
