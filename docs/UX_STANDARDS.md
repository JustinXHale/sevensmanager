# SevensManager — UX & layout standards

This app uses **custom CSS** (not PatternFly React components) but follows **PatternFly v6 spacing and UX patterns** so the product stays consistent and future PF adoption stays aligned.

**Canonical reference:** [PatternFly — Spacers (v6)](https://www.patternfly.org/v6/design-foundations/spacers) (global tokens: `xs` → `4xl`).

---

## 1. Spacing scale (rem / 16px root)

| Token | CSS variable | rem | px (16px root) | Typical use |
|--------|----------------|-----|----------------|-------------|
| xs | `--pf-t--global--spacer--xs` | 0.25 | 4 | Tight label↔control, icon gaps |
| sm | `--pf-t--global--spacer--sm` | 0.5 | 8 | Related lines in one block, toolbar subtitle |
| md | `--pf-t--global--spacer--md` | 1 | 16 | Page inset, list row gap, filter gaps |
| lg | `--pf-t--global--spacer--lg` | 1.5 | 24 | Card padding, vertical stack between sections |
| xl | `--pf-t--global--spacer--xl` | 2 | 32 | Major section separation |
| 2xl | `--pf-t--global--spacer--2xl` | 3 | 48 | Scroll clearance above sticky footers |

**App aliases** (see `src/index.css`): `--app-inset-page`, `--app-gap-stack`, `--app-gap-tight`, `--app-card-padding`, `--app-list-row-gap`, `--app-list-item-padding`. Prefer these for page-level layout; use raw `--pf-t-*` when mapping to a specific PF guideline.

**Rules of thumb**

- **Title → body:** at least **md** (16px) vertical gap; use **lg** when the next block is a distinct section.
- **List items:** **md** gap between rows; **md** padding inside each row link.
- **Stacked screens:** use **lg** for `.stack` gap so flows aren’t cramped.
- **Sticky footers:** reserve bottom padding = **2xl + xl** + safe-area so content clears the bar (matches PF “inset + action” rhythm).

---

## 2. Navigation & hierarchy

| Pattern | Behavior |
|---------|----------|
| **Competitions home** | Full app header: brand + nav drawer + optional tag line. |
| **Competition detail** | **Drill header:** `←` + competition name; back goes to `/`. |
| **Team hub** | **Drill header:** `←` + team name; back goes to parent competition. `backAriaLabel`: “Back to competition”. |
| **Match live** | **Minimal header:** “← Back” + nav drawer; no duplicate in-page back row. `matchesReturnTo` in location state preserves return path. |
| **Hamburger** | Same drawer on all screens that show it: Competitions, Add game, Import schedule (no global “all matches” list). |

**Consistency:** one primary “up” action in the chrome; avoid duplicate back links in the scroll area unless it’s an error state.

---

## 3. Primary actions & footers

- **Sticky footer** (competitions home, competition detail, team live): **one** primary CTA (e.g. New competition, Add team, Add game). Secondary actions in a **▾** menu where needed.
- **Destructive actions** (delete competition): use a **text link** at the **bottom of the scrollable content**, above the sticky footer — not in the sticky bar unless the pattern is explicitly “danger zone” in admin.

---

## 4. Lists & data

- **Match rows:** fixture title, optional subtitle, kickoff in **user-selected timezone** (default Central), **event count** (“N events logged”).
- **Touch targets:** keep controls **≥ 44px** height where possible (tabs, primary buttons, filter selects).

---

## 5. Forms & modals

- **Modals:** `modal-card` / `card` with `form` + `form-actions`; cancel vs primary aligned to end of form.
- **Filters:** `filter-bar` uses **app card padding** and **md** gaps between fields.

---

## 6. Content & tone

- Prefer **sentence case** for labels and buttons (match existing screens).
- **Confirm** destructive deletes with the same copy pattern as competitions list (teams cascade, matches unlink).

---

## 7. Implementation checklist (when adding UI)

1. Use spacing variables from `src/index.css` — no magic `8px` / `12px` one-offs unless documented.
2. Reuse existing classes: `stack`, `card`, `toolbar`, `match-list`, `competitions-sticky-footer`, drill tabs (`live-tab-strip`).
3. Add drill/minimal chrome via `useAppChrome()`; set `backAriaLabel` when the default “Go back” is wrong.
4. If introducing a **new** page type, add a short subsection here and mirror spacing in `App.css`.
5. **Zone flower / live tagging colors:** follow §8; update `docs/UX_STANDARDS.md` and `App.css` when adding new semantic colors.

---

## 8. Live match — zone flower color language

The **radial “flower” HUD** (location → area → optional rings) uses color to reinforce meaning. **Implementation:** CSS classes in `src/App.css` (prefix `live-zone-flower-pill--`); **Area** class names are listed in `FIELD_LENGTH_BAND_PILL_CLASSNAMES` in `src/domain/matchEvent.ts` (order matches `FIELD_LENGTH_BAND_IDS`).

### 8.1 Area ring (pitch length: 22 · H · OH · O22)

Team-relative bands. **Own territory = reds** (pressure / defense); **attacking territory = greens**.

| Band | Label (short) | Meaning | Color role |
|------|----------------|--------|--------------|
| `own_22` | 22 | Inside own 22 | **Danger red** — darker / higher urgency |
| `own_half` | H | Own half (out toward halfway) | **Standard red** |
| `opp_half` | OH | Opponent half | **Green** |
| `opp_22` | O22 | Opponent 22 | **Stronger green** (attacking “red zone”) |

Hover/selected states keep the same hue family (not the generic accent green used for P1–P6 selection).

### 8.2 Pass / line break: Standard vs Offload first, then location / area / quality

**Pass** and **line break** open with **Standard** and **Offload** as the **first** step (before Location and Area). **Standard** completes after **Area** with no offload quality. **Offload** adds a final ring for **Neg / Neu / Pos** after **Area** (same colors as §8.3).

### 8.3 Tackle quality & offload quality rings (three-way scales)

Where the UI offers **three** outcomes (negative / neutral / positive or passive / neutral / dominant):

| Role | Color |
|-----|--------|
| Negative / passive | **Red** (`--tone-bad`) |
| Neutral | **Gray** (`--tone-mid`) |
| Positive / dominant | **Green** (`--tone-good`) |

### 8.4 Roster status tags

Player status in the roster uses a three-state color scheme consistent with the semantic tone scale:

| Status | Color | CSS class | Hex |
|--------|-------|-----------|-----|
| **On** (on field) | **Green** | `.roster-tag--on.roster-tag--active` | `#7cb342` (accent) |
| **Bench** (available) | **Amber** | `.roster-tag--bench.roster-tag--active` | `#f59e0b` border / `#fbbf24` text |
| **Off** (unavailable) | **Red** | `.roster-tag--off.roster-tag--active` | `#ef4444` border / `#f87171` text |

Inactive (unselected) tags use the default muted border and text color.

### 8.5 New colors or new rings

If a future flow needs **additional** semantic colors (or a new radial step), **decide explicitly** with design/product before adding — avoid one-off hex in components without updating this section and `App.css`.

---

## 9. References

- PatternFly v6 — Spacers (design foundations)
- PatternFly — Typography (line height / text spacing) for dense text blocks
- This project: `src/index.css` (tokens), `src/App.css` (layouts)
