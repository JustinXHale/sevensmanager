# Changelog

All notable changes to SevensManager are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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

### Removed
- "Quick sub" button from roster header (substitutions already easy inline)
- "Delete competition" button from competition detail page (replaced by inline × on list rows)
- CompetitionSwipeRow component and all associated CSS (dead code after × button migration)
- Static explanatory paragraph on roster page (replaced by interactive help glossary)
