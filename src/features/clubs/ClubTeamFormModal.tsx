import { useEffect, useId, useRef, useState } from 'react';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import type { ClubRecord } from '@/domain/club';
import { createClub, updateClub } from '@/repos/clubsRepo';
import { LOGO_FIELD_REQUIREMENTS, preflightImageFileForLogo, readLogoFileAsDataUrl } from '@/utils/imageCompress';

type LogoUiState =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'ok'; fileLabel: string }
  | { phase: 'error'; message: string };

type Props =
  | {
      open: boolean;
      variant: 'create';
      onClose: () => void;
      onSaved: () => void | Promise<void>;
    }
  | {
      open: boolean;
      variant: 'edit';
      club: ClubRecord;
      onClose: () => void;
      onSaved: () => void | Promise<void>;
    };

export function ClubTeamFormModal(props: Props) {
  const { open, onClose, onSaved, variant } = props;
  const formId = useId();
  const logoReqId = `${formId}-logo-req`;
  const logoStatusId = `${formId}-logo-status`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState<'unchanged' | 'new' | 'removed'>('unchanged');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoUi, setLogoUi] = useState<LogoUiState>({ phase: 'idle' });
  const dlgRef = useRef<HTMLDialogElement>(null);

  const formDirty = open && (() => {
    if (logoDirty !== 'unchanged') return true;
    if (variant === 'edit') {
      const c = props.club;
      return name.trim() !== c.name || nickname.trim() !== c.nickname || abbreviation.trim() !== c.abbreviation;
    }
    return !!(name.trim() || nickname.trim() || abbreviation.trim());
  })();
  useBeforeUnload(formDirty);

  const initKey =
    variant === 'edit' ? `${props.club.id}:${props.club.updatedAt}` : 'create';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setLogoDirty('unchanged');
    setLogoUi({ phase: 'idle' });
    if (variant === 'edit') {
      const c = props.club;
      setName(c.name);
      setNickname(c.nickname);
      setAbbreviation(c.abbreviation);
      setLogoDataUrl(c.logoDataUrl);
      setLogoFileName(c.logoDataUrl ? 'Current logo' : null);
    } else {
      setName('');
      setNickname('');
      setAbbreviation('');
      setLogoDataUrl(undefined);
      setLogoFileName(null);
    }
  }, [open, variant, initKey]);

  useEffect(() => {
    const el = dlgRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function isDirty() {
    if (logoDirty !== 'unchanged') return true;
    if (variant === 'edit') {
      const c = props.club;
      return name.trim() !== c.name || nickname.trim() !== c.nickname || abbreviation.trim() !== c.abbreviation;
    }
    return !!(name.trim() || nickname.trim() || abbreviation.trim());
  }

  function tryClose() {
    if (busy) return;
    if (isDirty() && !confirm('Discard unsaved changes?')) return;
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const nick = nickname.trim();
    const abbr = abbreviation.trim();
    if (!n || !nick || !abbr) {
      setError('Name, nickname, and abbreviation are all required.');
      return;
    }
    if (logoUi.phase === 'processing' || logoUi.phase === 'error') {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (variant === 'edit') {
        const logo =
          logoDirty === 'removed'
            ? ('remove' as const)
            : logoDirty === 'new'
              ? logoDataUrl!
              : ('keep' as const);
        if (logoDirty === 'new' && !logoDataUrl) {
          setError('Fix or remove the logo before saving.');
          setBusy(false);
          return;
        }
        await updateClub(props.club.id, { name: n, nickname: nick, abbreviation: abbr, logo });
      } else {
        await createClub({
          name: n,
          nickname: nick,
          abbreviation: abbr,
          logoDataUrl,
        });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) {
      setLogoUi({ phase: 'idle' });
      setLogoDataUrl(undefined);
      setLogoFileName(null);
      if (variant === 'edit') {
        setLogoDirty('removed');
      } else {
        setLogoDirty('unchanged');
      }
      return;
    }

    setError(null);
    const pre = preflightImageFileForLogo(f);
    if (!pre.ok) {
      setLogoDataUrl(undefined);
      setLogoFileName(null);
      setLogoDirty('unchanged');
      setLogoUi({ phase: 'error', message: pre.message });
      input.value = '';
      return;
    }

    setLogoUi({ phase: 'processing' });
    try {
      const dataUrl = await readLogoFileAsDataUrl(f);
      setLogoDataUrl(dataUrl);
      setLogoFileName(f.name);
      setLogoDirty('new');
      setLogoUi({ phase: 'ok', fileLabel: f.name });
      setError(null);
    } catch (err) {
      setLogoDataUrl(undefined);
      setLogoFileName(null);
      setLogoDirty('unchanged');
      setLogoUi({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Could not use this file.',
      });
      input.value = '';
    }
  }

  function onRemoveLogo() {
    setLogoDataUrl(undefined);
    setLogoFileName(null);
    setLogoDirty('removed');
    setLogoUi({ phase: 'idle' });
  }

  const logoBlocksSave = logoUi.phase === 'processing' || logoUi.phase === 'error';

  return (
    <dialog
      ref={dlgRef}
      className="modal-dialog"
      aria-labelledby={`${formId}-title`}
      onCancel={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        if (isDirty() && !confirm('Discard unsaved changes?')) {
          e.preventDefault();
          return;
        }
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (busy) return;
        if (isDirty() && !confirm('Discard unsaved changes?')) return;
        onClose();
      }}
    >
      <div className="modal-card card">
        <h2 id={`${formId}-title`} className="admin-card-title">
          {variant === 'edit' ? 'Edit club' : 'New club'}
        </h2>
        <p className="muted form-subtitle">Name, nickname, and abbreviation are required.</p>
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        <form className="form" onSubmit={(e) => void onSubmit(e)}>
          <label className="field">
            <span>Club name</span>
            <input
              className="filter-select"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Metro Rugby Football Club"
              autoFocus={variant === 'create'}
              aria-label="Club name"
              required
            />
          </label>
          <label className="field">
            <span>Nickname</span>
            <input
              className="filter-select"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Hellraisers"
              aria-label="Nickname"
              required
            />
          </label>
          <label className="field">
            <span>Abbreviation</span>
            <input
              className="filter-select"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
              placeholder="e.g. MRC"
              maxLength={8}
              aria-label="Abbreviation"
              required
            />
          </label>
          <label className="field">
            <span>Logo (optional)</span>
            <p id={logoReqId} className="muted form-requirements">
              {LOGO_FIELD_REQUIREMENTS}
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml"
              onChange={(e) => void onLogoChange(e)}
              aria-label="Logo upload"
              aria-describedby={`${logoReqId} ${logoStatusId}`}
              disabled={logoUi.phase === 'processing'}
            />
            <p id={logoStatusId} className="form-logo-status" role="status" aria-live="polite">
              {logoUi.phase === 'processing' ? (
                <span className="muted">Reading…</span>
              ) : logoUi.phase === 'ok' ? (
                <span className="form-logo-status-ok">{logoUi.fileLabel}</span>
              ) : logoUi.phase === 'error' ? (
                <span className="error-text">{logoUi.message}</span>
              ) : variant === 'edit' && logoDirty === 'unchanged' && logoDataUrl ? (
                <span className="muted">Saved logo on file.</span>
              ) : null}
            </p>
          </label>
          {variant === 'edit' && logoDirty !== 'removed' && (logoDataUrl || logoFileName) ? (
            <div className="field field--inline">
              <button type="button" className="btn btn-ghost club-landing-remove-logo" onClick={() => onRemoveLogo()}>
                Remove logo
              </button>
            </div>
          ) : null}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => tryClose()}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                busy || !name.trim() || !nickname.trim() || !abbreviation.trim() || logoBlocksSave
              }
              title={
                logoBlocksSave
                  ? logoUi.phase === 'processing'
                    ? 'Wait…'
                    : 'Fix the logo first.'
                  : undefined
              }
            >
              {busy ? 'Saving…' : variant === 'edit' ? 'Save changes' : 'Save club'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
