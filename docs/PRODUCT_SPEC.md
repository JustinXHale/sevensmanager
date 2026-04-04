# SevensManager — Product specification (source of truth)

**Status:** Draft v2  
**Last updated:** 2026-04-02  
**Owner:** Justin  

This document is the **single source of truth** for what the rugby sevens analytics app is, who it’s for, and what belongs in v1 versus later. Implementation details (framework, folder layout) live elsewhere; this file answers **what** and **why**.

**Related:** **[`IMPLEMENTATION_SPEC.md`](./IMPLEMENTATION_SPEC.md)** — stack, data conventions, phased build guide, and MVP acceptance traceability. If the two conflict, **this product spec wins**.

---

## 1. Product intent

Build a **lightweight, real-time-friendly** tool for a **coach** to log match events during rugby **sevens**, with enough structure to support **basic analytics** (counts, zone-linked sequences, roster context) without the overhead of video, scouting, or full cloud features in the first release.

**Primary platform:** Web **PWA**, **Android-first** (sideline / bench), **iOS** secondary.

---

## 2. Primary user and context

| Item | Decision |
|------|----------|
| **Primary user** | Coach running analytics (same person operating the app during play when needed) |
| **Environment** | Live matches; **unreliable Wi‑Fi** is expected → **offline-capable** behavior is important |
| **Device** | Phone or small tablet; touch-first, fast taps |

---

## 3. Sport model (rugby sevens)

| Item | Decision |
|------|----------|
| **Players on field** | 7 per team |
| **Replacements** | Up to **5** per team (World Rugby sevens squad rules) |
| **Roster UX** | Must support **who is on the pitch**, **subs**, and **substitution events** in line with sevens constraints |

*Exact competition rules (sin bin, injury replacements) can be layered later; v1 should not block on edge cases.*

### 3.1 Team scope (v1)

| Item | Decision |
|------|----------|
| **Managed roster** | **Own team only** — one **12-player squad** (7 starters + 5 subs) **your** club per match. |
| **Opponent** | **Label + score** — no opponent roster in v1. **Opp** tab logs **opponent try / conversion** (zone + made–missed), **substitution**, and **yellow/red cards**; clock **score** matches **logged** tries and conversions (same idea as your team). |
| **Events** | Tries, tackles, passes, rucks, etc. refer to **your** players (and your team’s outcomes). |

World Rugby still has two teams on the pitch; the app **does not** model the opponent’s 7+5 in v1.

---

## 4. MVP scope (v1) — must ship

These are **required** for the smallest version that still feels “worth it”:

1. **Rosters** — one squad per match: on-field vs bench, substitutions (see §3.1).
2. **Tries** — log tries with **your** player + **zone** where possible (see §5).
3. **Tackles** — log tackles with **made / missed** minimum; optional detail later (see §15.1).
4. **Passes** — at minimum **counts**; richer modeling (from/to zone, passer/receiver) as UX allows.
5. **Passes leading to rucks** — **Ruck** is a first-class event; link to preceding pass per §15.1.
6. **Match container** — create/select matches; sort/organize list (see §6).
7. **Time model** — **period** + **match clock** (see §7).
8. **Field location — zones** — **six** **team-relative** zones; flow **zone → player → action** (see §5).

---

## 5. Zonal tagging UX (core interaction)

**Goal:** Support narratives like: *pass from zone A to zone B → receiver in zone B scores* — and **zone-based analytics** (where play concentrates, try origins by zone).

### 5.1 Team-relative orientation (v1 default)

Zones are **team-relative**: the UI always shows **attack left → right** (toward the opponent’s goal). The **same physical ground** is mapped consistently so analytics aggregate across matches regardless of which side the team defended in real life.

### 5.2 Zone map (v1 — stable IDs)

**Six zones** along the long axis from **own goal line toward the opponent goal line**:

| ID | Description (attack →) |
|----|-------------------------|
| **Z1** | Own in-goal / ~0–5 m from own goal line |
| **Z2** | ~5–15 m, own half |
| **Z3** | ~15 m to **halfway** (own side) |
| **Z4** | **Halfway** to ~15 m into opponent half |
| **Z5** | ~15–5 m in opponent territory |
| **Z6** | ~5 m to opponent goal line / in-goal |

ASCII (conceptual; exact drawing in UI may vary):

```
Own goal                                              Opp goal
   |----Z1----|----Z2----|----Z3----|----Z4----|----Z5----|----Z6----|
        attack direction (team-relative) --------------->
```

Store events with **`ZoneId` = `Z1` … `Z6`** — never raw pixel coordinates.

### 5.3 Interaction pattern (target)

1. User taps a **zone** (when location matters for the action).
2. User taps a **player** on **your** squad.
3. App presents **actions** appropriate to context (pass, tackle, try, ruck, etc.).

### 5.4 Out of scope for v1

- **Meters gained**, precise distance to goal, and similar **continuous** measures — **post-v1** (see §15.2). No POC in v1 unless explicitly pulled into a later phase per [`IMPLEMENTATION_SPEC.md`](./IMPLEMENTATION_SPEC.md).

---

## 6. Match list, metadata, and organization

**Match fields (v1):**

| Field | Required | Notes |
|-------|----------|--------|
| **Title** | Recommended | e.g. internal label for the fixture (pool/game name) |
| **Our team name** | Optional | label for **your** side on the fixture (“Us vs Them” with opponent) |
| **Our abbreviation** | Optional | short scoreboard label (e.g. "NSR"); auto-filled from club record when a team is linked |
| **Opponent name** | Optional | string; display on list/cards |
| **Opponent abbreviation** | Optional | short scoreboard label for the opponent (e.g. "EEM"); entered per match |
| **Kickoff date** | Optional | for **sorting** and browsing |
| **Location** | Optional | pitch, venue, or city (manual or CSV `location` / `venue` / etc.) |
| **Competition / tag** | Optional | e.g. tournament name |
| **Created timestamp** | System | for default sort when kickoff missing |

**Organization:** Sort/filter by **date**, **title**, and **competition** as available.

### 6.1 Tournament / schedule preload

Coaches may **paste CSV** (e.g. exported from a spreadsheet) so a **tournament schedule** is preloaded: each row becomes a saved match with metadata, visible on the **match list**. Alternatively, coaches may **add games one at a time** with the same fields (manual schedule building). The coach opens a match from the list to run the clock and (later) log events. Import is **local-only** (IndexedDB). Row shape aligns with the fields above (`ourTeamName`, `opponentName`, `kickoffDate`, `location`, `competition`, optional `title`); the first line is column headers.

**Reference implementation (internal):** RefLog (`AppDevelopment/refLog`) — match list, metadata, session state (`matches_repo.dart`, `MatchSessionState`). Reuse **ideas**, not necessarily code.

---

## 7. Timer, period, and clock

| Rule | v1 decision |
|------|-------------|
| **Periods** | **Two** halves: period **1** = 1st half, period **2** = 2nd half. |
| **Clock** | **Elapsed time** tracked **per period** — switching period resets or stores segment as implementation chooses; **total correlation** of events to **match time** is required. |
| **Run/pause** | User can **start**, **stop**, and **adjust** clock enough to align with real play after stoppages. |
| **Display default** | Typical sevens **7 minutes** per half as **default label**; **editable** duration or override may come in a later version — not blocking for v1. |

RefLog’s richer timers inform **behavior** only; SevensManager stays simpler (period index + elapsed per period).

---

## 8. Explicitly out of scope (v1)

| Excluded | Notes |
|----------|--------|
| **Video** | No sync to footage in v1 |
| **Cloud sync** | Not required for v1 |
| **Opponent scouting** | Not in v1 |
| **Opponent roster** | Not in v1 (see §3.1) |
| **Heavy export** | CSV/workbook not a v1 requirement |
| **Multi-coach live collaboration** | Future (Firebase); see §10 |
| **Share beyond clipboard** | No share links, no backend-backed share in v1 (see §9) |

---

## 9. After the match (v1 vs later)

| Need | v1 stance |
|------|------------|
| **Export** | Not a v1 goal |
| **Share** | **Deferred** beyond an optional **“copy match summary to clipboard”** in a late phase — no URLs, no accounts for sharing in v1 |
| **Edit/delete events** | **Minimal** edit/delete or undo — mistakes on sideline (detail in implementation spec) |

---

## 10. Data and infrastructure

| Layer | Direction |
|-----|-----------|
| **v1** | **Local-first** — all core data on device; works **offline** during bad Wi‑Fi |
| **Later** | **Firebase** (or similar) for **free-tier backup**, optional **multi-coach** view of same match |

**Migration path:** Design local schemas and IDs so they can **sync upward** later without a big rewrite.

---

## 11. Success criteria

v1 succeeds if:

1. It **works reliably** during real matches (offline, fast enough to keep up).
2. It produces **analytics the coach actually uses** to prepare and debrief — not just a log dump (see §12).
3. It proves the **zone → player → action** loop is usable at game speed (may iterate after first field test).

---

## 12. Minimum analytics surface (v1)

The app must surface **at least** the following (in-app; no export required):

| Output | Description |
|--------|-------------|
| **Totals** | Counts of **tries**, **passes** (total), **tackles** (total), **rucks** (total) for the match |
| **Tries by zone** | Breakdown or list so the coach sees **where tries originated** (using `ZoneId`) |
| **Event log** | Chronological (or filterable) list of logged events with **match time** for review |
| **Optional** | Simple **pass** volume only is acceptable if zone-level pass detail slips; tries-by-zone is the priority zone analytic |

---

## 13. Screen map and core flows

### 13.1 Primary screens (information architecture)

| Screen | Purpose |
|--------|---------|
| **Match list** | **Add game** (one row at a time), **import schedule** (paste CSV), open existing, sort/browse |
| **Add game** | Same fields as CSV: teams, kickoff, location, competition → save to list |
| **Import schedule** | Paste CSV rows → bulk-create matches → return to list |
| **Match setup / detail** | Edit metadata (opponent, kickoff, competition), open roster, start or resume clock |
| **Live match / tagging** | Clock + period, quick actions, **zone → player → action** when in scope |
| **Roster** | 12-player squad, on-field vs bench, substitution flow |
| **Event log** | In-match or post-match list of events; minimal edit/delete |
| **Post-match summary / analytics** | Totals, tries by zone, link from match list |

Exact navigation (tabs vs stack) is implementation detail; all **routes** above must be reachable.

### 13.2 Core flows (acceptance-oriented)

1. **Create and start a match** — User creates a match with metadata → opens live view → starts clock for period 1 → time advances when running.
2. **Run clock across halves** — User ends period 1 → period 2 active → clock usable; events remain tied to period + match time.
3. **Manage roster** — User sets 7 starters + 5 bench → performs a substitution → on-field list updates → tagging uses current on-field players.
4. **Log a try with zone** — User selects zone → player → try → event appears in log with time and zone; analytics show try in tries-by-zone.
5. **Log pass → ruck** — User logs a pass → logs a ruck linked to that pass (per §15.1) → both visible in event log.
6. **Recover from mistake** — User undoes last action or deletes/edits an event → totals and zone stats stay consistent.

**Empty / error states:** Match list with no matches should invite creation; offline should not block local use (product §10).

---

## 14. Spec-driven process

**Ambiguous behavior or new rules** → update **this document** (or implementation spec, within product bounds) **before** coding the feature. **Integration validation** means Phases 1–4 in [`IMPLEMENTATION_SPEC.md`](./IMPLEMENTATION_SPEC.md) are checked against the **MVP acceptance** table there and the flows in §13.2 — **loop back to spec, not to chaos.**

---

## 15. Resolved defaults (v1) and future enhancements

### 15.1 Event rules locked for v1

| Topic | Resolution |
|-------|------------|
| **Zones** | Six zones **Z1–Z6**, **team-relative** (§5.2). |
| **Tackle** | Minimum payload: **`outcome`: made \| missed**. When **made**, **`tackleQuality`** ring order: **passive** \| **neutral** \| **dominant** (first ring in zone picker). Legacy rows without quality are treated as **neutral** in analytics. |
| **Pass** | Location → area → **Offload** ring: **negative** \| **neutral** \| **positive** (mapped for analytics). Legacy rows may use old won/lost offload fields — normalized in app. |
| **Line break** | Same picker as **pass** (location, area, **Offload**). Distinct from tries. |
| **Ruck = breakdown** | **Ruck** names the breakdown; no separate breakdown event. **Breakdown length** (analytics): clock time from each **ruck** to the **next pass in the same half** — derived, no extra taps. |
| **Ruck + pass** | **Ruck** is its own event type. Optional field **`precedingPassEventId`** referencing the pass that led to the ruck. If the coach logs a ruck without linking, the event is still valid (e.g. loose ball). |
| **Conversion** | After a try, the next score control is **conversion** only. **Zone and length** match the **paired try** (FIFO if multiple tries are unconverted). The coach only chooses **made** or **missed** — no second location pick. |
| **Share** | **No** share URLs or backend share in v1. Optional: **copy match summary text to clipboard** in polish phase. |
| **Meters / distance** | **Post-v1** — not part of v1 MVP or POC. |

### 15.2 Future enhancements (not v1)

- Meters gained, distance proxies, richer tackle typing, opponent roster, export, Firebase sync, multi-coach live, video — as in §§8–10 and implementation Phase 6+.

---

## 16. Related references

- **RefLog** — `AppDevelopment/refLog` (Flutter): match persistence, clocks, rosters, offline-first event logging — **conceptual reference** for SevensManager behaviors.
- **Portfolio / case study** — `justinxhale.github.io` RefLog write-up (speed, focus, flow for live match logging).

---

*End of document.*
