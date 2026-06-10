# Changelog

All notable changes to SevensManager are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Match **Stats** set pieces: tap scrums, lineouts, and restarts (not rucks) to expand event timestamps in Full, Tally, and One Tap views
- **AI coaching insights**: LiteMaaS / LiteLLM connection in **Settings** (API key, base URL, model); **Generate insights** on match **Stats** and team **Global stats** Inferred insights sections with cached results
- **Inferred insights**: tap any metric for plain-language meaning, formula, how to read it, and underlying log entries (single match)
- Match **Stats** (Full / One Tap) and team **Global stats**: attack pass count and opponent pass count in Overview, Event counts, and Inferred insights
- Match and team **Inferred insights**: ruck contest speed, line-break→try %, attack ruck won %, system moment rate, turnover balance, penalty net by phase, pass chain length, opp pass pressure, possession swings, scoring drought/burst, restart receive %, and error clusters
- **Offense / Defense** playing time excludes dead time between try→conversion and conversion→restart
- Team **Global stats**: **System moments** total in Overview (and per-match count on Points by match); respects match filter
- Team **Global stats**: **Match** dropdown to filter all sections to a single game (or all games pooled)
- Team **Match** tab: **×** on each match card deletes the match after confirm (roster, clock, and all events)
- Tally and One Tap: **★ Star moment** button — bookmarks match + film clock for footage review; starred rows on Timeline show film time (filter **Starred moments**)
- Tally **Attack**: filled gold **System Moment** circle at end of counter grid — logs positive attack system plays with match + film clock for timeline review
- Match **Stats** (Tally / One Tap / Full): **Film bookmarks** section with starred + system moment counts, expandable event lists with film times, and scrub list sorted by film clock; Tally Attack card includes system moment count
- Tally **Defense**: gold **Forced Turnover** circle at end of counter grid; set-piece strip reordered **Restart → Ruck → Scrum → Lineout**
- Tally **Attack**: **Neg** and **Knock On** circles styled red; Knock On logs `knock_on` negatives separately; Stats Attack splits Neg vs Knock-ons
- Tally set-piece strip: **Restart** label shows **(Receiving kick)** in Attack and **(Kicking off)** in Defense
- Tally / One Tap **Ruck** W/L: two-tap flow — **Con** (contested) or **Unc** (uncontested) before logging
- Tally / One Tap set-piece **P+** / **P−**: contextual infraction lists per restart/ruck/scrum/lineout, optional YC/RC, then auto-logs won/lost (ruck P+/P− also contested); open-play **Pen +** / **Pen −** keep phase-based lists
- Set-piece **P+ / P−** infraction lists aligned: P+ = opponent errors, P− = our errors; ruck attack/defense split (e.g. attack P−: holding on / hands / off feet; defense P−: not releasing / not rolling away); scrum + lineout + restart lists expanded
- Tally / One Tap **Defense**: **Pass** circle tracks opponent passes against us; Stats Defense shows **Opp passes**
- Tally mode: **Try** and **conversion** (Made/Missed) prompt to pick scorer/kicker from the on-field roster
- One Tap player rows: green **!** (penalty awarded) alongside red **!** (penalty conceded); attack/defense-specific infraction lists in the penalty picker

### Fixed
- Live clock **−5s / +5s** nudge no longer pauses the match timer when the clock is running
- Clock settings **Apply film sync** updates video time only (no match-clock validation); main Apply skips match/period when unchanged; cancel clears stale error banner
- Tally penalty picker types: `TallyPenaltyInfractionPick` and set-piece strip `SetPiecePenaltyContext` typing so production `tsc` build passes

### Added
- Tally / One Tap **auto phase switch**: Attack / Defense tab flips on possession turnovers (penalties, forced turnover, set-piece W/L); tries wait until conversion is logged, then switch to Attack for kickoff receive
- Clock settings **Film / video sync**: set video time at match 0:00 (e.g. 0:48) so starred moments and film bookmarks match your player timeline
- Live match clock shows **video time in parentheses** beside match time when a film offset is set (e.g. `3:45 (4:33)`)
- **Halftime footage sync**: wall-clock elapsed during HT is banked on Resume match and added to video times (footage that does not cut at halftime)
- Clock settings **Video time right now** and **Apply film sync** — set player time (e.g. type `1014` for 10:14) without touching match clock; fixes parentheses and film bookmarks

### Fixed
- **LiteMaaS client** reads `reasoning_content` / multipart `content` from Qwen-style models so connection test and insights no longer fail with “empty response” when auth succeeded
- **Settings** LiteMaaS test connection on localhost uses a built-in dev proxy to avoid browser CORS blocks; clearer errors when deployed without CORS

### Changed
- **AI coaching insights** moved to the top of match **Stats** and team **Global stats** (above Overview / Inferred insights)
- **Event timeline** Edit dialog: change set-piece outcome (W/L, penalized, free kick), restart depth, ruck contest, tackle result, negative play type, and penalty awarded/conceded — not just time and zone
- **Settings** API key field includes show/hide toggle to verify pasted key
- **Event timeline** and stat drill-down lists show footage time in parentheses beside match time when film sync is configured
- **Inferred insights** expanded metrics: full-width mobile layout and dark-theme styling aligned with match stat cards
- Team **Global stats**: Overview, Inferred insights, Penalties, and Negatives support tap-to-expand event lists (all games or single-match filter); multi-match lists show opponent label per event
- **Inferred insights**: clearer labels (opp pass rate vs minutes defending, costly knock-ons, penalty breakdowns); expanded section glossary
- **Ruck speed**: attack and defense tables show total rucks, contested/uncontested, W/L, won %, and median speed per contest type
- **Pass to pass**: +1s added to every pass-to-pass pair (catch + pass logging offset)
- **Ruck speed**: +2s added to each ruck-to-pass duration to offset multi-step ruck logging before the event is stamped
- Match and team **Ruck speed**: attack and defense medians calculated separately (game median kept); new **Pass to pass** timing for consecutive passes only (skips pass → line break, etc.)
- Tally / One Tap set-piece **FK**: third layer **Them** / **Us** (who erred); logged as FK to us vs FK to them; timeline shows fault; receiving restart hints common case
- Tally / One Tap **set-piece strip**: layered full-size circles — pick Restart/Ruck/Scrum/Lineout, then W/L/FK/P+/P−, then ruck contested or penalty infractions
- Match **Roster**: no cap on players on field — on-field zone turns red when more than 7 (regulation warning only)
- Event **Timeline**: attack events use green-tinted cards, defense events use orange-tinted cards (★ starred moments stay gold)
- Clock settings **Film / video sync** section: left-aligned labels, full-width inputs, and Apply film sync button
- Clock settings time fields accept **digits-only** on the number pad (e.g. `1048` → `10:48`) so film sync works without typing a colon
- Clock settings: **Period** moved below time fields and uses a dropdown (avoids mobile keyboard opening on dialog open)
- Live match layout: fixture title and event count moved into the app header; **★** star button inline with tracking mode switch; tighter tab strip — more tally controls visible without scrolling
- Tally set-piece strip: each row is label left + W/L/FK/P+/P− circles right (one line per restart/ruck/scrum/lineout) instead of stacked title and button rows
- Tally **Pen −** / **Pen +**, set-piece **P−** / **P+**, and One Tap awarded **!**: red for conceded, gold for awarded (fixed Pen − inheriting green accent border)
- Tally and One Tap: **Try conceded** (and opponent conversion prompt) moved from Opp tab to **Defense**; Opp tab is subs and cards only
- Live match **End match (FT)** — tool-row button with confirm; pauses clocks, full-time overlay with final score, **Copy summary**, and **Resume match**; navigates to Stats tab; works in any period (e.g. lightning abandonment)
- Tally / One Tap **set-piece circles** — shared `TallySetPieceStrip` with W / L / FK / Pen+ / Pen− per lineout, restart, ruck, and scrum; Pen+ logs won + penalty awarded, Pen− logs lost + penalty conceded
- **`penaltyDirection`** on `team_penalty` events (`conceded` | `awarded`); Tally standalone **Pen −** / **Pen +** counters (no infraction picker)
- Tally **stats** — scoreboard (points, tries, tries conceded), attack/defense split with offloads, conversion made/missed, penalties by phase, and set-piece W/L/FK/Pen bars per phase
- Match stats panel **Copy summary** button (clipboard via `buildMatchSummaryText`)

### Fixed
- Match roster now syncs from the team admin **master roster** (`syncMatchRosterFromTeam`): all squad members appear with names and jerseys; empty default #1–#13 seed rows are removed; jerseys 1–7 on field / 8–13 bench on first sync; updates when opening match live or roster tab

### Changed
- Full-time overlay: larger centered final score with team names under each score; shown on Tracking tab only so Stats/Timeline/Roster stay reachable; compact full-time bar on other tabs; **Copy summary** removed from overlay (still on Stats tab)
- Match **Roster** tab: drag-and-drop board with On field / Bench / Off zones; side-by-side ▴▾ reorder controls and drop-on-row positioning for custom on-field order (e.g. 8, 2, 5, 7), persisted to match session for live tracking
- Tally mode penalties replaced infraction picker with awarded/conceded counters; One Tap set pieces use the same circle strip as Tally
- Tracking and stats mode switchers reordered **Tally → One Tap → Full**; **Tally** is the default for new matches
- Team admin **Squad** tab: **×** remove button on each player row (no need to open Player details)

### Added
- **Canvas** (`/plays`, `/plays/:id`): local attacking-play editor — quarter-field SVG, seven numbered tokens, solid run paths, dotted pass preview, possession chain + pass times, timeline scrub/play, snap grid, undo/redo, IndexedDB persistence; **Canvas** link in the nav drawer
- **Nav drawer overhaul**: removed Add match / Import schedule; new layout with icons, divider, and two groups (navigation + utility); items: Clubs, Recent match (conditional shortcut to last-visited match), Glossary, Settings, Profile (disabled / coming soon), Other projects, About
- **Glossary page** (`/glossary`): aggregates all abbreviation data (tracking, match stats, global stats) into a single scrollable grouped reference
- **Settings page** (`/settings`): stub with coming-soon placeholder for future preferences
- **Other projects** bottom sheet: links to RefLog and Referee IQ (coming soon); also added as a section inside the About sheet
- **Recent match** nav shortcut: stores last-visited match ID and opponent label in `localStorage`; shows a contextual link in the nav drawer
- Live match **Restart** chip (next to Scrum / Lineout / Ruck): zone → kick depth (10m / 22m / dead) → outcome (Won / Lost / Free kick); logs `restart` events with `restartKickDepth` for kick vs receive from Attack/Defense mode
- Set-piece outcomes: **Free kick** (FK) on scrum, lineout, and ruck flowers between Lost and Penalized; analytics and bars include a free-kick segment
- **One Tap tracking mode** uses dedicated `SimplePlayerActions` component with true single-tap counters (P / O / LB / Tr / Neg in attack, M / X in defense) and simple W / L buttons for set pieces — no zone flower pickers; pass differentiates standard (P) vs offload (O) via `passVariant`
- **Tally tracking mode** — team-level counters with no player attribution; circular tap buttons for Pass / Offload / Line Break / Try / Negative (attack) and Tackle Made / Tackle Missed (defense); inline Made / Missed conversion prompt after a try; full penalty panel; W / L set-piece strip; opponent tab unchanged; stats show grouped Attack / Defense / Set pieces cards
- Quick-start scaffold (`clubScaffold.ts`) — **Generic** competition, **Team A** (default sevens roster), and a default match vs **Opponents**; runs after **Quick create** on the competitions page (▾ menu) and after saving a **new club**, then navigates into the new competition
- About section in the navigation drawer — bottom sheet with app description, version (pulled from package.json at build time), creator bio, and copyright
- `useBeforeUnload` hook — warns on tab close when competition create/edit modals or the club form have unsaved text
- Spacing utility classes (`.mt-*`, `.mb-*`), skeleton loader styles, and first-visit stats tip (`.stats-hint`) in App.css
- Match stats panel: dismissible first-visit tip for the section dropdown; global stats loading state uses skeleton placeholders
- Match live timeline: undo toast after removing an event (soft-delete + restore); `.undo-toast` styles in App.css
- `.sr-only` utility for visually hidden accessible headings; screen-reader `<h1>` on Clubs landing page
- CSS type scale (`--fs-*`) and weight (`--fw-*`) tokens in `index.css` `:root`
- App branding — `public/7smanager.svg` used as favicon, PWA icon, and logo in the main header (bundled `?url` for reliable paths), drill/minimal headers, and the navigation drawer
- PWA install prompt — Chromium/Android shows Install / Not now using `beforeinstallprompt`; iOS Safari shows a short Add to Home Screen tip; each dismiss snoozes 30 days; banner sits above the update toast when both appear
- Stats glossary help icons — info (ⓘ) button next to every section title in both per-match and global stats; opens a bottom sheet with full names and descriptions for all abbreviations (M, X, LB, Tr, Pen, YC, Z1–Z6, etc.)
- PWA update prompt — toast notification appears when a new version is deployed; users tap "Reload" to update on their own schedule
- Edit pencil button on team rows (competition detail page) with rename modal
- Confirmation dialog before removing a player from a live match roster
- Confirmation dialog before removing a gameday timeline schedule item
- Competition date fields (start date, end date) with native calendar selectors
- Competition location field (city/state)
- Edit pencil on competition rows with bottom-sheet edit modal
- Delete buttons (visible ×) on club, competition, and team rows
- Cascading deletes for clubs (removes child competitions) and competitions (removes child teams)
- Bottom-sheet modal pattern — all modals now slide up from the bottom
- Roster section help glossary (replaces static paragraph)
- Weigh-in mass-loss color coding — green for normal range, red when exceeding 2% threshold
- Comprehensive demo weigh-in data for both sample teams (all 13 players each)
- Second demo competition (Club Nationals) alongside Bloodfest Sevens
- Team abbreviation fields on match records — auto-filled from club for scoreboard display
- Opponent abbreviation input on new-match form
- GitHub Actions deploy workflow for GitHub Pages
- PWA manifest and service worker via vite-plugin-pwa
- MIT License

### Changed
- **Canvas** (`/plays`): play document is now **five chained phases** (each with its own duration, scrub, paths, and possession); phases 2–5 snap player dots from the end of the previous phase; **Play all phases** runs the full sequence; v1 saved plays migrate to v2 on load; dotted pass lines and ball-in-flight still use release→catch anchors; draw mode can start from a token
- **Settings** nav item disabled with "Coming soon" badge (matches Profile); route kept as a safety net for bookmarks
- Recent match nav shortcut cleared automatically when a match is deleted (`clearRecentMatchIfStale`)
- Stats tab: three-way **Full / One Tap / Tally** toggle (rounded, matching the Tracking tab style) with section dropdown below the title row; unified title "Match stats" across all modes; help icon sits inline with the title
- Match **One Tap** stats: overview, grouped Attack / Defense / Set pieces event-count cards, Scoring by player, and Involvement (per-player breakdown without tackle quality); tracking mode persists per match in `sessionStorage`
- Match **Tally** stats: grouped Attack / Defense / Set pieces event-count cards only — no player detail, no zones, no scoring-by-player
- About sheet: updated name to Justin X. Hale; added Other projects section (RefLog link + Referee IQ coming soon) before the copyright
- Card padding/radius consolidated via `--_card-pad` / `--_card-radius` on `.card`, with `.tgs-card` overriding padding only; inline rem margins on stats panels replaced with spacing utilities (M9/M10 UX audit)
- Semantic CSS color tokens in `index.css` (`--border`, `--danger`, `--overlay-bg`, etc.); `App.css` uses `var(--bg)`, `var(--text)`, `var(--border)`, and related tokens instead of repeated hex literals (M7 UX audit)
- UX/accessibility audit: `role="alert"` on inline error text; destructive actions use `btn-danger`; clock/event edit dialogs disable primary actions and show progress while saving; install toasts use `aria-live="polite"`; Team live panel dropdown uses `role="list"`; main header team block `aria-label` reflects current title; roster name buttons get `:focus-visible` outline; “game/segment” copy standardized to “match/period” across nav, stats, squad, and clock UI; Other penalty requires description with inline error; global stats matches list glossary key renamed for consistency
- Modals and overlays (competition/team admin, club form, roster add-player, glossary bottom sheet, nav drawer) use native `<dialog>` with `showModal()` for focus trap, Escape, and `::backdrop`
- Match live page: fixture label uses `<h1 class="live-compact-title">` instead of `<p>`
- Timeline “Remove” no longer uses `window.confirm` (undo toast replaces confirmation)
- OnFieldPlayerActions: removed `aria-disabled` from penalty card `role="group"` (child buttons keep `disabled`)
- Navigation drawer: drawer head uses a top-aligned grid so the logo and close control share the same top edge
- Navigation drawer: larger logo (~9rem, ~3× the prior size) and no “Navigate” label
- Shell header and nav drawer show the logo only (no “SevensManager” wordmark); home link keeps an accessible name via `aria-label`
- Removed unused `public/favicon.svg` — favicon and PWA use `7smanager.svg` only
- Main header logo scaled up (~5rem) so it reads about twice the wordmark height; drill/minimal headers use a slightly larger compact mark
- Section titles now always visible on stats cards (previously hidden when viewing a single section via the dropdown)
- SW registration moved from vanilla `registerSW` in main.tsx to React `useRegisterSW` hook (enables the update prompt)
- Landing page renamed from "Teams" to "Clubs" to clarify hierarchy (clubs → competitions → teams)
- All "Team" copy in club create/edit modal updated to "Club" (title, field labels, aria, submit button)
- App header aria-labels updated from "team" to "club"
- Error messages in CompetitionHomePage and clubsRepo updated to say "Club not found"
- Team row subtext changed from "Open for admin" to "Updated &lt;date&gt;"
- Demo data genericized — "Huns" → "Hellraisers", "South Bay RFC" → "Sofia's Princesses", "Coastal 7s" → "Bloodfest Sevens"
- Test fixtures updated to remove all "Huns" references
- Roster page redesigned to compact single-row layout with inline jersey number, name, and status tags
- Status tags color-coded: green (On), amber (Bench), red (Off)
- Scoreboard timer layout fixed — edit button no longer wraps to next line
- Roster page uses full width (matches tracking page indentation)
- Tackle chart empty state improved from "—" to "No tackle outcomes recorded yet."
- Touch targets for `.btn-small` and 3/4-column tab strips bumped from 40px to 44px (WCAG 2.5.8)
- Sample data load stays on competitions page instead of auto-navigating into a single competition

### Fixed
- PWA update toast now appears reliably: switched from `autoUpdate` to `prompt` so the new service worker waits for user confirmation; added hourly update checks
- One Tap stats now correctly show **only the overview** section; zone heatmap, phase split, ruck speed, and other detail sections that depend on zone data are hidden
- Club edit modal no longer shows "Discard unsaved changes?" prompt when opened without making any changes (isDirty compared against initial values in edit mode)
- Native `<dialog>` CSS uses `[open]` / `:not([open])` selectors so closed dialogs are properly hidden instead of rendering inline
- Added missing `.success-toast` CSS styling for admin CRUD success messages

### Removed
- "Quick sub" button from roster header (substitutions already easy inline)
- "Delete competition" button from competition detail page (replaced by inline × on list rows)
- CompetitionSwipeRow component and all associated CSS (dead code after × button migration)
- Static explanatory paragraph on roster page (replaced by interactive help glossary)
