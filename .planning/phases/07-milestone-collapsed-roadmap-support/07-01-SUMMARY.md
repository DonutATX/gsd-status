---
phase: 07-milestone-collapsed-roadmap-support
plan: 01
subsystem: parsing
tags: [typescript, regex, roadmap-parser, milestone, tdd]

# Dependency graph
requires:
  - phase: 02-parsers-tests
    provides: parseRoadmap line-scanner, RoadmapData/RoadmapPhase types, fixture loader
provides:
  - Two-path parseRoadmap dispatch — expanded vs milestone-collapsed roadmaps
  - parseCollapsedRoadmap helper sourcing phases from the ## Progress table
  - parseMilestonesSection state-machine parsing the ## Milestones bullet list
  - RoadmapMilestone type; milestones field on RoadmapData; milestoneLabel on RoadmapPhase
  - collapsed-roadmap.md test fixture
affects: [07-02 milestone-grouped TreeView, tree provider restructuring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-path dispatch inside a single parser entry point — detect format in Pass 1, branch"
    - "State-machine section scanner (inSection boolean toggled by H2 headings)"
    - "Optional key omitted (not set to undefined) to preserve deepEqual flat-fallback signal"

key-files:
  created:
    - src/test/parsers/fixtures/collapsed-roadmap.md
  modified:
    - src/parsers/types.ts
    - src/parsers/roadmap.ts
    - src/test/parsers/roadmap.test.ts

key-decisions:
  - "[07-01]: Omit the milestones key entirely when no ## Milestones section exists — assigning undefined breaks assert.deepEqual against {phases:[]}"
  - "[07-01]: parseCollapsedRoadmap and parseMilestonesSection are private (non-exported) helpers in roadmap.ts — parseRoadmap signature unchanged"

patterns-established:
  - "Two-path dispatch: parseRoadmap Pass 1 sets hasDetailHeaders; zero ### Phase N: headers routes to the collapsed path"
  - "Section state machine: a boolean toggled true on the section heading and false on the next H2 bounds bullet/row collection"

requirements-completed: [PARS-06, PARS-07]

# Metrics
duration: 10min
completed: 2026-05-22
---

# Phase 7 Plan 01: Collapsed-Roadmap Parser Support Summary

**parseRoadmap now handles milestone-collapsed ROADMAP.md files — zero `### Phase N:` headers route to a `## Progress`-table reader, with `## Milestones` bullets parsed into a milestone-grouped phase list; expanded roadmaps parse unchanged.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-22T15:35:24Z
- **Completed:** 2026-05-22T15:44:59Z
- **Tasks:** 3
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- Extended the parser type model additively: `RoadmapMilestone` interface, optional `milestones` on `RoadmapData`, optional `milestoneLabel` on `RoadmapPhase` — no breaking changes for `controller.ts`, `tooltip.ts`, `provider.ts`.
- Implemented two-path dispatch: Pass 1 detects `hasDetailHeaders`; zero detail headers routes to a new `parseCollapsedRoadmap` helper instead of the expanded line-walker.
- `parseCollapsedRoadmap` sources phases from the `## Progress` table (both range rows like `1-4` and single-phase rows like `5`), excluding the header/separator rows by anchoring the first cell to a leading digit.
- `parseMilestonesSection` state-machine parser handles `## Milestones` bullets (`- ✅ **label** — tail` and `- [x]` form) in both the expanded and collapsed paths.
- Each collapsed phase carries its `milestoneLabel` from the Progress milestone column; each `RoadmapMilestone` carries its grouped phase-number list.
- Authored `collapsed-roadmap.md` fixture (4 milestones, range + single-phase rows, decoy `<details>` blocks) and a collapsed-roadmap `describe` block (PARS-06, PARS-07) plus a flat-fallback regression assertion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend parser types + collapsed-roadmap fixture** - `aaf9725` (feat)
2. **Task 2: RED — collapsed-roadmap test block** - `4470cb5` (test)
3. **Task 3: GREEN — two-path dispatch + parseCollapsedRoadmap** - staged (feat) — see Issues Encountered

## Files Created/Modified
- `src/parsers/types.ts` - Added `RoadmapMilestone`; optional `milestones` on `RoadmapData`; optional `milestoneLabel` on `RoadmapPhase`.
- `src/parsers/roadmap.ts` - Two-path dispatch in `parseRoadmap`; new private `parseCollapsedRoadmap` and `parseMilestonesSection`; collapsed-grammar regex constants.
- `src/test/parsers/fixtures/collapsed-roadmap.md` - New 4-milestone collapsed-roadmap test fixture.
- `src/test/parsers/roadmap.test.ts` - New collapsed-roadmap `describe` block; flat-fallback regression test in the canonical block.

## Decisions Made
- Omit the `milestones` key entirely (rather than assigning `undefined`) when no `## Milestones` section is present — assigning `undefined` adds an own-property that breaks `assert.deepEqual` against `{ phases: [] }` for empty/malformed inputs. The absent key is the flat-fallback signal per RESEARCH Pattern 4.
- `parseCollapsedRoadmap` / `parseMilestonesSection` are private helpers in `roadmap.ts`; `parseRoadmap`'s exported signature is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty/malformed roadmap regression from always-set `milestones` key**
- **Found during:** Task 3 (GREEN implementation)
- **Issue:** The first GREEN pass assigned `data.milestones = parseMilestonesSection(lines)` unconditionally. For empty/malformed input that returns `undefined`, but the assignment still creates an own-property `milestones: undefined`, breaking the two pre-existing PARS-03 tests that `assert.deepEqual` the result against `{ phases: [] }`.
- **Fix:** Capture the result in a local; assign to `data.milestones` only when it is not `undefined`. Applied in both the collapsed and expanded paths.
- **Files modified:** src/parsers/roadmap.ts
- **Verification:** Full mocha suite (130 tests) passes; the two PARS-03 robustness tests are green again.
- **Committed in:** staged with Task 3 (`src/parsers/roadmap.ts`)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was caught and corrected within Task 3 before commit — no scope creep. The fix is necessary for PARS-03 (parser totality) and is a direct consequence of the new code.

## Issues Encountered
- **`git commit` blocked by the permission classifier.** In this environment the permission classifier blocked direct `git commit`, the `gsd-sdk query commit` wrapper, and several `npx`/pipe commands (flagged as an unrecognized `rtk` wrapper). Task 1 committed before the block (`aaf9725`); Task 2's RED tests were committed by the orchestrator (`4470cb5`). Task 3's `src/parsers/roadmap.ts` is **staged** — the orchestrator needs to create the Task 3 commit and the final docs commit. The code work itself is complete and verified (130/130 tests pass).

## Next Phase Readiness
- Parser tier for collapsed-roadmap support is complete: PARS-06 and PARS-07 satisfied.
- Plan 07-02 (milestone-grouped TreeView, PANL-08) can now consume `RoadmapData.milestones` and per-phase `milestoneLabel`.
- No blockers other than the staged Task 3 commit noted above.

## Self-Check: PASSED
- FOUND: src/parsers/types.ts (RoadmapMilestone exported)
- FOUND: src/parsers/roadmap.ts (parseCollapsedRoadmap implemented)
- FOUND: src/test/parsers/fixtures/collapsed-roadmap.md
- FOUND: src/test/parsers/roadmap.test.ts (collapsed describe block)
- FOUND commit aaf9725 (Task 1)
- FOUND commit 4470cb5 (Task 2)
- Task 3 roadmap.ts staged (commit pending — see Issues Encountered)

---
*Phase: 07-milestone-collapsed-roadmap-support*
*Completed: 2026-05-22*
