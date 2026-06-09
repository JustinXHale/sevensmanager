import { useMemo, useState } from 'react';
import type { MatchSessionRecord } from '@/domain/match';
import { formatClock, formatFilmClockForSession } from '@/domain/matchClock';
import type { MatchEventKind, MatchEventRecord } from '@/domain/matchEvent';
import type { PlayerRecord } from '@/domain/player';
import { formatMatchEventSummary, timelineRowClassName } from '@/domain/matchEventDisplay';
import { kindLabel } from '@/domain/matchStats';
import { MatchEventEditDialog } from './MatchEventEditDialog';

type Props = {
  events: MatchEventRecord[];
  playersById: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  onDelete: (id: string) => void;
  onEditSaved: () => void;
};

/** Option order in the category dropdown. */
const TIMELINE_KIND_ORDER: MatchEventKind[] = [
  'film_star',
  'system_moment',
  'forced_turnover',
  'try',
  'conversion',
  'opponent_try',
  'opponent_conversion',
  'opponent_substitution',
  'opponent_card',
  'pass',
  'line_break',
  'negative_action',
  'ruck',
  'tackle',
  'scrum',
  'lineout',
  'restart',
  'team_penalty',
];

type FilterValue = 'all' | MatchEventKind;

export function MatchEventTimeline({
  events,
  playersById,
  filmSession = null,
  onDelete,
  onEditSaved,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<FilterValue>('all');

  const editingEvent = editingId ? events.find((e) => e.id === editingId) ?? null : null;

  const filteredEvents = useMemo(() => {
    if (filterKind === 'all') return events;
    return events.filter((e) => e.kind === filterKind);
  }, [events, filterKind]);

  const filterActive = filterKind !== 'all';

  return (
    <section className="card live-timeline-card">
      <h2 className="live-timeline-title">Event timeline</h2>
      {events.length === 0 ? (
        <p className="muted">No events yet. Use the Tracking tab to log actions.</p>
      ) : (
        <>
          <div className="live-timeline-filters">
            <label className="filter-field live-timeline-filter-field">
              <span className="filter-label">Category</span>
              <select
                className="filter-select"
                value={filterKind}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilterKind(v === 'all' ? 'all' : (v as MatchEventKind));
                }}
                aria-label="Filter timeline by event category"
              >
                <option value="all">All categories</option>
                {TIMELINE_KIND_ORDER.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted live-timeline-filter-count" aria-live="polite">
            {filterActive
              ? `${filteredEvents.length} of ${events.length} events`
              : `${events.length} ${events.length === 1 ? 'event' : 'events'}`}
          </p>
          {filteredEvents.length === 0 ? (
            filterKind !== 'all' ? (
              <p className="muted">No {kindLabel(filterKind).toLowerCase()} logged in this match.</p>
            ) : null
          ) : (
            <ul className="live-timeline-list">
              {filteredEvents.map((e) => (
                <li key={e.id} className={timelineRowClassName(e)}>
                  <div className="live-timeline-meta">
                    <span className="live-timeline-time">
                      P{e.period} {formatClock(e.matchTimeMs)}
                      {(e.kind === 'film_star' || e.kind === 'system_moment' || e.kind === 'forced_turnover') &&
                      filmSession && formatFilmClockForSession(filmSession, e.filmTimeMs) != null ? (
                        <span className="live-timeline-film-time">
                          {' '}
                          · Film {formatFilmClockForSession(filmSession, e.filmTimeMs)}
                        </span>
                      ) : null}
                    </span>
                    <span className="live-timeline-label">
                      {formatMatchEventSummary(e, playersById, filmSession)}
                    </span>
                  </div>
                  <div className="live-timeline-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small live-timeline-edit"
                      onClick={() => setEditingId(e.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small btn-danger live-timeline-delete"
                      onClick={() => onDelete(e.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <MatchEventEditDialog
        event={editingEvent}
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        onSaved={() => {
          onEditSaved();
        }}
      />
    </section>
  );
}
