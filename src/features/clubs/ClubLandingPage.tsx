import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClubRecord } from '@/domain/club';
import { listClubs } from '@/repos/clubsRepo';
import { ClubTeamFormModal } from './ClubTeamFormModal';

export function ClubLandingPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setClubs(await listClubs());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setClubs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (clubs === null) {
    return (
      <section className="card">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  const empty = clubs.length === 0;
  const single = clubs.length === 1;

  return (
    <div className="club-landing-page competitions-page">
      <div className={`club-landing-body competitions-page-body${empty ? ' club-landing-body--empty' : ''}`}>
        {error && !modalOpen ? <p className="error-text">{error}</p> : null}

        {empty ? (
          <div className="club-landing-empty">
            <button
              type="button"
              className="club-landing-fab"
              aria-label="Add your first team"
              onClick={() => setModalOpen(true)}
            >
              <span className="club-landing-fab-ring" aria-hidden>
                <span className="club-landing-fab-plus">+</span>
              </span>
            </button>
            <p className="muted club-landing-hint">Add a team to get started</p>
          </div>
        ) : single ? (
          <div className="club-landing-single">
            {clubs.map((c) => (
              <button
                key={c.id}
                type="button"
                className="club-landing-hero"
                onClick={() => navigate(`/club/${c.id}/competitions`)}
              >
                <span className="club-landing-hero-avatar">
                  {c.logoDataUrl ? (
                    <img src={c.logoDataUrl} alt="" className="club-landing-hero-logo" />
                  ) : (
                    <span className="club-landing-hero-fallback">{c.nickname}</span>
                  )}
                </span>
                <span className="club-landing-hero-caption">{c.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="club-landing-grid-outer">
            <ul
              className={`club-landing-grid club-landing-grid--count-${Math.min(clubs.length, 9)}`}
              role="list"
            >
              {clubs.map((c) => (
                <li key={c.id} className="club-landing-tile-wrap">
                  <button
                    type="button"
                    className="club-landing-tile"
                    onClick={() => navigate(`/club/${c.id}/competitions`)}
                  >
                    <span className="club-landing-tile-avatar">
                      {c.logoDataUrl ? (
                        <img src={c.logoDataUrl} alt="" className="club-landing-tile-logo" />
                      ) : (
                        <span className="club-landing-tile-fallback" title={c.nickname}>
                          {c.nickname}
                        </span>
                      )}
                    </span>
                    <div className="club-landing-tile-meta">
                      <span className="club-landing-tile-nick-label">{c.nickname}</span>
                      <span className="club-landing-tile-meta-sep">·</span>
                      <span className="club-landing-tile-abbr">{c.abbreviation}</span>
                    </div>
                    <span className="visually-hidden">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!empty ? (
        <div className="competitions-sticky-footer" role="toolbar" aria-label="Add team">
          <button type="button" className="btn btn-primary competitions-sticky-main" onClick={() => setModalOpen(true)}>
            Add another team
          </button>
        </div>
      ) : null}

      <ClubTeamFormModal
        open={modalOpen}
        variant="create"
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await load();
        }}
      />
    </div>
  );
}
