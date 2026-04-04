import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type GlossaryEntry = {
  abbr: string;
  full: string;
  desc: string;
};

type Props = {
  title?: string;
  entries: GlossaryEntry[];
};

export function SectionHelp({ title, entries }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (entries.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="section-help-btn"
        aria-label="Show glossary"
        onClick={() => setOpen(true)}
      >
        <svg className="section-help-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && createPortal(
        <div className="bottom-sheet-backdrop" onClick={close}>
          <div
            className="bottom-sheet"
            role="dialog"
            aria-label={title ? `${title} glossary` : 'Glossary'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-sheet-handle" aria-hidden="true" />
            <div className="bottom-sheet-header">
              <h3 className="bottom-sheet-title">{title ?? 'Glossary'}</h3>
              <button type="button" className="bottom-sheet-close" aria-label="Close" onClick={close}>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <dl className="bottom-sheet-glossary">
              {entries.map((e) => (
                <div key={e.abbr} className="section-help-entry">
                  <dt className="section-help-term">{e.abbr}</dt>
                  <dd className="section-help-def">
                    <strong>{e.full}</strong> — {e.desc}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Glossary data keyed by section
// ---------------------------------------------------------------------------

const OVERVIEW_MATCH: GlossaryEntry[] = [
  { abbr: 'Points', full: 'Points', desc: 'Combined score from tries (5 pts each) and conversions (2 pts each). Shown as Us – Opponent.' },
  { abbr: 'Δ', full: 'Point differential', desc: 'The difference between your points and the opponent\u2019s. Positive means you\u2019re leading.' },
  { abbr: 'Tries', full: 'Tries', desc: 'Number of tries scored by each side. A try is worth 5 points.' },
  { abbr: 'Conv. kick %', full: 'Conversion kick percentage', desc: 'Percentage of conversion kicks made out of those attempted, for each side.' },
  { abbr: 'Tackle %', full: 'Tackle completion percentage', desc: 'Percentage of tackles completed successfully: made \u00f7 (made + missed).' },
  { abbr: 'M', full: 'Tackles made', desc: 'Successful tackles where the ball carrier was brought down or held.' },
  { abbr: 'X', full: 'Tackles missed', desc: 'Attempted tackles where the ball carrier broke free or was not stopped.' },
  { abbr: 'Subs', full: 'Substitutions', desc: 'Number of player substitutions made during the match.' },
  { abbr: 'YC', full: 'Yellow card', desc: 'Temporary suspension (sin bin). The player is off the field for two minutes.' },
  { abbr: 'RC', full: 'Red card', desc: 'Permanent sending off. The player cannot return to the match.' },
];

const OVERVIEW_GLOBAL: GlossaryEntry[] = [
  { abbr: 'Games', full: 'Games played', desc: 'Total number of matches with at least one logged event.' },
  { abbr: 'Events', full: 'Total events', desc: 'Sum of all logged events (tries, tackles, passes, etc.) across every game.' },
  { abbr: 'Points (Σ)', full: 'Total points', desc: 'Cumulative points scored and conceded across all games. Shown as Us – Opponent.' },
  { abbr: 'Tries (Σ)', full: 'Total tries', desc: 'Cumulative tries scored and conceded across all games.' },
  { abbr: 'Tackle % (pooled)', full: 'Pooled tackle completion', desc: 'All tackles made \u00f7 all tackles attempted across every game, as a single percentage.' },
  { abbr: 'M', full: 'Tackles made', desc: 'Successful tackles where the ball carrier was brought down or held.' },
  { abbr: 'X', full: 'Tackles missed', desc: 'Attempted tackles where the ball carrier broke free or was not stopped.' },
];

const PHASE: GlossaryEntry[] = [
  { abbr: 'Offense', full: 'Offense time', desc: 'Estimated time your team had possession or was attacking, based on event types logged.' },
  { abbr: 'Defense', full: 'Defense time', desc: 'Estimated time your team was without possession, based on defensive events logged.' },
];

const ZONES: GlossaryEntry[] = [
  { abbr: 'Z1', full: 'Zone 1 \u2014 Own in-goal', desc: 'From your own goal line to roughly the 5 m mark. Deepest defensive territory.' },
  { abbr: 'Z2', full: 'Zone 2 \u2014 Own 5\u201315 m', desc: 'Your own half between the 5 and 15 metre lines.' },
  { abbr: 'Z3', full: 'Zone 3 \u2014 Own 15 m to halfway', desc: 'Your half from the 15 m line up to the halfway mark.' },
  { abbr: 'Z4', full: 'Zone 4 \u2014 Halfway to opp 15 m', desc: 'Opponent\u2019s half from the halfway line to their 15 m mark.' },
  { abbr: 'Z5', full: 'Zone 5 \u2014 Opp 15\u20135 m', desc: 'Deep in opponent territory, between their 15 and 5 metre lines.' },
  { abbr: 'Z6', full: 'Zone 6 \u2014 Opp in-goal', desc: 'From the opponent\u2019s 5 m line to their goal line. Prime scoring territory.' },
  { abbr: 'Σ', full: 'Sum', desc: 'Row total across all six zones.' },
  { abbr: 'Tkl M', full: 'Tackles made', desc: 'Successful tackles logged in each zone.' },
  { abbr: 'Tkl X', full: 'Tackles missed', desc: 'Missed tackles logged in each zone.' },
  { abbr: '(\u2212) plays', full: 'Negative plays', desc: 'Knock-ons, bad passes, forward passes, and other negative actions by zone.' },
  { abbr: 'Pen', full: 'Penalties', desc: 'Team penalties conceded in each zone.' },
];

const INVOLVEMENT: GlossaryEntry[] = [
  { abbr: 'P', full: 'Passes', desc: 'Total passes completed by this player.' },
  { abbr: 'T', full: 'Tackles made', desc: 'Successful tackles completed by this player.' },
  { abbr: 'X', full: 'Tackles missed', desc: 'Tackles attempted but not completed by this player.' },
  { abbr: 'LB', full: 'Line breaks', desc: 'Times this player broke through the defensive line.' },
  { abbr: 'Tr', full: 'Tries', desc: 'Tries scored by this player.' },
  { abbr: 'Neg', full: 'Negative actions', desc: 'Knock-ons, bad passes, forward passes, or other errors committed by this player.' },
  { abbr: 'Pen', full: 'Penalties', desc: 'Penalties conceded by this player.' },
  { abbr: 'D', full: 'Dominant tackle', desc: 'Tackler drove the ball carrier backwards or forced a clear turnover.' },
  { abbr: 'N', full: 'Neutral tackle', desc: 'Ball carrier was stopped but no ground was gained or lost by the tackler.' },
  { abbr: 'Conv.', full: 'Conversions', desc: 'Conversion kicks attempted. M = made, X = missed.' },
];

const RUCK: GlossaryEntry[] = [
  { abbr: 'Median', full: 'Median ruck speed', desc: 'Middle value of all ruck-to-first-pass durations. Lower is faster ball recycling.' },
  { abbr: 'Pairs', full: 'Ruck\u2013pass pairs', desc: 'Number of ruck events that were followed by a pass, used to calculate speed.' },
];

const SET_PIECES: GlossaryEntry[] = [
  { abbr: 'W', full: 'Won', desc: 'Set piece where your team retained or won possession.' },
  { abbr: 'L', full: 'Lost', desc: 'Set piece where your team lost possession to the opponent.' },
  { abbr: 'Pen', full: 'Penalized', desc: 'Set piece where your team conceded a penalty.' },
];

const PENALTIES: GlossaryEntry[] = [
  { abbr: 'Penalties', full: 'Penalty breakdown', desc: 'Team penalties grouped by infringement type, showing which areas need the most discipline.' },
];

const NEGATIVES: GlossaryEntry[] = [
  { abbr: 'Negatives', full: 'Negative action breakdown', desc: 'Errors grouped by type: knock-ons, bad passes, forward passes, and others.' },
];

const SCORING_TIMELINE: GlossaryEntry[] = [
  { abbr: 'Us', full: 'Your team', desc: 'Running point total for your team at each scoring moment.' },
  { abbr: 'Opp', full: 'Opponent', desc: 'Running point total for the opponent at each scoring moment.' },
];

const EVENT_COUNTS: GlossaryEntry[] = [
  { abbr: 'Tries', full: 'Tries', desc: 'Your team\u2019s tries. A try is scored by grounding the ball in the opponent\u2019s in-goal area (5 pts).' },
  { abbr: 'Conversions', full: 'Conversions', desc: 'Kicks at goal after a try. A successful conversion adds 2 points.' },
  { abbr: 'Opp. tries', full: 'Opponent tries', desc: 'Tries scored by the opposition.' },
  { abbr: 'Opp. conv.', full: 'Opponent conversions', desc: 'Conversion kicks made by the opposition.' },
  { abbr: 'Opp. subs', full: 'Opponent substitutions', desc: 'Player changes made by the opposing team.' },
  { abbr: 'Opp. cards', full: 'Opponent cards', desc: 'Yellow or red cards shown to opposition players.' },
  { abbr: 'Passes', full: 'Passes', desc: 'Total pass events logged for your team.' },
  { abbr: 'Line breaks', full: 'Line breaks', desc: 'Times a ball carrier broke through the opposition defensive line.' },
  { abbr: 'Negative plays', full: 'Negative plays', desc: 'Errors: knock-ons, bad passes, forward passes, and similar turnovers.' },
  { abbr: 'Scrums', full: 'Scrums', desc: 'Scrum set-piece events, with won/lost/penalized tracked.' },
  { abbr: 'Lineouts', full: 'Lineouts', desc: 'Lineout set-piece events, with won/lost/penalized tracked.' },
  { abbr: 'Team penalties', full: 'Team penalties', desc: 'Penalties conceded by your team during open play or at set pieces.' },
  { abbr: 'Rucks', full: 'Rucks (breakdowns)', desc: 'Breakdown events after a tackle. Ruck speed is derived from ruck-to-next-pass timing.' },
  { abbr: 'Tackles made', full: 'Tackles made', desc: 'Successful tackles where the ball carrier was brought to ground.' },
  { abbr: 'Tackles missed', full: 'Tackles missed', desc: 'Attempted tackles where the defender failed to stop the ball carrier.' },
  { abbr: 'Substitutions', full: 'Substitutions', desc: 'Your team\u2019s player changes during the match.' },
];

const POINTS_BY_GAME: GlossaryEntry[] = [
  { abbr: 'Points by game', full: 'Points per game', desc: 'Stacked bar showing your points vs opponent points for each match.' },
];

const LINEUP_EFFICIENCY: GlossaryEntry[] = [
  { abbr: 'Score', full: 'Efficiency score', desc: 'Positive contributions minus negative costs, divided by minutes played, scaled 0\u2013100.' },
  { abbr: 'Tr', full: 'Tries', desc: 'Tries scored by this player across all games.' },
  { abbr: 'LB', full: 'Line breaks', desc: 'Line breaks made by this player across all games.' },
  { abbr: 'T', full: 'Tackles made', desc: 'Successful tackles across all games.' },
  { abbr: 'X', full: 'Tackles missed', desc: 'Missed tackles across all games.' },
  { abbr: 'P', full: 'Passes', desc: 'Total passes across all games.' },
  { abbr: 'Neg', full: 'Negative actions', desc: 'Errors (knock-ons, bad passes, etc.) across all games.' },
  { abbr: 'Pen', full: 'Penalties', desc: 'Penalties conceded across all games.' },
  { abbr: 'G', full: 'Games played', desc: 'Number of matches this player appeared in.' },
];

const GAMES: GlossaryEntry[] = [
  { abbr: 'Games', full: 'Games list', desc: 'All matches with logged events. Tap \u201cStats\u201d to open that game\u2019s per-match analytics.' },
];

export const MATCH_GLOSSARY: Record<string, GlossaryEntry[]> = {
  overview: OVERVIEW_MATCH,
  phase: PHASE,
  zones: ZONES,
  involvement: INVOLVEMENT,
  ruck: RUCK,
  setpieces: SET_PIECES,
  penalties: PENALTIES,
  negatives: NEGATIVES,
  scoring: SCORING_TIMELINE,
  numbers: EVENT_COUNTS,
};

export const GLOBAL_GLOSSARY: Record<string, GlossaryEntry[]> = {
  overview: OVERVIEW_GLOBAL,
  points: POINTS_BY_GAME,
  phase: PHASE,
  zones: ZONES,
  ruck: RUCK,
  penalties: PENALTIES,
  negatives: NEGATIVES,
  players: INVOLVEMENT,
  lineup: LINEUP_EFFICIENCY,
  games: GAMES,
};
