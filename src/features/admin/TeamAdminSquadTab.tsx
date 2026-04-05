import {
  Fragment,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { SectionHelp, type GlossaryEntry } from '@/components/SectionHelp';
import { formatSessionMassLossPercentDisplay } from '@/domain/weighInPolicy';
import type { MatchRecord, MatchSessionRecord } from '@/domain/match';
import { matchListSortKey } from '@/domain/match';
import type { PlayerRecord } from '@/domain/player';
import { derivedPlayerMinutesMs, formatPlayerMinutesLabel } from '@/domain/playerMinutes';
import { dedupeSquadPlayers } from '@/domain/rosterDisplay';
import { formatTeamMemberLabel, type TeamMemberRecord } from '@/domain/teamMember';
import type { WeighInPhase, WeighInRecord } from '@/domain/weighIn';
import type { TeamRecord } from '@/domain/team';
import { formatLbStringFromKg, parseWeightLbToKg } from '@/domain/weightUnits';
import { createTeamMember, deleteTeamMember, updateTeamMember } from '@/repos/teamMembersRepo';
import { addWeighIn, deleteWeighIn } from '@/repos/weighInsRepo';

const ROSTER_HELP: GlossaryEntry[] = [
  { abbr: 'Jerseys', full: 'Jersey slots', desc: 'Jerseys 1–13 are seeded automatically when a team is created. Use Add player for extra slots.' },
  { abbr: 'Weigh-ins', full: 'Game weights', desc: 'Tap a player row then open Game weights to record pre/post weigh-ins. Loss > 2% of body weight is flagged red.' },
  { abbr: 'Details', full: 'Player details', desc: 'Open Player details to edit name, jersey number, or notes.' },
  { abbr: 'Minutes', full: 'Match minutes', desc: 'Minutes are tracked by jersey number in each game\'s match roster. They update automatically.' },
];

/** Session + roster for squad admin: minutes played per jersey per match. */
export type SquadMatchPlayContext = {
  session: MatchSessionRecord;
  players: PlayerRecord[];
};

type Props = {
  team: TeamRecord;
  members: TeamMemberRecord[];
  matches: MatchRecord[];
  weighRows: WeighInRecord[];
  matchPlayByMatchId: Record<string, SquadMatchPlayContext>;
  load: () => Promise<void>;
  error: string | null;
  setError: (s: string | null) => void;
};

/** Match-clock minutes for this squad member. Prefers teamMemberId link, falls back to jersey number. */
function formatMinutesPlayedForMember(
  member: TeamMemberRecord,
  matchId: string,
  matchPlayByMatchId: Record<string, SquadMatchPlayContext>,
): string {
  const ctx = matchPlayByMatchId[matchId];
  if (!ctx) return '\u2014';
  const squad = dedupeSquadPlayers(ctx.players);
  const player =
    squad.find((p) => p.teamMemberId === member.id) ??
    (member.number != null ? squad.find((p) => p.number === member.number) : undefined);
  if (!player) return '\u2014';
  const ms = derivedPlayerMinutesMs(ctx.session, player.id, player.status, Date.now());
  return formatPlayerMinutesLabel(ms);
}

function latestForMatchPhase(
  rows: WeighInRecord[],
  memberId: string,
  matchId: string | undefined,
  phase: WeighInPhase,
): WeighInRecord | undefined {
  return rows
    .filter((w) => w.teamMemberId === memberId && w.matchId === matchId && w.phase === phase)
    .sort((a, b) => b.recordedAt - a.recordedAt)[0];
}

export function TeamAdminSquadTab({
  team,
  members,
  matches,
  weighRows,
  matchPlayByMatchId,
  load,
  error,
  setError,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [memberName, setMemberName] = useState('');
  const [memberNum, setMemberNum] = useState('');
  const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => matchListSortKey(a) - matchListSortKey(b));
  }, [matches]);

  const replaceSlotWeight = useCallback(
    async (memberId: string, matchId: string, phase: WeighInPhase, rawLb: string) => {
      const trimmed = rawLb.trim();
      const existing = latestForMatchPhase(weighRows, memberId, matchId, phase);
      if (!trimmed) {
        if (existing) await deleteWeighIn(existing.id);
        await load();
        return;
      }
      const kg = parseWeightLbToKg(trimmed);
      if (kg === null) {
        setError('Use pounds (e.g. 175.4).');
        return;
      }
      setError(null);
      if (existing && Math.abs(existing.weightKg - kg) < 0.0001) return;
      if (existing) await deleteWeighIn(existing.id);
      await addWeighIn({
        teamMemberId: memberId,
        matchId,
        recordedAt: Date.now(),
        weightKg: kg,
        phase,
      });
      await load();
    },
    [weighRows, load, setError],
  );

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    const raw = memberNum.trim();
    let num: number | null = null;
    if (raw) {
      const p = Number.parseInt(raw, 10);
      if (Number.isFinite(p)) num = p;
    }
    if (!memberName.trim() && num == null) return;
    await createTeamMember(team.id, {
      name: memberName.trim(),
      number: num,
    });
    setMemberName('');
    setMemberNum('');
    setAddPlayerModalOpen(false);
    await load();
  }

  const newMatchReturn = encodeURIComponent(`/team/${team.id}?tab=admin&section=roster`);

  return (
    <div className="squad-tab-page">
      <div className="squad-tab-body">
        <div className="team-admin-squad-tab">
          {error ? <p className="error-text">{error}</p> : null}

          <section className="card admin-section admin-squad-roster-card">
            <div className="tgs-card-title-row">
              <h2 className="admin-card-title">Roster</h2>
              <SectionHelp title="Roster" entries={ROSTER_HELP} />
            </div>

            {members.length === 0 ? (
              <p className="muted">
                No players yet. Tap <strong>Add player</strong> below.
              </p>
            ) : (
              <ul className="admin-squad-accordion-list">
                {members.map((m) => {
                  const open = expandedId === m.id;
                  return (
                    <li key={m.id} className="admin-squad-accordion-item">
                      <div className="roster-expand-card admin-squad-player-card">
                        <button
                          type="button"
                          className="admin-squad-row-toggle"
                          aria-expanded={open}
                          aria-controls={`squad-player-panel-${m.id}`}
                          id={`squad-player-trigger-${m.id}`}
                          onClick={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                        >
                          <span className="admin-squad-name-text">{formatTeamMemberLabel(m)}</span>
                          <span className="roster-expand-chevron" aria-hidden>
                            {open ? '▾' : '▸'}
                          </span>
                        </button>
                        {open ? (
                          <SquadPlayerExpandedSection
                            member={m}
                            team={team}
                            panelId={`squad-player-panel-${m.id}`}
                            triggerId={`squad-player-trigger-${m.id}`}
                            sortedMatches={sortedMatches}
                            weighRows={weighRows}
                            matchPlayByMatchId={matchPlayByMatchId}
                            newMatchReturn={newMatchReturn}
                            load={load}
                            setExpandedId={setExpandedId}
                            replaceSlotWeight={replaceSlotWeight}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="competitions-sticky-footer squad-add-player-footer" role="toolbar" aria-label="Add player">
        <button
          type="button"
          className="btn btn-primary competitions-sticky-main"
          onClick={() => setAddPlayerModalOpen(true)}
        >
          Add player
        </button>
      </div>

      {addPlayerModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddPlayerModalOpen(false)}>
          <div
            className="modal-card card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="squad-add-player-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="squad-add-player-title" className="admin-card-title">
              Add player
            </h2>
            <p className="muted form-subtitle">Name and/or jersey # (optional slots beyond 1–13).</p>
            <form className="form" onSubmit={(e) => void onAddMember(e)}>
              <label className="field">
                <span>Name</span>
                <input
                  className="filter-select"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Optional if # set"
                  autoFocus
                  aria-label="Player name"
                />
              </label>
              <label className="field">
                <span>#</span>
                <input
                  className="filter-select"
                  inputMode="numeric"
                  value={memberNum}
                  onChange={(e) => setMemberNum(e.target.value)}
                  placeholder="14+"
                  aria-label="Jersey number"
                />
              </label>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAddPlayerModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!memberName.trim() && !memberNum.trim()}>
                  Add player
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SquadPlayerExpandedSection({
  member: m,
  team,
  panelId,
  triggerId,
  sortedMatches,
  weighRows,
  matchPlayByMatchId,
  newMatchReturn,
  load,
  setExpandedId,
  replaceSlotWeight,
}: {
  member: TeamMemberRecord;
  team: TeamRecord;
  panelId: string;
  triggerId: string;
  sortedMatches: MatchRecord[];
  weighRows: WeighInRecord[];
  matchPlayByMatchId: Record<string, SquadMatchPlayContext>;
  newMatchReturn: string;
  load: () => Promise<void>;
  setExpandedId: Dispatch<SetStateAction<string | null>>;
  replaceSlotWeight: (memberId: string, matchId: string, phase: WeighInPhase, raw: string) => Promise<void>;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [gameWeightsOpen, setGameWeightsOpen] = useState(true);
  const profileRegionId = `${panelId}-profile`;
  const profileTriggerId = `${panelId}-profile-trigger`;
  const gameWeightsRegionId = `${panelId}-game-weights`;
  const gameWeightsTriggerId = `${panelId}-game-weights-trigger`;

  return (
    <div className="roster-expand-body admin-squad-player-body" id={panelId} role="region" aria-labelledby={triggerId}>
      <button
        type="button"
        className="admin-squad-sub-toggle"
        aria-expanded={profileOpen}
        aria-controls={profileRegionId}
        id={profileTriggerId}
        onClick={() => setProfileOpen((v) => !v)}
      >
        <span>Player details</span>
        <span className="roster-expand-chevron" aria-hidden>
          {profileOpen ? '▾' : '▸'}
        </span>
      </button>
      {profileOpen ? (
        <div id={profileRegionId} role="region" aria-labelledby={profileTriggerId} className="admin-squad-profile-wrap">
          <SquadMemberProfileForm
            member={m}
            onSaved={() => void load()}
            onRemoved={() => {
              setExpandedId((id) => (id === m.id ? null : id));
              void load();
            }}
          />
        </div>
      ) : null}

      {sortedMatches.length === 0 ? (
        <div className="card empty-card admin-squad-empty-matches">
          <p className="muted">No games linked yet.</p>
          <Link
            to={`/matches/new?teamId=${team.id}&competitionId=${team.competitionId}&returnTo=${newMatchReturn}`}
            className="btn btn-secondary"
          >
            New match for this team
          </Link>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="admin-squad-sub-toggle"
            aria-expanded={gameWeightsOpen}
            aria-controls={gameWeightsRegionId}
            id={gameWeightsTriggerId}
            onClick={() => setGameWeightsOpen((v) => !v)}
          >
            <span>Game weights</span>
            <span className="roster-expand-chevron" aria-hidden>
              {gameWeightsOpen ? '▾' : '▸'}
            </span>
          </button>
          {gameWeightsOpen ? (
            <div
              id={gameWeightsRegionId}
              role="region"
              aria-labelledby={gameWeightsTriggerId}
              className="admin-squad-game-weights-region"
            >
              <div className="admin-weigh-table-wrap">
                <table className="admin-weigh-table admin-weigh-table-compact">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Pre (lb)</th>
                      <th scope="col">Post (lb)</th>
                      <th scope="col">Loss %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMatches.map((game, idx) => {
                      const pre = latestForMatchPhase(weighRows, m.id, game.id, 'pre');
                      const post = latestForMatchPhase(weighRows, m.id, game.id, 'post');
                      const loss = formatSessionMassLossPercentDisplay(pre?.weightKg, post?.weightKg);
                      const minutesPlayed = formatMinutesPlayedForMember(m, game.id, matchPlayByMatchId);
                      return (
                        <Fragment key={game.id}>
                          <GameWeightRow
                            gameIndex={idx + 1}
                            preLb={pre ? formatLbStringFromKg(pre.weightKg) : ''}
                            postLb={post ? formatLbStringFromKg(post.weightKg) : ''}
                            lossPctText={loss.text}
                            lossPctWarn={loss.warn}
                            onCommitPre={(raw) => void replaceSlotWeight(m.id, game.id, 'pre', raw)}
                            onCommitPost={(raw) => void replaceSlotWeight(m.id, game.id, 'post', raw)}
                          />
                          <tr className="admin-weigh-minutes-row">
                            <td colSpan={4}>
                              <span className="admin-weigh-minutes-label">Minutes played</span>{' '}
                              <span className="tabular-nums admin-weigh-minutes-value">{minutesPlayed}</span>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SquadMemberProfileForm({
  member: m,
  onSaved,
  onRemoved,
}: {
  member: TeamMemberRecord;
  onSaved: () => void | Promise<void>;
  onRemoved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(m.name);
  const [numberStr, setNumberStr] = useState(m.number != null ? String(m.number) : '');
  const [notes, setNotes] = useState(m.notes ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setName(m.name);
    setNumberStr(m.number != null ? String(m.number) : '');
    setNotes(m.notes ?? '');
    setFormError(null);
  }, [m.id, m.name, m.number, m.notes, m.updatedAt]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    let num: number | null = null;
    if (numberStr.trim()) {
      const p = Number.parseInt(numberStr, 10);
      if (!Number.isFinite(p) || p < 0 || p > 99) {
        setFormError('Jersey # use 0–99 or leave blank.');
        return;
      }
      num = p;
    }
    setFormError(null);
    await updateTeamMember(m.id, {
      name: name.trim(),
      number: num,
      notes: notes.trim() || undefined,
    });
    await onSaved();
  }

  async function onRemove() {
    if (
      !confirm(
        `Remove ${m.number != null ? `#${m.number} ` : ''}from this roster? Weigh-ins for this row will be deleted.`,
      )
    ) {
      return;
    }
    await deleteTeamMember(m.id);
    await onRemoved();
  }

  return (
    <form className="admin-squad-profile-inline card" onSubmit={(e) => void onSubmit(e)}>
      <p className="muted admin-squad-profile-lead">Name, jersey, and notes.</p>
      <div className="admin-squad-profile-fields">
        <label className="field">
          <span>Display name</span>
          <input
            className="filter-select"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam C."
            autoComplete="off"
            aria-label="Player name"
          />
        </label>
        <label className="field">
          <span>Jersey #</span>
          <input
            className="filter-select"
            inputMode="numeric"
            value={numberStr}
            onChange={(e) => setNumberStr(e.target.value)}
            placeholder="1–99, optional"
            aria-label="Jersey number"
          />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea
            className="filter-select team-member-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, load management, etc."
            rows={3}
            aria-label="Notes"
          />
        </label>
      </div>
      {formError ? <p className="error-text">{formError}</p> : null}
      <div className="admin-squad-profile-actions">
        <button type="submit" className="btn btn-primary btn-small">
          Save profile
        </button>
        <button type="button" className="btn btn-ghost btn-danger btn-small" onClick={() => void onRemove()}>
          Remove from roster
        </button>
      </div>
    </form>
  );
}

function GameWeightRow({
  gameIndex,
  preLb,
  postLb,
  lossPctText,
  lossPctWarn,
  onCommitPre,
  onCommitPost,
}: {
  gameIndex: number;
  preLb: string;
  postLb: string;
  lossPctText: string;
  lossPctWarn: boolean;
  onCommitPre: (raw: string) => void;
  onCommitPost: (raw: string) => void;
}) {
  const [pre, setPre] = useState(preLb);
  const [post, setPost] = useState(postLb);

  useEffect(() => {
    setPre(preLb);
  }, [preLb]);

  useEffect(() => {
    setPost(postLb);
  }, [postLb]);

  return (
    <tr>
      <td className="tabular-nums admin-weigh-game-num">{gameIndex}</td>
      <td>
        <input
          className="filter-select admin-weigh-inline-input"
          inputMode="decimal"
          value={pre}
          onChange={(e) => setPre(e.target.value)}
          onBlur={() => onCommitPre(pre)}
          placeholder="—"
          aria-label={`Game ${gameIndex} pre weight lb`}
        />
      </td>
      <td>
        <input
          className="filter-select admin-weigh-inline-input"
          inputMode="decimal"
          value={post}
          onChange={(e) => setPost(e.target.value)}
          onBlur={() => onCommitPost(post)}
          placeholder="—"
          aria-label={`Game ${gameIndex} post weight lb`}
        />
      </td>
      <td
        className={`tabular-nums admin-weigh-loss-pct${lossPctWarn ? ' admin-weigh-loss-pct--warn' : lossPctText.includes('%') ? ' admin-weigh-loss-pct--ok' : ''}`}
        title="Body mass change from pre to post as % of pre weight (positive = mass lost)"
      >
        {lossPctText}
      </td>
    </tr>
  );
}
