import type { PlayerRecord, SubstitutionRecord } from '@/domain/player';
import { formatClock } from '@/domain/matchClock';
import { formatPlayerLabel } from '@/domain/rosterDisplay';

type Props = {
  substitutions: SubstitutionRecord[];
  playerById: Map<string, PlayerRecord>;
  expanded: boolean;
  onToggle: () => void;
};

export function SubstitutionHistoryCard({ substitutions, playerById, expanded, onToggle }: Props) {
  return (
    <section className="roster-expand-card">
      <button type="button" className="roster-expand-header" onClick={onToggle}>
        <span className="roster-expand-title">Substitution history</span>
        <span className="muted roster-expand-count">{substitutions.length} events</span>
        <span className="roster-expand-chevron" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <div className="roster-expand-body">
          {substitutions.length === 0 ? (
            <p className="muted roster-empty">No substitutions yet.</p>
          ) : (
            <ul className="roster-sub-history">
              {substitutions.map((s) => {
                const offP = playerById.get(s.playerOffId);
                const onP = playerById.get(s.playerOnId);
                return (
                  <li key={s.id} className="roster-sub-line">
                    <span className="roster-sub-time">{formatClock(s.matchTimeMs)}</span>
                    <span className="roster-sub-detail">
                      P{s.period}: {offP ? formatPlayerLabel(offP) : '?'} off ·{' '}
                      {onP ? formatPlayerLabel(onP) : '?'} on
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
