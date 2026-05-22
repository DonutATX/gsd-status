---
phase: 07-milestone-collapsed-roadmap-support
plan: 02
subsystem: tree-view
tags: [typescript, vscode-treeview, milestone, tdd, panl-08]

# Dependency graph
requires:
  - phase: 07-01
    provides: RoadmapData.milestones / RoadmapPhase.milestoneLabel types
provides:
  - milestone variant on GsdTreeItem discriminated union
  - slugify() and buildMilestoneIds() helpers in provider.ts
  - milestone-aware _getRootChildren with flat fallback
  - getChildren(milestone) returning milestone-scoped phase nodes
  - case 'milestone': in getTreeItem (Expanded/Collapsed, check-all/milestone icon, no command)
  - milestone-grouped tree describe block (PANL-08) in provider.test.ts
affects: [07 UAT, TreeView milestone hierarchy display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union exhaustive switch — adding a variant forces a compile error until getTreeItem handles it"
    - "Slug deduplication mirrors buildActivityIds — append #N suffix to collisions only"
    - "milestones?.length > 0 guard for flat fallback — absent/empty milestones = Phase 5 layout"

key-files:
  created: []
  modified:
    - src/tree/items.ts
    - src/tree/provider.ts
    - src/test/tree/provider.test.ts

key-decisions:
  - "[07-02]: getTreeItem milestone case added in Task 1 (not Task 3) because TypeScript exhaustive switch required it for compile; Task 3 verified the full implementation against the RED tests"
  - "[07-02]: buildMilestoneIds deduplication follows same pattern as buildActivityIds — append #N suffix only on 2nd+ collision so normal labels keep clean ids"

patterns-established:
  - "Slugify: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') prefixed with 'milestone-'"
  - "Milestone branch in _getRootChildren guarded by milestones?.length > 0; flat fallback path verbatim"

requirements-completed: [PANL-08]

# Metrics
duration: 15min
completed: 2026-05-22
---

# Phase 7 Plan 02: Milestone-Grouped TreeView Summary

**TreeView now renders milestones as top-level nodes with their phases nested underneath — the active milestone expands by default, the active phase keeps its play icon, and roadmaps without a `## Milestones` section fall back to the existing flat phase layout.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-22
- **Completed:** 2026-05-22
- **Tasks:** 3 (TDD: types → RED → GREEN)
- **Files modified:** 3

## Accomplishments

- Added `kind: 'milestone'` variant to the `GsdTreeItem` discriminated union in `items.ts` — zero vscode imports maintained.
- Added `slugify()` and `buildMilestoneIds()` helpers to `provider.ts`: deterministic ids, collision-safe via `#N` suffix, mirrors the existing `buildActivityIds` pattern.
- Extended `_getRootChildren` with a `milestones?.length > 0` branch: maps each `RoadmapMilestone` to a `kind: 'milestone'` node with `isActive` computed from phase membership; flat fallback path untouched.
- Added `getChildren(milestone)` branch: maps `element.phases` to `kind: 'phase'` nodes with `isActive` checked against `state.state.phaseNumber`.
- Implemented `case 'milestone':` in `getTreeItem`: `Expanded` if active else `Collapsed`; `ThemeIcon('check-all')` when all phases done, `ThemeIcon('milestone')` otherwise; no `command` property set (expand/collapse only).
- Authored 12-assertion PANL-08 describe block: top-level milestone nodes, milestone-scoped children, active-milestone collapsible state, icon selection, no-command, `milestone-` id prefix, flat fallback, active-phase icon preservation.
- Full suite: **142/142 tests passing** (8 new PANL-08, 134 pre-existing).

## Task Commits

1. **Task 1: Add milestone variant to GsdTreeItem** - `92c3d83` (feat)
2. **Task 2: RED — milestone-grouped tree tests** - `a63a5ab` (test)
3. **Task 3: GREEN — milestone-aware provider** - `48748cf` (feat)

## Files Created/Modified

- `src/tree/items.ts` — Added `kind: 'milestone'` union member with `label`, `id`, optional `description`, `isActive`, `phases` fields.
- `src/tree/provider.ts` — Added `slugify()`, `buildMilestoneIds()`; milestone branch in `_getRootChildren`; milestone branch in `getChildren`; `case 'milestone':` in `getTreeItem`.
- `src/test/tree/provider.test.ts` — New PANL-08 describe block with 12 milestone-grouped tree assertions.

## Decisions Made

- TypeScript's exhaustive switch check required adding `case 'milestone':` in `getTreeItem` during Task 1 (not Task 3). The Task 1 implementation was already correct per the UI-SPEC, so Task 3 simply verified it against the RED tests rather than rewriting it.
- `buildMilestoneIds` follows the same deduplication pattern as `buildActivityIds` — only the 2nd+ occurrence of a colliding slug gets a `#N` suffix, keeping common-case ids clean and stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript exhaustive switch required case 'milestone': in Task 1**

- **Found during:** Task 1 (after adding the union variant)
- **Issue:** Adding `kind: 'milestone'` to the union caused `getTreeItem`'s `switch` to fail compilation: "Function lacks ending return statement and return type does not include 'undefined'."
- **Fix:** Added the full `case 'milestone':` implementation in `provider.ts` as part of Task 1 (rather than waiting for Task 3). The implementation matches the UI-SPEC exactly, so no rework was needed in Task 3.
- **Files modified:** `src/tree/provider.ts`
- **Commit:** `92c3d83` (Task 1)

**2. [Rule 1 - Bug] TypeScript union narrowing false-positive in test**

- **Found during:** Task 2 (RED)
- **Issue:** After `nonSection.every(c => c.kind === 'phase')`, TypeScript narrowed `c` in the subsequent `.some()` to `{ kind: 'phase' }` only, making the `=== 'milestone'` comparison a TS2367 error.
- **Fix:** Cast `c` to `GsdTreeItem` in the `.some()` callback: `(c as GsdTreeItem).kind === 'milestone'`.
- **Files modified:** `src/test/tree/provider.test.ts`
- **Commit:** `a63a5ab` (Task 2)

---

**Total deviations:** 2 auto-fixed (1 blocking compile error, 1 TypeScript narrowing false-positive)
**Impact on plan:** Both fixes were caught before commit and resolved within their respective tasks — no scope creep.

## Known Stubs

None. All milestone data flows from parsed `RoadmapData.milestones` through the provider to the tree view.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The milestone node data comes exclusively from the user's own `ROADMAP.md` (T-07-06 accepted in threat model). Milestone id deduplication mitigates T-07-04.

## Self-Check: PASSED

- FOUND: src/tree/items.ts (kind: 'milestone' union member)
- FOUND: src/tree/provider.ts (slugify, buildMilestoneIds, milestone branch, getChildren milestone, case 'milestone')
- FOUND: src/test/tree/provider.test.ts (PANL-08 describe block)
- FOUND commit 92c3d83 (Task 1)
- FOUND commit a63a5ab (Task 2)
- FOUND commit 48748cf (Task 3)
- Full suite: 142/142 passing

---
*Phase: 07-milestone-collapsed-roadmap-support*
*Completed: 2026-05-22*
