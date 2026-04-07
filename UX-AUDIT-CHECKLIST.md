# UX Audit Checklist — SevensManager

Generated April 6, 2026 from the [UX Audit Report](./UX-AUDIT-REPORT.md).
Track progress by checking boxes as each item is addressed.

---

## High Priority

- [x] **H1** — ~~Migrate all custom `div`-based modals to native `<dialog>` + `showModal()` for focus trapping~~ ✅ All modals migrated
- [x] **H2** — ~~Add `role="alert"` or `aria-live="assertive"` to error containers~~ ✅ Added to all error `<p>` elements
- [x] **H3** — ~~Ensure all custom modals handle `Escape` key; add keyboard dismiss parity for backdrop-close modals~~ ✅ Resolved by H1 (native `<dialog>`)
- [x] **H4** — ~~Remove or integrate `MatchDeepStatsView.tsx`~~ ✅ Orphaned component deleted
- [x] **H5** — ~~Add timed "Undo" toast after match event deletion (use existing `restoreMatchEvent`)~~ ✅ Undo toast with 5s auto-dismiss
- [x] **H6** — ~~Add `btn-danger` class to timeline "Remove" button and all destructive row actions~~ ✅ Applied project-wide

---

## Medium Priority — Accessibility

- [x] **M1** — ~~Verify `--muted` (#8b9cad) contrast ratio against dark backgrounds meets 4.5:1 for normal text~~ ✅ Passes (~7.1:1 on --bg, ~6.6:1 on --surface)
- [x] **M2** — ~~Add `aria-label="Penalty detail"` or `<label>` for "Other" penalty input in `LivePenaltySubpanel`~~ ✅ Added
- [x] **M3** — ~~Replace `role="menu"` with `role="list"` or implement full arrow-key nav in `CompetitionHomePage`, `TeamLivePanel`~~ ✅ Changed to `role="list"`
- [x] **M4** — ~~Add `aria-live="polite"` to install prompt toast in `InstallPrompt.tsx`~~ ✅ Added
- [x] **M5** — ~~Add `:focus-visible` ring to `.roster-row-name` in `App.css`~~ ✅ Added with accent outline
- [x] **M6** — ~~Add focus trap (or convert to `<dialog>`) for `AppNavDrawer`~~ ✅ Converted to native `<dialog>`

---

## Medium Priority — Design System

- [x] **M7** — ~~Define semantic CSS variables (`--border`, `--danger`, `--warning`, `--success`, `--card-bg`) in `index.css`; replace hex literals in `App.css`~~ ✅ 10 semantic tokens added, ~98 hex literals replaced
- [x] **M8** — ~~Use shared `btn-danger` class on `club-card-delete`, `match-row-delete`, `roster-row-remove` buttons~~ ✅ Resolved by H6
- [x] **M9** — ~~Consolidate card class families (`card`, `tgs-card`, `deep-section`, `live-stats-card`, `roster-card`) into a shared pattern~~ ✅ `.card` uses `--_card-pad`/`--_card-radius`; `.tgs-card` overrides
- [x] **M10** — ~~Replace inline `rem` style attributes with utility classes or CSS variables in `MatchStatsPanel`, `TeamGlobalStatsPanel`~~ ✅ Spacing utilities added; inline styles replaced
- [x] **M11** — ~~Convert `SectionHelp` bottom sheet to native `<dialog>` (aligns with H1)~~ ✅ Resolved by H1

---

## Medium Priority — UX Best Practices

- [x] **M12** — ~~Standardize terminology: choose "match" or "game" project-wide; update all strings~~ ✅ "game" → "match/matches" everywhere
- [x] **M13** — ~~Standardize "period" vs "segment" — use one term consistently~~ ✅ "segment" → "period" everywhere
- [x] **M14** — ~~Fix `App.tsx` header `aria-label` to reflect actual entity type (club / competition / team)~~ ✅ Dynamic label
- [x] **M15** — ~~Add success toast/snackbar after admin CRUD operations (create, edit, delete)~~ ✅ Added with auto-dismiss
- [x] **M16** — ~~Show inline error in `ClubTeamFormModal` when required fields are whitespace-only~~ ✅ Error shown
- [x] **M17** — ~~Show inline error in `LivePenaltySubpanel` when "Other" text is empty on submit~~ ✅ Error with role="alert"
- [x] **M18** — ~~Add skeleton or progress indicator for `TeamGlobalStatsPanel` long data loads~~ ✅ Animated skeleton loader
- [x] **M19** — ~~Disable submit buttons during async operations to prevent double-tap (`MatchEventEditDialog`, `RefClockSettingsDialog`)~~ ✅ Disabled + "Saving…" text
- [x] **M20** — ~~Warn on modal backdrop dismiss if form has unsaved changes~~ ✅ Confirm prompt on dirty dismiss
- [x] **M21** — ~~Add `beforeunload` or react-router blocker for dirty forms~~ ✅ `useBeforeUnload` hook created and applied
- [x] **M22** — ~~Disable `openQuickCreate` button during async creation to prevent duplicates~~ ✅ Disabled during busy
- [ ] **M23** — Increase touch targets on `.match-row-action` (36→44px), `.club-card-delete` (32→44px)
- [x] **M24** — ~~Consider adding an onboarding tooltip or progressive reveal for first-time stats viewers~~ ✅ First-visit stats hint with localStorage dismiss
- [x] **M25** — ~~Add `<h1>` heading to `ClubLandingPage` and `CompetitionHomePage`~~ ✅ Visually hidden `<h1>` added

---

## Low Priority

- [x] **L1** — ~~Add semantic `<h1>` to `MatchLivePage` (fixture label is currently a `<p>`)~~ ✅ Changed to `<h1>`
- [x] **L2** — ~~Add `required` / `aria-required` to competition name input in `CompetitionHomePage`~~ ✅ Added
- [ ] **L3** — Review three-button footer in `RefClockSettingsDialog` for consistency with two-button dialogs
- [x] **L4** — ~~Add explicit "← Back to clubs" control in `CompetitionHomePage` header~~ ✅ Already present
- [x] **L5** — ~~Align route `/matches/new` with UI copy ("Add game" → "Add match" or vice versa)~~ ✅ Standardized to "match"
- [x] **L6** — ~~Remove orphaned `MatchDeepStatsView.tsx` if superseded (see H4)~~ ✅ Resolved by H4
- [x] **L7** — ~~Define a type scale (font-size/weight tokens) to reduce one-off values in `App.css`~~ ✅ `--fs-*` and `--fw-*` tokens in index.css
- [x] **L8** — ~~Replace `aria-disabled` on `role="group"` with explicit child button `disabled` in `LivePenaltySubpanel`~~ ✅ Removed

---

## Verification & Tooling

- [ ] Run [axe DevTools](https://www.deque.com/axe/) on live match, admin, and club routes
- [ ] Run [Lighthouse](https://developer.chrome.com/docs/lighthouse/) accessibility + PWA audit
- [ ] Test all dialogs with VoiceOver (macOS) — focus trap, announce, dismiss
- [ ] Measure contrast for `--muted` and status colors with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ ] Test touch targets on mobile device (iPhone SE / small Android)
