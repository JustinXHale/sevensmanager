import type { MatchSessionRecord } from '@/domain/match';
import { formatClock, formatFilmClockForSession } from '@/domain/matchClock';
import type { MatchEventKind, MatchEventRecord, PenaltyTypeId, PlayPhaseContext } from '@/domain/matchEvent';
import { resolvePenaltyDirection } from '@/domain/matchEvent';
import { formatMatchEventSummary } from '@/domain/matchEventDisplay';
import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import { formatPlayerLabel } from '@/domain/rosterDisplay';
import type { ZoneId } from '@/domain/zone';
import {
  eventsOfKind,
  kindLabel,
  sortMatchEventsByTime,
  sortSubstitutionsByTime,
  tackleEventsMadeList,
  tackleEventsMissedList,
  tryEventsInZone,
} from '@/domain/matchStats';

export type PanelPayload =
  | { type: 'events'; items: MatchEventRecord[] }
  | { type: 'subs'; items: SubstitutionRecord[] };

export function sortPooledEvents(
  events: MatchEventRecord[],
  matchOrder: string[],
): MatchEventRecord[] {
  const order = new Map(matchOrder.map((id, i) => [id, i]));
  return [...events].sort((a, b) => {
    const ma = order.get(a.matchId) ?? 0;
    const mb = order.get(b.matchId) ?? 0;
    if (ma !== mb) return ma - mb;
    if (a.period !== b.period) return a.period - b.period;
    return a.matchTimeMs - b.matchTimeMs;
  });
}

export function getPanelPayload(
  key: string,
  events: MatchEventRecord[],
  substitutions: SubstitutionRecord[],
  matchOrder: string[] = [],
): PanelPayload {
  const sortEvents = (items: MatchEventRecord[]) =>
    matchOrder.length > 0 ? sortPooledEvents(items, matchOrder) : sortMatchEventsByTime(items);

  if (key === 'subs') return { type: 'subs', items: sortSubstitutionsByTime(substitutions) };
  if (key.startsWith('kind:')) {
    const kind = key.slice(5) as MatchEventKind;
    return { type: 'events', items: sortEvents(eventsOfKind(events, kind)) };
  }
  if (key === 'tackle:made') return { type: 'events', items: sortEvents(tackleEventsMadeList(events)) };
  if (key === 'tackle:missed') return { type: 'events', items: sortEvents(tackleEventsMissedList(events)) };
  if (key === 'pass:offload') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) =>
            e.deletedAt == null &&
            e.kind === 'pass' &&
            e.playPhaseContext !== 'defense' &&
            e.passVariant === 'offload',
        ),
      ),
    };
  }
  if (key === 'pass:standard') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) =>
            e.deletedAt == null &&
            e.kind === 'pass' &&
            e.playPhaseContext !== 'defense' &&
            e.passVariant !== 'offload',
        ),
      ),
    };
  }
  if (key === 'pass:defense') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter((e) => e.deletedAt == null && e.kind === 'pass' && e.playPhaseContext === 'defense'),
      ),
    };
  }
  if (key === 'conv:made') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter((e) => e.deletedAt == null && e.kind === 'conversion' && e.conversionOutcome !== 'missed'),
      ),
    };
  }
  if (key === 'conv:missed') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter((e) => e.deletedAt == null && e.kind === 'conversion' && e.conversionOutcome === 'missed'),
      ),
    };
  }
  if (key === 'neg:all') {
    return {
      type: 'events',
      items: sortEvents(events.filter((e) => e.deletedAt == null && e.kind === 'negative_action')),
    };
  }
  if (key === 'neg:knock_on') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) => e.deletedAt == null && e.kind === 'negative_action' && e.negativeActionId === 'knock_on',
        ),
      ),
    };
  }
  if (key === 'neg:other') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) => e.deletedAt == null && e.kind === 'negative_action' && e.negativeActionId !== 'knock_on',
        ),
      ),
    };
  }
  if (key.startsWith('neg:type:')) {
    const negId = key.slice(9);
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) =>
            e.deletedAt == null &&
            e.kind === 'negative_action' &&
            (e.negativeActionId ?? 'unknown') === negId,
        ),
      ),
    };
  }
  if (key === 'pen:conceded') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter((e) => e.deletedAt == null && e.kind === 'team_penalty' && resolvePenaltyDirection(e) === 'conceded'),
      ),
    };
  }
  if (key === 'pen:awarded') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter((e) => e.deletedAt == null && e.kind === 'team_penalty' && resolvePenaltyDirection(e) === 'awarded'),
      ),
    };
  }
  if (key.startsWith('pen:type:')) {
    const penType = key.slice(9) as PenaltyTypeId;
    return {
      type: 'events',
      items: sortEvents(
        events.filter((e) => e.deletedAt == null && e.kind === 'team_penalty' && e.penaltyType === penType),
      ),
    };
  }
  if (key.startsWith('pen:')) {
    const [, dir, phase] = key.split(':') as [string, 'conceded' | 'awarded', PlayPhaseContext];
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) =>
            e.deletedAt == null &&
            e.kind === 'team_penalty' &&
            resolvePenaltyDirection(e) === dir &&
            e.playPhaseContext === phase,
        ),
      ),
    };
  }
  if (key === 'restart:attack') {
    return {
      type: 'events',
      items: sortEvents(
        events.filter(
          (e) =>
            e.deletedAt == null &&
            e.kind === 'restart' &&
            e.playPhaseContext === 'attack' &&
            (e.setPieceOutcome === 'won' || e.setPieceOutcome === 'lost'),
        ),
      ),
    };
  }
  if (key.startsWith('zone:')) {
    const zoneId = key.slice(5) as ZoneId;
    return { type: 'events', items: sortEvents(tryEventsInZone(events, zoneId)) };
  }
  return { type: 'events', items: [] };
}

export function mergeEventPayloads(payloads: PanelPayload[]): MatchEventRecord[] {
  const seen = new Set<string>();
  const merged: MatchEventRecord[] = [];
  for (const p of payloads) {
    if (p.type !== 'events') continue;
    for (const e of p.items) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      merged.push(e);
    }
  }
  return merged;
}

function formatSubLine(s: SubstitutionRecord, playersById: Map<string, PlayerRecord>): string {
  const offP = playersById.get(s.playerOffId);
  const onP = playersById.get(s.playerOnId);
  const off = offP ? formatPlayerLabel(offP) : 'Off';
  const on = onP ? formatPlayerLabel(onP) : 'On';
  return `P${s.period} ${formatClock(s.matchTimeMs)} \u00b7 ${off} \u2192 ${on}`;
}

export function expandPanelTitle(key: string): string {
  if (key === 'subs') return 'Substitutions';
  if (key === 'tackle:made') return 'Tackles made';
  if (key === 'tackle:missed') return 'Tackles missed';
  if (key === 'pass:offload') return 'Offloads';
  if (key === 'pass:standard') return 'Passes';
  if (key === 'pass:defense') return 'Opp passes';
  if (key === 'neg:all') return 'Negative actions';
  if (key === 'neg:knock_on') return 'Knock-ons';
  if (key === 'neg:other') return 'Other negatives';
  if (key.startsWith('neg:type:')) return 'Negative actions';
  if (key === 'pen:conceded' || key === 'pen:awarded') return 'Penalties';
  if (key.startsWith('pen:type:')) return 'Penalties';
  if (key.startsWith('pen:')) return 'Penalties';
  if (key === 'restart:attack') return 'Restart receive';
  if (key.startsWith('kind:')) return kindLabel(key.slice(5) as MatchEventKind);
  if (key.startsWith('zone:')) return `Tries \u00b7 ${key.slice(5)}`;
  return 'Events';
}

export function StatExpandContent({
  payload,
  playersById,
  filmSession,
  empty,
  matchLabelsByMatchId,
}: {
  payload: PanelPayload;
  playersById: Map<string, PlayerRecord>;
  filmSession: MatchSessionRecord | null;
  empty: string;
  matchLabelsByMatchId?: Map<string, string>;
}) {
  const showMatch = (matchLabelsByMatchId?.size ?? 0) > 1;

  if (payload.type === 'events') {
    if (payload.items.length === 0) return <p className="muted live-stats-expand-empty">{empty}</p>;
    return (
      <ul className="live-stats-expand-list">
        {payload.items.map((e) => (
          <li key={e.id} className="live-stats-expand-row">
            <span className="live-stats-expand-time">
              {showMatch && matchLabelsByMatchId?.get(e.matchId) ? (
                <span className="live-stats-expand-match">{matchLabelsByMatchId.get(e.matchId)} · </span>
              ) : null}
              P{e.period} {formatClock(e.matchTimeMs)}
              {(e.kind === 'film_star' || e.kind === 'system_moment' || e.kind === 'forced_turnover') &&
              filmSession &&
              formatFilmClockForSession(filmSession, e.filmTimeMs) != null ? (
                <span className="live-stats-expand-film">
                  {' '}
                  · Film {formatFilmClockForSession(filmSession, e.filmTimeMs)}
                </span>
              ) : null}
            </span>
            <span className="live-stats-expand-text">
              {formatMatchEventSummary(e, playersById, filmSession)}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (payload.items.length === 0) return <p className="muted live-stats-expand-empty">{empty}</p>;
  return (
    <ul className="live-stats-expand-list">
      {payload.items.map((s) => (
        <li key={s.id} className="live-stats-expand-row">
          <span className="live-stats-expand-text">{formatSubLine(s, playersById)}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatCard({
  statKey,
  value,
  label,
  wide,
  expandedKey,
  onToggle,
  idPrefix,
  events,
  substitutions,
  playersById,
  filmSession = null,
  matchLabelsByMatchId,
  matchOrder = [],
}: {
  statKey: string;
  value: number | string;
  label: string;
  wide?: boolean;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  idPrefix: string;
  events: MatchEventRecord[];
  substitutions: SubstitutionRecord[];
  playersById: Map<string, PlayerRecord>;
  filmSession?: MatchSessionRecord | null;
  matchLabelsByMatchId?: Map<string, string>;
  matchOrder?: string[];
}) {
  const open = expandedKey === statKey;
  const panelId = `${idPrefix}-${statKey.replace(/:/g, '-')}`;
  const payload = open ? getPanelPayload(statKey, events, substitutions, matchOrder) : null;

  return (
    <div className={`live-stats-cell-wrap${open ? ' live-stats-cell-wrap--expanded' : ''}${wide ? ' live-stats-cell-wrap--wide' : ''}`}>
      <button
        type="button"
        className={`live-stats-cell live-stats-cell--btn${open ? ' live-stats-cell--open' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => onToggle(statKey)}
      >
        <span className="live-stats-num">{value}</span>
        <span className="live-stats-label">{label}</span>
      </button>
      {open && payload ? (
        <div id={panelId} className="live-stats-cell-body" role="region" aria-label={expandPanelTitle(statKey)}>
          <StatExpandContent
            payload={payload}
            playersById={playersById}
            filmSession={filmSession}
            empty="No matching log entries."
            matchLabelsByMatchId={matchLabelsByMatchId}
          />
        </div>
      ) : null}
    </div>
  );
}
