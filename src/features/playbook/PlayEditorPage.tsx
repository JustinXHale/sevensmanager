import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppChrome } from '@/context/AppChromeContext';
import type {
  AttackingPhaseSlice,
  AttackingPlayerSlot,
  AttackingPlayDocumentV2,
  AttackingPlayRecord,
  NormPoint,
  PhaseTimeline,
} from '@/domain/attackingPlay';
import {
  createDefaultAttackingPlayDocument,
  ensurePlayDocument,
  globalTimeToPhaseLocal,
  normalizePhaseSlice,
  normalizePlayDocumentV2,
  resyncPhaseFromPrevious,
  resolvePlayersForPhase,
  totalPlayDurationSec,
} from '@/domain/attackingPlay';
import { getAttackingPlay, saveAttackingPlay } from '@/repos/attackingPlaysRepo';
import { PlayFieldCanvas } from './PlayFieldCanvas';
import './playbook.css';

type EditorState = {
  doc: AttackingPlayDocumentV2;
  past: AttackingPlayDocumentV2[];
  future: AttackingPlayDocumentV2[];
};

type Action =
  | { type: 'hydrate'; doc: AttackingPlayDocumentV2 }
  | { type: 'commit'; doc: AttackingPlayDocumentV2; recordHistory: boolean }
  | { type: 'undo' }
  | { type: 'redo' };

function cloneDoc(d: AttackingPlayDocumentV2): AttackingPlayDocumentV2 {
  return structuredClone(d);
}

function editorReducer(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case 'hydrate':
      return { doc: normalizePlayDocumentV2(a.doc), past: [], future: [] };
    case 'commit': {
      const next = normalizePlayDocumentV2(a.doc);
      if (!a.recordHistory) return { ...s, doc: next };
      return {
        doc: next,
        past: [...s.past.slice(-49), cloneDoc(s.doc)],
        future: [],
      };
    }
    case 'undo': {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        doc: cloneDoc(prev),
        past: s.past.slice(0, -1),
        future: [cloneDoc(s.doc), ...s.future],
      };
    }
    case 'redo': {
      if (s.future.length === 0) return s;
      const nxt = s.future[0]!;
      return {
        doc: cloneDoc(nxt),
        future: s.future.slice(1),
        past: [...s.past.slice(-49), cloneDoc(s.doc)],
      };
    }
    default:
      return s;
  }
}

function parseChainInput(raw: string): AttackingPlayerSlot[] {
  const parts = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const slots: AttackingPlayerSlot[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (n >= 1 && n <= 7) slots.push(n as AttackingPlayerSlot);
  }
  return slots.length > 0 ? slots : [1];
}

function replacePhase(doc: AttackingPlayDocumentV2, phaseIndex: number, slice: AttackingPhaseSlice): AttackingPlayDocumentV2 {
  const phases = doc.phases.map((p, i) => (i === phaseIndex ? normalizePhaseSlice(slice) : p));
  return normalizePlayDocumentV2({ ...doc, phases });
}

function mapPhase(
  doc: AttackingPlayDocumentV2,
  phaseIndex: number,
  fn: (slice: AttackingPhaseSlice) => AttackingPhaseSlice,
): AttackingPlayDocumentV2 {
  return replacePhase(doc, phaseIndex, normalizePhaseSlice(fn(doc.phases[phaseIndex]!)));
}

export function PlayEditorPage() {
  const { playId } = useParams<{ playId: string }>();
  const navigate = useNavigate();
  const { setTeamHeader } = useAppChrome();
  const [record, setRecord] = useState<AttackingPlayRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(editorReducer, undefined, () => ({
    doc: normalizePlayDocumentV2(createDefaultAttackingPlayDocument()),
    past: [],
    future: [],
  }));

  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<AttackingPlayerSlot | null>(1);
  const [editMode, setEditMode] = useState<'select' | 'draw'>('select');
  const [focusedSlot, setFocusedSlot] = useState<AttackingPlayerSlot | null>(null);
  const [phaseTimeSec, setPhaseTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playAllMode, setPlayAllMode] = useState(false);
  const [chainInput, setChainInput] = useState('1');

  const rafRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTeamHeader({ backTo: '/plays', title: 'Canvas' });
    return () => setTeamHeader(null);
  }, [setTeamHeader]);

  useEffect(() => {
    if (!playId) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await getAttackingPlay(playId);
        if (cancelled) return;
        if (!row) {
          setLoadError('Play not found');
          setRecord(null);
          return;
        }
        setRecord(row);
        dispatch({ type: 'hydrate', doc: ensurePlayDocument(row.document) });
        const d = ensurePlayDocument(row.document);
        setChainInput(d.phases[0]!.possessionChain.join(', '));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playId]);

  const doc = state.doc;
  const slice = doc.phases[activePhaseIndex]!;

  const commit = useCallback((next: AttackingPlayDocumentV2, recordHistory: boolean) => {
    dispatch({ type: 'commit', doc: next, recordHistory });
  }, []);

  useEffect(() => {
    setChainInput(slice.possessionChain.join(', '));
  }, [activePhaseIndex, slice.possessionChain]);

  useEffect(() => {
    if (!record || loadError) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveAttackingPlay({
        ...record,
        document: doc,
        updatedAt: Date.now(),
      }).catch(() => {
        /* ignore quota */
      });
    }, 450);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doc, loadError, record]);

  const resolvedPhase = useMemo((): PhaseTimeline => {
    const resolved = resolvePlayersForPhase(doc, activePhaseIndex);
    return {
      durationSec: slice.durationSec,
      players: resolved,
      possessionChain: slice.possessionChain,
      passArrivalTimeSec: slice.passArrivalTimeSec,
    };
  }, [doc, activePhaseIndex, slice]);

  const totalDur = useMemo(() => totalPlayDurationSec(doc), [doc]);

  const phaseTimeRef = useRef(phaseTimeSec);
  phaseTimeRef.current = phaseTimeSec;

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    if (playAllMode) {
      const docN = normalizePlayDocumentV2(doc);
      const total = totalPlayDurationSec(docN);
      const startWall = performance.now();
      const tick = () => {
        const g = (performance.now() - startWall) / 1000;
        if (g >= total) {
          const { phaseIndex, tLocal } = globalTimeToPhaseLocal(docN, total);
          setActivePhaseIndex(phaseIndex);
          setPhaseTimeSec(tLocal);
          setIsPlaying(false);
          setPlayAllMode(false);
          return;
        }
        const { phaseIndex, tLocal } = globalTimeToPhaseLocal(docN, g);
        setActivePhaseIndex(phaseIndex);
        setPhaseTimeSec(tLocal);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    const dur = normalizePlayDocumentV2(doc).phases[activePhaseIndex]!.durationSec;
    const t0 = phaseTimeRef.current;
    const startWall = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startWall) / 1000;
      const t = t0 + elapsed;
      if (t >= dur) {
        setPhaseTimeSec(dur);
        setIsPlaying(false);
        return;
      }
      setPhaseTimeSec(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [activePhaseIndex, doc, isPlaying, playAllMode]);

  const selectedPlayer = selectedSlot ? slice.players.find((p) => p.slot === selectedSlot) : undefined;

  const goPhase = useCallback(
    (k: number) => {
      let next = doc;
      if (k > 0) next = resyncPhaseFromPrevious(doc, k);
      commit(next, false);
      setActivePhaseIndex(k);
      setPhaseTimeSec(0);
      setFocusedSlot(null);
    },
    [commit, doc],
  );

  const onTokenMove = useCallback(
    (slot: AttackingPlayerSlot, nextCenter: NormPoint) => {
      const nextSlice: AttackingPhaseSlice = {
        ...slice,
        players: slice.players.map((p) => {
          if (p.slot !== slot) return p;
          const dx = nextCenter.x - p.position.x;
          const dy = nextCenter.y - p.position.y;
          const pathPoints =
            p.pathPoints.length >= 2
              ? p.pathPoints.map((q) => ({ x: q.x + dx, y: q.y + dy }))
              : p.pathPoints;
          return { ...p, position: nextCenter, pathPoints };
        }),
      };
      commit(replacePhase(doc, activePhaseIndex, nextSlice), false);
    },
    [activePhaseIndex, commit, doc, slice],
  );

  const onCommitStroke = useCallback(
    (slot: AttackingPlayerSlot, stroke: NormPoint[]) => {
      if (stroke.length === 0) return;
      const nextSlice: AttackingPhaseSlice = {
        ...slice,
        players: slice.players.map((p) => {
          if (p.slot !== slot) return p;
          let merged: NormPoint[];
          if (p.pathPoints.length === 0) {
            merged = [p.position, ...stroke];
          } else {
            const base = [...p.pathPoints];
            const last = base[base.length - 1]!;
            const first = stroke[0]!;
            const skipFirst =
              Math.hypot(first.x - last.x, first.y - last.y) < 0.012 ? stroke.slice(1) : stroke;
            merged = [...base, ...skipFirst];
          }
          if (merged.length < 2) return p;
          return { ...p, pathPoints: merged };
        }),
      };
      commit(replacePhase(doc, activePhaseIndex, nextSlice), true);
    },
    [activePhaseIndex, commit, doc, slice],
  );

  const applyChainFromInput = useCallback(
    (raw: string) => {
      setChainInput(raw);
      const chain = parseChainInput(raw);
      const need = Math.max(0, chain.length - 1);
      const passArrivalTimeSec = slice.passArrivalTimeSec.slice(0, need);
      while (passArrivalTimeSec.length < need) {
        const prev = passArrivalTimeSec[passArrivalTimeSec.length - 1] ?? 1;
        passArrivalTimeSec.push(Math.min(slice.durationSec - 0.1, prev + 0.8));
      }
      const nextSlice = normalizePhaseSlice({
        ...slice,
        possessionChain: chain,
        passArrivalTimeSec,
      });
      commit(replacePhase(doc, activePhaseIndex, nextSlice), true);
    },
    [activePhaseIndex, commit, doc, slice.durationSec, slice.passArrivalTimeSec],
  );

  if (loadError) {
    return (
      <div className="playbook-page">
        <p className="error-text" role="alert">
          {loadError}
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/plays')}>
          Back to Canvas list
        </button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="playbook-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="playbook-page">
      <h1 className="sr-only">Canvas play editor</h1>

      <div className="playbook-toolbar">
        <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'undo' })} disabled={state.past.length === 0}>
          Undo
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'redo' })} disabled={state.future.length === 0}>
          Redo
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setFocusedSlot(null);
          }}
        >
          Show all
        </button>
      </div>

      <div className="playbook-row">
        <label className="playbook-label" htmlFor="play-name">
          Name
        </label>
        <input
          id="play-name"
          className="playbook-input"
          value={doc.name}
          onChange={(e) => commit({ ...doc, name: e.target.value }, true)}
        />
      </div>

      <div className="playbook-panel playbook-phases">
        <h2>Phases</h2>
        <p className="playbook-help">
          Five phases play in order. Each phase starts where the last one ended. Edit one phase at a time — switching to phase 2+ snaps player dots to the end of the previous phase.
        </p>
        <div className="playbook-seg playbook-phase-tabs" role="tablist" aria-label="Phase">
          {doc.phases.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={activePhaseIndex === i}
              data-active={activePhaseIndex === i}
              onClick={() => goPhase(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <PlayFieldCanvas
        phase={resolvedPhase}
        snapStep={doc.snapStep}
        displayTimeSec={phaseTimeSec}
        selectedSlot={selectedSlot}
        editMode={editMode}
        focusedSlot={focusedSlot}
        onSelectSlot={(s) => setSelectedSlot(s)}
        onTokenMove={onTokenMove}
        onCommitStroke={onCommitStroke}
        onBackgroundPointerDown={() => setSelectedSlot(null)}
        onRequestFocusSlot={(s) => setFocusedSlot((cur) => (cur === s ? null : s))}
      />

      <div className="playbook-panel">
        <h2>Tools</h2>
        <div className="playbook-seg" role="group" aria-label="Edit mode">
          <button type="button" data-active={editMode === 'select'} onClick={() => setEditMode('select')}>
            Select / move
          </button>
          <button type="button" data-active={editMode === 'draw'} onClick={() => setEditMode('draw')}>
            Draw path
          </button>
        </div>
        <p className="playbook-help">
          Double-tap a player to zoom. In Draw path, pick a jersey or tap a player, then sketch from the token or grass.
        </p>
      </div>

      <div className="playbook-panel">
        <h2>Players (this phase)</h2>
        <div className="playbook-seg" role="listbox" aria-label="Jersey slot">
          {slice.players.map((p) => (
            <button
              key={p.slot}
              type="button"
              data-active={selectedSlot === p.slot}
              onClick={() => setSelectedSlot(p.slot)}
            >
              {p.slot}
            </button>
          ))}
        </div>
        {selectedPlayer ? (
          <>
            <div className="playbook-row">
              <span className="playbook-label">Speed (0–10)</span>
              <input
                className="playbook-slider"
                type="range"
                min={0}
                max={10}
                step={1}
                value={selectedPlayer.speed}
                onChange={(e) => {
                  const speed = Number(e.target.value);
                  commit(
                    mapPhase(doc, activePhaseIndex, (ph) => ({
                      ...ph,
                      players: ph.players.map((x) => (x.slot === selectedPlayer.slot ? { ...x, speed } : x)),
                    })),
                    true,
                  );
                }}
              />
              <output>{selectedPlayer.speed}</output>
            </div>
            <div className="playbook-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  commit(
                    mapPhase(doc, activePhaseIndex, (ph) => ({
                      ...ph,
                      players: ph.players.map((x) =>
                        x.slot === selectedPlayer.slot ? { ...x, startTimeSec: phaseTimeSec } : x,
                      ),
                    })),
                    true,
                  );
                }}
              >
                Set start at scrub time
              </button>
            </div>
            <div className="playbook-row">
              <span className="playbook-label">Starts at</span>
              <output>{selectedPlayer.startTimeSec.toFixed(1)}s</output>
            </div>
            <div className="playbook-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  commit(
                    mapPhase(doc, activePhaseIndex, (ph) => ({
                      ...ph,
                      players: ph.players.map((x) =>
                        x.slot === selectedPlayer.slot ? { ...x, pathPoints: [] } : x,
                      ),
                    })),
                    true,
                  );
                }}
              >
                Clear path
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="playbook-panel">
        <h2>This phase</h2>
        <div className="playbook-timeline">
          <div className="playbook-row">
            <span className="playbook-label">Duration (s)</span>
            <input
              className="playbook-input"
              type="number"
              min={0.5}
              max={120}
              step={0.5}
              value={slice.durationSec}
              onChange={(e) => {
                const durationSec = Math.max(0.5, Math.min(120, Number(e.target.value) || 0.5));
                commit(
                  mapPhase(doc, activePhaseIndex, (ph) => ({ ...ph, durationSec })),
                  true,
                );
              }}
            />
          </div>
          <div className="playbook-time-row">
            <span className="playbook-label">Scrub</span>
            <input
              className="playbook-slider"
              type="range"
              min={0}
              max={Math.max(0.01, slice.durationSec)}
              step={0.05}
              value={Math.min(phaseTimeSec, slice.durationSec)}
              onChange={(e) => {
                setIsPlaying(false);
                setPlayAllMode(false);
                setPhaseTimeSec(Number(e.target.value));
              }}
            />
            <output>
              {phaseTimeSec.toFixed(1)}s / {slice.durationSec.toFixed(1)}s
            </output>
          </div>
          <div className="playbook-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                  setPlayAllMode(false);
                } else {
                  setPlayAllMode(false);
                  setIsPlaying(true);
                }
              }}
            >
              {isPlaying && !playAllMode ? 'Pause' : 'Play phase'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (isPlaying && playAllMode) {
                  setIsPlaying(false);
                  setPlayAllMode(false);
                } else {
                  setActivePhaseIndex(0);
                  setPhaseTimeSec(0);
                  setPlayAllMode(true);
                  setIsPlaying(true);
                }
              }}
            >
              {isPlaying && playAllMode ? 'Pause' : 'Play all phases'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsPlaying(false);
                setPlayAllMode(false);
                setActivePhaseIndex(0);
                setPhaseTimeSec(0);
              }}
            >
              Reset
            </button>
          </div>
          <p className="playbook-help muted">Full play length: {totalDur.toFixed(1)}s (sum of phase durations).</p>
        </div>
      </div>

      <div className="playbook-panel">
        <h2>Possession (this phase)</h2>
        <label className="playbook-label" htmlFor="chain-input">
          Chain (slots)
        </label>
        <input
          id="chain-input"
          className="playbook-input"
          value={chainInput}
          onChange={(e) => applyChainFromInput(e.target.value)}
          onBlur={() => applyChainFromInput(chainInput)}
        />
        <p className="playbook-help">
          Pass times are seconds from the start of this phase only (0–{slice.durationSec.toFixed(1)}s). Dotted lines: passer at release, receiver at catch.
        </p>
        {slice.passArrivalTimeSec.map((t, i) => (
          <div key={`pass-${i}`} className="playbook-row">
            <span className="playbook-label">
              Pass {i + 1} → {slice.possessionChain[i + 1]!} (s)
            </span>
            <input
              className="playbook-input"
              type="number"
              min={0}
              max={slice.durationSec}
              step={0.1}
              value={t}
              onChange={(e) => {
                const v = Math.max(0, Math.min(slice.durationSec, Number(e.target.value) || 0));
                const next = [...slice.passArrivalTimeSec];
                next[i] = v;
                commit(
                  mapPhase(doc, activePhaseIndex, (ph) => ({ ...ph, passArrivalTimeSec: next })),
                  true,
                );
              }}
            />
          </div>
        ))}
      </div>

      <div className="playbook-panel">
        <h2>Snap</h2>
        <div className="playbook-row">
          <label className="playbook-label" htmlFor="snap-toggle">
            Grid
          </label>
          <input
            id="snap-toggle"
            type="checkbox"
            checked={doc.snapStep != null}
            onChange={(e) => commit({ ...doc, snapStep: e.target.checked ? 0.02 : null }, true)}
          />
        </div>
      </div>
    </div>
  );
}
