import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MatchRecord } from '@/domain/match';
import { updateMatch } from '@/repos/matchesRepo';

function isoToDatetimeLocal(iso?: string): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  match: MatchRecord | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: MatchRecord) => void;
};

export function MatchEditDialog({ match, open, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [ourTeamName, setOurTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [opponentAbbreviation, setOpponentAbbreviation] = useState('');
  const [kickoffDate, setKickoffDate] = useState('');
  const [location, setLocation] = useState('');
  const [competition, setCompetition] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !match) return;
    setTitle(match.title?.trim() === 'Untitled match' ? '' : match.title ?? '');
    setOurTeamName(match.ourTeamName ?? '');
    setOpponentName(match.opponentName ?? '');
    setOpponentAbbreviation(match.opponentAbbreviation ?? '');
    setKickoffDate(isoToDatetimeLocal(match.kickoffDate));
    setLocation(match.location ?? '');
    setCompetition(match.competition ?? '');
    setFormError(null);
  }, [open, match]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!match) return;
    setBusy(true);
    setFormError(null);
    try {
      const kickoff = kickoffDate.trim() ? new Date(kickoffDate).toISOString() : undefined;
      await updateMatch(match.id, {
        title: title.trim() || undefined,
        ourTeamName: ourTeamName.trim() || undefined,
        opponentName: opponentName.trim() || undefined,
        opponentAbbreviation: opponentAbbreviation.trim() || undefined,
        kickoffDate: kickoff,
        location: location.trim() || undefined,
        competition: competition.trim() || undefined,
      });
      onSaved({
        ...match,
        title: title.trim() || 'Untitled match',
        ourTeamName: ourTeamName.trim() || undefined,
        opponentName: opponentName.trim() || undefined,
        opponentAbbreviation: opponentAbbreviation.trim().toUpperCase() || undefined,
        kickoffDate: kickoff,
        location: location.trim() || undefined,
        competition: competition.trim() || undefined,
        updatedAt: Date.now(),
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save match');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="modal-dialog"
      aria-labelledby="match-edit-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card card">
        <h2 id="match-edit-title" className="admin-card-title">
          Edit match
        </h2>
        <p className="muted form-subtitle">
          Update the fixture label, optional title, kickoff, and venue. Team and competition links stay as set at creation.
        </p>
        {formError ? (
          <p className="error-text" role="alert">
            {formError}
          </p>
        ) : null}
        <form className="form" onSubmit={(e) => void onSubmit(e)}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional if both teams set (e.g. Pool A — Match 2)"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Our team</span>
            <input
              type="text"
              value={ourTeamName}
              onChange={(e) => setOurTeamName(e.target.value)}
              placeholder="Your side on the sheet"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Opponent</span>
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Opponent abbreviation</span>
            <input
              type="text"
              value={opponentAbbreviation}
              onChange={(e) => setOpponentAbbreviation(e.target.value.toUpperCase())}
              placeholder="e.g. EEM"
              maxLength={8}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Kickoff</span>
            <input
              type="datetime-local"
              value={kickoffDate}
              onChange={(e) => setKickoffDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Pitch, venue, or city"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Competition (display text)</span>
            <input
              type="text"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="Optional display label"
              autoComplete="off"
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !match}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
