---
phase: 07-milestone-collapsed-roadmap-support
verified: 2026-05-22T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the extension in the Extension Development Host against a real multi-milestone GSD project (e.g. ../gsd-test). Confirm the tree view shows milestone nodes (e.g. v1.0, v1.3.0) as top-level nodes instead of flat phase nodes, and that the active milestone is expanded."
    expected: "Tree top level = Recent Activity section + one collapsible node per milestone; active milestone shows as Expanded with a 'milestone' icon; non-active milestones are Collapsed."
    why_human: "VS Code tree rendering cannot be verified programmatically — requires the Extension Development Host to exercise vscode.TreeDataProvider.getTreeItem rendering and CollapsibleState visually."
  - test: "In the EDH, expand a milestone node and confirm only that milestone's phases are shown as children, each with the correct icon (play for active, pass-filled for done, circle-outline for pending)."
    expected: "Expanding a milestone shows only the phases belonging to that milestone. The active phase within a milestone has the play ThemeIcon."
    why_human: "Tree node hierarchy and icon display require visual inspection inside VS Code."
  - test: "In the EDH, confirm that clicking a collapsed-roadmap phase node (headerLine 0) opens ROADMAP.md without scrolling to a wrong line (no spurious jump), whereas clicking an expanded-roadmap phase with a real headerLine does scroll to the correct line."
    expected: "Collapsed phase click: ROADMAP.md opens, cursor at top. Expanded phase click: ROADMAP.md opens at the correct 1-based line."
    why_human: "Command argument and editor scroll behavior requires live VS Code to verify."
---

# Phase 7: Milestone-Collapsed Roadmap Support — Verification Report

**Phase Goal:** A developer with a multi-milestone GSD project sees the extension work correctly — phases grouped under their milestones — instead of "GSD: Error", because the parser handles a milestone-collapsed ROADMAP.md

**Verified:** 2026-05-22T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A milestone-collapsed ROADMAP.md (zero `### Phase N:` headers) parses to a non-empty phases array | VERIFIED | `parseRoadmap` on `../training_data/.planning/ROADMAP.md` returns 10 phases; test "PARS-06: returns a non-empty phases array" passes |
| 2  | Each collapsed phase carries the milestone label from its Progress-table row | VERIFIED | `parseProgressRow` extracts `milestoneLabel` from col2; test "PARS-07: every collapsed phase has a milestoneLabel" passes; real fixture shows `milestoneLabel: "v1.0"`, `"v1.3.0"`, etc. |
| 3  | `parseRoadmap` exposes a `milestones` array when a `## Milestones` section is present | VERIFIED | `parseMilestonesSection` state machine in `roadmap.ts:142-169` returns non-empty array; real fixture returns 6 milestones with populated `phases` arrays |
| 4  | An expanded ROADMAP.md still parses identically — no regression | VERIFIED | Test "milestones is undefined for canonical (expanded) roadmap — flat-fallback signal" passes; all 10 canonical/partial/malformed/CRLF tests pass |
| 5  | A roadmap with no `## Milestones` section returns `milestones` undefined (flat-fallback signal) | VERIFIED | `parseMilestonesSection` returns `undefined` when heading is absent; `parseRoadmap` omits the key entirely (does not assign `undefined`) — confirmed by PARS-03 deepEqual tests passing |
| 6  | When the roadmap has a non-empty milestones array, the tree's top level is Recent Activity followed by one node per milestone | VERIFIED | `_getRootChildren` in `provider.ts:269-323` branches on `milestones?.length > 0`; 8 PANL-08 tests pass including "getChildren(undefined) with milestones: top-level has one node per milestone after section" |
| 7  | Expanding a milestone node reveals exactly that milestone's phase nodes | VERIFIED | `getChildren(milestone)` at `provider.ts:223-234` filters `element.phases`; test "getChildren(milestoneNode) returns only phases for that milestone" passes |
| 8  | The milestone containing the active phase reports `isActive: true` and renders Expanded; others render Collapsed | VERIFIED | `isActive` computed via `msPhases.some(p => p.number === state.state.phaseNumber)`; tests "active milestone TreeItem has Expanded collapsibleState" and "non-active milestone TreeItem has Collapsed collapsibleState" pass |
| 9  | The active phase node keeps its distinct icon inside its milestone group | VERIFIED | `getChildren(milestone)` maps phases to `kind: 'phase'` nodes with `isActive`; test "active phase node inside milestone still has ThemeIcon('play')" passes |
| 10 | When the roadmap has no milestones array, the tree falls back to the existing flat phase layout | VERIFIED | Flat fallback path at `provider.ts:327-335` unchanged; test "flat fallback: roadmap without milestones returns section + phase nodes" passes |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/parsers/types.ts` | `RoadmapMilestone` type; `milestones` on `RoadmapData`; `milestoneLabel` on `RoadmapPhase` | VERIFIED | All three additions present at lines 28-32, 37, 25 respectively |
| `src/parsers/roadmap.ts` | Two-path dispatch + `parseCollapsedRoadmap` + `## Milestones` parser | VERIFIED | `hasDetailHeaders` dispatch at line 274; `parseCollapsedRoadmap` at line 176; `parseMilestonesSection` at line 142 |
| `src/test/parsers/fixtures/collapsed-roadmap.md` | 4-milestone collapsed fixture with range row + single-phase rows + `<details>` decoy | VERIFIED | File exists; contains 4 `## Milestones` bullets, a `## Progress` table with 1 range row and 5 single-phase rows, and 2 `<details>` blocks; zero `### Phase N:` headers |
| `src/test/parsers/roadmap.test.ts` | Collapsed-roadmap describe block (PARS-06, PARS-07) | VERIFIED | `describe('parseRoadmap — collapsed roadmap (PARS-06, PARS-07)', ...)` at line 99; 10 assertions covering all required behaviors |
| `src/tree/items.ts` | `milestone` variant on `GsdTreeItem` union | VERIFIED | `kind: 'milestone'` member present at line 18 with `label`, `id`, `description?`, `isActive`, `phases` fields; zero vscode imports |
| `src/tree/provider.ts` | `slugify`, `buildMilestoneIds`, milestone branch in `_getRootChildren`, `getChildren(milestone)`, `case 'milestone':` | VERIFIED | All present: `slugify` at line 27; `buildMilestoneIds` at line 38; milestone branch at line 269; `getChildren` milestone case at line 223; `case 'milestone':` at line 194 |
| `src/test/tree/provider.test.ts` | PANL-08 milestone-grouped tree describe block | VERIFIED | `describe('GsdTreeProvider — milestone-grouped tree (PANL-08)', ...)` with 20 assertions covering all PANL-08 behaviors including CR-01 and WR-01 regression guards |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `roadmap.ts` | Progress table rows | `PROGRESS_PHASE_CELL` inside `parseCollapsedRoadmap` | VERIFIED | `PROGRESS_PHASE_CELL = /^(\d+(?:-\d+)?)\.\s+(.+)$/` at line 33; applied in `parseProgressRow` at line 125 |
| `roadmap.ts` | `## Milestones` bullets | `MILESTONE_BULLET_PATTERN` state-machine scan | VERIFIED | `MILESTONE_BULLET_PATTERN` at line 22; consumed inside `parseMilestonesSection` at lines 157-165 |
| `provider.ts _getRootChildren` | `roadmap.milestones` | `milestones?.length > 0` branch | VERIFIED | Guard at line 269: `if (state.roadmap.milestones && state.roadmap.milestones.length > 0)` |
| `provider.ts getChildren` | milestone node phases | `element.kind === 'milestone'` returns phase nodes | VERIFIED | Branch at lines 222-234; maps `element.phases` to `kind: 'phase'` nodes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `provider.ts _getRootChildren` (milestone nodes) | `state.roadmap.milestones` | `parseRoadmap` → `parseMilestonesSection` → Progress table scan | Yes — real `## Milestones` bullets and `## Progress` rows produce populated arrays (confirmed via real-fixture run: 6 milestones, 10 phases) | FLOWING |
| `provider.ts getChildren(milestone)` | `element.phases` | Set during `_getRootChildren` by filtering `state.roadmap.phases` on `milestoneKey` join | Yes — phases filtered from the roadmap's full phase list | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `parseRoadmap` on real collapsed roadmap returns non-empty phases | `node -e "require('./out/parsers/roadmap.js').parseRoadmap(...)" against training_data ROADMAP.md` | 10 phases, 6 milestones with populated phase arrays | PASS |
| TypeScript compiles clean | `npm run compile` | Exit 0, no errors | PASS |
| Full mocha suite passes | `npx mocha "out/test/**/*.test.js" --exit` | 160 passing (454ms) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PARS-06 | 07-01-PLAN.md | Collapsed ROADMAP.md (zero `### Phase N:` headers) parses to a non-empty phase list from `## Progress` table; expanded roadmaps parse unchanged | SATISFIED | Two-path dispatch in `parseRoadmap`; 10 tests in the collapsed-roadmap describe block pass; regression-free canonical parse |
| PARS-07 | 07-01-PLAN.md | Parser extracts milestone grouping — each phase has its milestone, `RoadmapData.milestones` exposes the grouping | SATISFIED | `milestoneLabel` on every collapsed phase; `parseMilestonesSection` populates `RoadmapData.milestones`; `milestoneKey` join resolves label-vs-token mismatch |
| PANL-08 | 07-02-PLAN.md | TreeView renders milestones as top-level nodes with phases nested underneath; active phase visually distinguished within milestone group | SATISFIED | `provider.ts` milestone branch in `_getRootChildren` + `getChildren(milestone)` + `case 'milestone':` in `getTreeItem`; 20 PANL-08 tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/test/parsers/fixtures/canonical-roadmap.md` | 66, 79, 93, 106, 117-120 | `TBD` in plan-count cells | Info | Test fixture content modeling real ROADMAP.md format; not an unresolved debt marker in implementation code. The file was not modified by Phase 7 (it is a pre-existing fixture). Not a blocker. |

No `TBD`, `FIXME`, or `XXX` markers were found in any implementation file modified by Phase 7 (`roadmap.ts`, `types.ts`, `items.ts`, `provider.ts`).

### Human Verification Required

The automated checks are all green. Three items require visual confirmation in the Extension Development Host:

#### 1. Milestone hierarchy renders correctly in VS Code tree view

**Test:** Press F5 from the extension repo to launch the Extension Development Host. Open `../gsd-test` (or any multi-milestone GSD project). Open the GSD Activity Bar panel.

**Expected:** The tree shows "Recent Activity" as the first top-level section, followed by one collapsible node per milestone (e.g. "v1.0 Checklists & Callouts"). The milestone containing the active phase is expanded; others are collapsed. The milestone icons are `ThemeIcon('milestone')` for in-progress, `ThemeIcon('check-all')` for fully-done milestones.

**Why human:** VS Code TreeView rendering, icon display, and initial collapse state cannot be verified without launching the Extension Development Host.

#### 2. Phase nodes nested under milestones with correct icons

**Test:** In the EDH tree, expand a milestone node.

**Expected:** Only that milestone's phase nodes appear as children. The active phase has a play icon; done phases show pass-filled; pending phases show circle-outline.

**Why human:** Tree node hierarchy and icon rendering inside VS Code requires visual inspection.

#### 3. Collapsed-phase click behavior (headerLine 0 sentinel)

**Test:** In the EDH, click a phase node that originated from a collapsed roadmap's `## Progress` table (headerLine = 0). Then click a phase from an expanded roadmap (headerLine >= 1).

**Expected:** Collapsed phase: ROADMAP.md opens without scrolling to any specific line. Expanded phase: ROADMAP.md opens and scrolls to the correct line.

**Why human:** The `openRoadmap` command argument omission for `headerLine < 1` requires a live VS Code editor to verify scroll behavior.

---

### Gaps Summary

No gaps. All 10 must-have truths are verified, all required artifacts exist and are substantively implemented, all key links are wired, and the full 160-test suite passes including the PARS-06, PARS-07, and PANL-08 test blocks. The end-to-end real-fixture run on `training_data/.planning/ROADMAP.md` confirms the phase goal is achieved: a multi-milestone collapsed roadmap that previously produced "GSD: Error" now parses to 10 phases grouped under 6 milestones.

The code review findings (WR-01 orphan-phase "Other" milestone, WR-02 separator-row tolerance, WR-03 done-status variants, WR-04 headerLine sentinel) were all addressed during Phase 7's fix cycle and are covered by regression tests in the suite.

---

_Verified: 2026-05-22T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
