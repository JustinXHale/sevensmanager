# Changelog

All notable changes to SevensManager are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
- Stats tab: three-way **Full / One Tap / Tally** toggle (rounded, matching the Tracking tab style) with section dropdown below the title row; unified title "Match stats" across all modes; help icon sits inline with the title
- Match **One Tap** stats: overview, grouped Attack / Defense / Set pieces event-count cards, Scoring by player, and Involvement (per-player breakdown without tackle quality); tracking mode persists per match in `sessionStorage`
- Match **Tally** stats: grouped Attack / Defense / Set pieces event-count cards only — no player detail, no zones, no scoring-by-player
- About sheet copy — first-person story: coaching return, live analytics when video isn’t available, open source, refereeing background in brief, family, and design work at Red Hat
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
