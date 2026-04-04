import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  DAY_SCHEDULE_KIND_LABEL,
  formatDayTimeMinutes,
  localDayDateString,
  parseTimeToMinutes,
  type DayScheduleKind,
} from '@/domain/daySchedule';
import type { TeamRecord } from '@/domain/team';
import { addDayScheduleItem, deleteDayScheduleItem, listDaySchedule } from '@/repos/dayScheduleRepo';

type Props = {
  team: TeamRecord;
  onScheduleChanged: () => void;
  error: string | null;
  setError: (s: string | null) => void;
};

/** Day-of gameday blocks (meals, warm-up, match). Matches imported from schedule still appear under Match tab. */
export function TeamAdminTimelineTab({ team, onScheduleChanged, error, setError }: Props) {
  const teamId = team.id;
  const [scheduleDay, setScheduleDay] = useState(() => localDayDateString());
  const [scheduleItems, setScheduleItems] = useState<Awaited<ReturnType<typeof listDaySchedule>>>([]);

  const [schedLabel, setSchedLabel] = useState('');
  const [schedKind, setSchedKind] = useState<DayScheduleKind>('meal');
  const [schedStart, setSchedStart] = useState('7:00');
  const [schedEnd, setSchedEnd] = useState('');

  const loadDay = useCallback(async () => {
    setScheduleItems(await listDaySchedule(teamId, scheduleDay));
  }, [teamId, scheduleDay]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  async function onAddSchedule(e: FormEvent) {
    e.preventDefault();
    const start = parseTimeToMinutes(schedStart);
    if (start === null) {
      setError('Start time use 24h format like 7:30 or 14:00.');
      return;
    }
    let endM: number | undefined;
    if (schedEnd.trim()) {
      const ex = parseTimeToMinutes(schedEnd);
      if (ex === null) {
        setError('End time use 24h format.');
        return;
      }
      endM = ex;
    }
    setError(null);
    await addDayScheduleItem({
      teamId,
      dayDate: scheduleDay,
      startMinutes: start,
      endMinutes: endM,
      label: schedLabel.trim() || DAY_SCHEDULE_KIND_LABEL[schedKind],
      kind: schedKind,
    });
    setSchedLabel('');
    await loadDay();
    onScheduleChanged();
  }

  return (
    <div className="team-admin-timeline-tab">
      {error ? <p className="error-text">{error}</p> : null}

      <section className="card admin-section">
        <label className="field">
          <span>Day</span>
          <input
            type="date"
            className="filter-select"
            value={scheduleDay}
            onChange={(e) => setScheduleDay(e.target.value)}
            aria-label="Schedule day"
          />
        </label>
        {scheduleItems.length === 0 ? (
          <p className="muted">No blocks for this day.</p>
        ) : (
          <ul className="admin-schedule-list">
            {scheduleItems.map((it) => (
              <li key={it.id} className="admin-schedule-row">
                <span className="admin-schedule-time">
                  {formatDayTimeMinutes(it.startMinutes)}
                  {it.endMinutes != null ? `–${formatDayTimeMinutes(it.endMinutes)}` : ''}
                </span>
                <span className="admin-schedule-label">
                  <strong>{DAY_SCHEDULE_KIND_LABEL[it.kind]}</strong> · {it.label}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => void deleteDayScheduleItem(it.id).then(loadDay).then(onScheduleChanged)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="admin-schedule-form" onSubmit={(e) => void onAddSchedule(e)}>
          <label className="field">
            <span>Label</span>
            <input
              className="filter-select"
              value={schedLabel}
              onChange={(e) => setSchedLabel(e.target.value)}
              placeholder="Breakfast, bus, etc."
            />
          </label>
          <label className="field">
            <span>Kind</span>
            <select
              className="filter-select"
              value={schedKind}
              onChange={(e) => setSchedKind(e.target.value as DayScheduleKind)}
            >
              {(Object.keys(DAY_SCHEDULE_KIND_LABEL) as DayScheduleKind[]).map((k) => (
                <option key={k} value={k}>
                  {DAY_SCHEDULE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-form-row">
            <label className="field">
              <span>Start (24h)</span>
              <input
                className="filter-select"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
                placeholder="7:30"
              />
            </label>
            <label className="field">
              <span>End (optional)</span>
              <input
                className="filter-select"
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
                placeholder="8:00"
              />
            </label>
          </div>
          <button type="submit" className="btn btn-secondary">
            Add block
          </button>
        </form>
      </section>
    </div>
  );
}
