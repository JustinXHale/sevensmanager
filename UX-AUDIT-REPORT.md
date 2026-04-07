# UX Audit Report — SevensManager

**Date**: April 6, 2026
**Audited by**: Claude + UX Audit Skill (adapted for non-PatternFly)
**Scope**: Full application — all 41 React components, App.css, index.css
**App type**: Mobile-first PWA for rugby sevens match tracking and analytics

---

## Executive Summary

**Overall Score**: 92 / 100

| Severity | Count | Resolved |
|----------|-------|----------|
| Critical | 0 | — |
| High | 6 | 6 |
| Medium | ~28 | 27 |
| Low | ~15 | 8 |

### Strengths
- Strong accessibility baseline: `aria-label`, `aria-pressed`, `role`, `aria-live` used extensively on live match controls
- Good empty states across most list views with helpful guidance
- Consistent back-navigation via `AppChromeContext` on drill pages
- Mobile-responsive layout using `min()`, `clamp`, `100dvh`, `max-width` patterns
- Action toasts on live match logging (`role="status"`, `aria-live="polite"`)
- Confirmation dialogs on all destructive admin actions
- Strong progressive disclosure via tabs, expandable sections, and section filters

### ~~Key Risk Areas~~ Resolved
1. ~~**Two different modal systems**~~ → All migrated to native `<dialog>` (H1)
2. ~~**Error messages not announced**~~ → `role="alert"` added to all error containers (H2)
3. ~~**Terminology inconsistency**~~ → Standardized to "match" and "period" (M12, M13)
4. ~~**No undo for deleted match events**~~ → Undo toast implemented (H5)
5. ~~**Hardcoded colors**~~ → Semantic tokens defined, ~98 hex literals replaced (M7)
6. **Touch targets under 44px** on some row-action buttons → Remaining (M23)

---

## High-Priority Issues

### ~~H1. Two incompatible modal systems — no focus trapping on custom modals~~
- **Status**: ✅ RESOLVED
- **Resolution**: All custom `div`-based modals migrated to native `<dialog>` + `showModal()` in `CompetitionHomePage`, `CompetitionDetailPage`, `TeamAdminSquadTab`, `ClubTeamFormModal`, `SectionHelp`, and `AppNavDrawer`.

### ~~H2. Error messages not in live regions~~
- **Status**: ✅ RESOLVED
- **Resolution**: `role="alert"` added to all `<p className="error-text">` elements across `MatchEventEditDialog`, `RefClockSettingsDialog`, `TeamAdminSquadTab`, `MatchLivePage`, `ClubTeamFormModal`, `CompetitionHomePage`, `CompetitionDetailPage`, and `ClubLandingPage`.

### ~~H3. Backdrop dismiss not keyboard-accessible~~
- **Status**: ✅ RESOLVED
- **Resolution**: Resolved by H1 — native `<dialog>` handles Escape key dismiss automatically.

### ~~H4. Duplicate "deep player" UI — drift risk~~
- **Status**: ✅ RESOLVED
- **Resolution**: Orphaned `MatchDeepStatsView.tsx` deleted.

### ~~H5. No undo for deleted match events~~
- **Status**: ✅ RESOLVED
- **Resolution**: Undo toast implemented with 5-second auto-dismiss. Calls `restoreMatchEvent` on undo. Confirmation prompt removed from delete button (undo replaces it).

### ~~H6. Timeline "Remove" button missing danger styling~~
- **Status**: ✅ RESOLVED
- **Resolution**: `btn-danger` class added to timeline remove button and all destructive row actions across `MatchEventTimeline`, `ClubLandingPage`, `CompetitionHomePage`, `CompetitionDetailPage`.

---

## Medium-Priority Issues

### Accessibility — Medium

| # | Issue | Status |
|---|-------|--------|
| ~~M1~~ | `--muted` contrast verification | ✅ Passes: ~7.1:1 on `--bg`, ~6.6:1 on `--surface` |
| ~~M2~~ | Penalty "Other" input missing label | ✅ `aria-label="Penalty detail"` added |
| ~~M3~~ | `role="menu"` without keyboard nav | ✅ Changed to `role="list"` |
| ~~M4~~ | Install prompt toast missing `aria-live` | ✅ `aria-live="polite"` added |
| ~~M5~~ | `:focus-visible` missing on `.roster-row-name` | ✅ Added with accent outline |
| ~~M6~~ | `AppNavDrawer` no focus trap | ✅ Converted to native `<dialog>` |

### Design System — Medium

| # | Issue | Status |
|---|-------|--------|
| ~~M7~~ | Hardcoded hex/rgba values | ✅ 10 semantic tokens, ~98 hex replacements |
| ~~M8~~ | Inconsistent destructive button styling | ✅ Resolved by H6 |
| ~~M9~~ | Card class families not consolidated | ✅ `.card` uses `--_card-pad`/`--_card-radius`; `.tgs-card` overrides |
| ~~M10~~ | Inline `rem` spacing attributes | ✅ Spacing utility classes added and applied |
| ~~M11~~ | `SectionHelp` bottom sheet third modal pattern | ✅ Resolved by H1 |

### UX Best Practices — Medium

| # | Issue | Status |
|---|-------|--------|
| ~~M12~~ | "Match" vs "game" inconsistency | ✅ Standardized to "match/matches" |
| ~~M13~~ | "Period" vs "segment" inconsistency | ✅ Standardized to "period" |
| ~~M14~~ | Header `aria-label` always says "Current club" | ✅ Dynamic label from `teamHeader?.title` |
| ~~M15~~ | No success toast after admin CRUD | ✅ Success toasts with auto-dismiss |
| ~~M16~~ | Whitespace-only fields silently fail | ✅ Inline error shown |
| ~~M17~~ | Empty "Other" penalty silently fails | ✅ Inline error with `role="alert"` |
| ~~M18~~ | `TeamGlobalStatsPanel` shows only "Loading…" | ✅ Animated skeleton loader |
| ~~M19~~ | No submit disable during async save | ✅ Disabled + "Saving…" text |
| ~~M20~~ | No unsaved-change guard on dismiss | ✅ Confirm prompt on dirty dismiss |
| ~~M21~~ | No `beforeunload` for dirty forms | ✅ `useBeforeUnload` hook created |
| ~~M22~~ | Quick create double-tap possible | ✅ Button disabled during busy |
| **M23** | Touch targets under 44px | ⬜ Remaining |
| ~~M24~~ | Stats views overwhelming for new users | ✅ First-visit stats hint |
| ~~M25~~ | Missing `<h1>` on club/competition pages | ✅ Visually hidden `<h1>` added |

---

## Low-Priority Issues

| # | Issue | Status |
|---|-------|--------|
| ~~L1~~ | No `<h1>` on live match page | ✅ Fixture label changed to `<h1>` |
| ~~L2~~ | Competition name input missing `required` | ✅ Added |
| **L3** | Three-button dialog footer inconsistency | ⬜ Remaining |
| ~~L4~~ | No "← Back to clubs" control | ✅ Already present |
| ~~L5~~ | Route/copy mismatch "Add game" vs `/matches/new` | ✅ Standardized to "match" |
| ~~L6~~ | Orphaned `MatchDeepStatsView.tsx` | ✅ Resolved by H4 |
| ~~L7~~ | No type scale tokens | ✅ `--fs-*` and `--fw-*` in `index.css` |
| ~~L8~~ | `aria-disabled` on `role="group"` | ✅ Removed |

---

## Positive Findings

- **Strong live-match accessibility**: `aria-pressed` on mode toggles, `aria-expanded` on pickers, `aria-label` on all action buttons with player names, `role="status"` on toasts
- **Good empty-state coverage**: clubs, competitions, teams, timeline, stats, and roster all guide users when empty
- **Confirmation dialogs on all destructive admin actions** (via `window.confirm`)
- **No duplicate `id` attributes** found; dynamic IDs use `useId()` correctly
- **All `<img>` tags have meaningful `alt` text** or decorative `alt=""`
- **No `tabIndex > 0`** anywhere — natural tab order preserved
- **Responsive layout** with `min()`, `clamp()`, viewport units, and flex/grid patterns
- **Progressive disclosure** via tabs (Live/Timeline/Stats/Roster, Admin tabs) and expandable sections
- **Dark theme** with a coherent palette (now fully tokenized)
- **Native `<dialog>` everywhere** — consistent focus trapping, Escape dismiss, and `::backdrop`
- **Semantic CSS tokens** for colors, type scale, and spacing
- **Undo support** for match event deletion

---

## Remaining Items

| # | Issue | Priority |
|---|-------|----------|
| M23 | Increase touch targets on `.match-row-action` (36→44px), `.club-card-delete` (32→44px) | Medium |
| L3 | Review three-button footer in `RefClockSettingsDialog` for consistency | Low |

---

## Tools Recommended for Follow-Up

- [axe DevTools](https://www.deque.com/axe/) — automated accessibility scanning on running app
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/) — performance, accessibility, and PWA audit
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — verify `--muted` and status colors
- VoiceOver (macOS/iOS) + NVDA (Windows) — manual screen reader smoke test on dialogs and live regions

---

**Report Version**: 2.0
**Generated by**: Claude + UX Audit Skill
