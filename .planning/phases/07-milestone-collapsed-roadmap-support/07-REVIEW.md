---
phase: 07-milestone-collapsed-roadmap-support
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/parsers/roadmap.ts
  - src/parsers/types.ts
  - src/tree/items.ts
  - src/tree/provider.ts
  - src/test/parsers/roadmap.test.ts
  - src/test/tree/provider.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 7 adds collapsed-ROADMAP parsing (`## Progress` table + `## Milestones` section)
and a Milestone → Phase tree hierarchy. The two-path dispatch (`hasDetailHeaders`),
the flat-fallback layout, and the milestone id-collision dedup are all sound, and the
regexes are linear (no catastrophic backtracking risk).

However there is a **BLOCKER**: the milestone label produced by the `## Milestones`
parser and the `milestoneLabel` produced by the `## Progress` table parser use two
different label vocabularies and never compare equal. This silently empties every
milestone's phase list — both in the parser's own `milestones[].phases` and in the
TreeView's per-milestone children. The bug is invisible to the current test suite
because no test asserts cross-linking on the real fixture; `provider.test.ts` uses
hand-built fixtures whose labels are forced to match.

## Critical Issues

### CR-01: Milestone label vs. Progress `milestoneLabel` never match — milestone phase lists silently empty

**File:** `src/parsers/roadmap.ts:122-127`, cross-referenced with `src/tree/provider.ts:268`
**Issue:**
`parseMilestonesSection` builds `RoadmapMilestone.label` from the bold text of a
`## Milestones` bullet — e.g. fixture line `- ✅ **v1.0 Foundation** — Phases 1-4`
yields `label = "v1.0 Foundation"`.

`parseCollapsedRoadmap` builds each phase's `milestoneLabel` from **column 2** of the
`## Progress` table — e.g. fixture row `| 1-4. Foundation Setup | v1.0 | 4/4 | ... |`
yields `milestoneLabel = "v1.0"`.

The grouping step then does:
```ts
ms.phases = data.phases
  .filter((p) => p.milestoneLabel === ms.label)   // "v1.0" === "v1.0 Foundation" → false
  .map((p) => p.number);
```
`"v1.0"` never equals `"v1.0 Foundation"`, so **every milestone ends up with
`phases: []`**. The identical mismatch occurs in `provider.ts:268`
(`state.roadmap.phases.filter(p => p.milestoneLabel === ms.label)`), so in the
milestone-grouped TreeView every milestone node renders with **zero phase children**
and `isActive` is always `false` (no phase number can match).

This is the core feature of the phase (Milestone → Phase hierarchy) failing on the
exact `collapsed-roadmap.md` fixture shipped with the phase. The tests pass only
because `roadmap.test.ts` never asserts `data.milestones[*].phases`, and
`provider.test.ts`'s `makeMilestoneState` hand-sets matching labels
(`milestoneLabel: 'v1.0 Alpha'` == `label: 'v1.0 Alpha'`), masking the real grammar.

**Fix:** Pick one canonical join key. The Progress table's column-2 short code
(`v1.0`) is the reliable machine key; the `## Milestones` bullet label is descriptive
prose. Match on a normalized version-prefix rather than full-string equality. For
example, derive the version token from the milestone label and compare:
```ts
// Extract leading version token: "v1.0 Foundation" -> "v1.0"
function milestoneKey(label: string): string {
  return (label.match(/^v\d+(?:\.\d+)?/)?.[0] ?? label).toLowerCase();
}
// grouping in parseCollapsedRoadmap:
ms.phases = data.phases
  .filter((p) => milestoneKey(p.milestoneLabel ?? '') === milestoneKey(ms.label))
  .map((p) => p.number);
```
Apply the same `milestoneKey` comparison in `provider.ts:268`. Add a parser test
asserting `data.milestones.find(m => m.label === 'v1.0 Foundation').phases` is
non-empty, and a provider test where the milestone label and the phase
`milestoneLabel` differ in the same way the real fixture does.

## Warnings

### WR-01: `parseMilestonesSection` is run twice over the full line array

**File:** `src/parsers/roadmap.ts:90` and `src/parsers/roadmap.ts:157`
**Issue:** Both the collapsed path and the expanded path call
`parseMilestonesSection(lines)`. That is fine functionally, but the collapsed path
(`parseCollapsedRoadmap`) also independently re-scans all lines for the H1 and again
for the Progress table — three full passes plus the two passes already done in
`parseRoadmap`. For the <100ms budget in CLAUDE.md this is acceptable on typical
files, but it is avoidable churn and makes the control flow harder to follow.
**Fix:** Consolidate the H1 / Milestones / Progress scans in `parseCollapsedRoadmap`
into a single `for` loop with section-state flags, mirroring the single-pass style of
the expanded branch.

### WR-02: Progress-table parser does not validate column count — malformed rows silently mis-mapped

**File:** `src/parsers/roadmap.ts:26-27, 107-118`
**Issue:** `PROGRESS_ROW_PATTERN` hard-codes a 5-column layout
(`Phase | Milestone | Plans | Status | Completed`) by matching `\|[^|]+\|` for the
ignored "Plans Complete" column. If a real ROADMAP.md reorders columns or drops the
"Plans Complete" column, the regex either fails to match (row dropped — phase lost
with no diagnostic) or matches and assigns the wrong cell to `name` / `milestoneLabel`
/ `done`. The status cell in particular is consumed by capture group 4; a 4-column
table would put the *Completed date* there, so `done` is computed from a date string
and is always `false`. There is no test for a non-canonical column order.
**Fix:** Document the assumed column order in a comment at the regex, and add a
fixture + test for at least a 4-column Progress table to pin the failure mode. If
robustness matters, split the row on `|` and index columns by header-row position
instead of a positional regex.

### WR-03: `done` detection only recognizes the literal `Complete`

**File:** `src/parsers/roadmap.ts:113`
**Issue:** `done: /^complete$/i.test(m[4].trim())` treats only the exact word
`Complete` as done. GSD Progress tables in the wild also use `Done`, `Shipped`, or a
checkmark/`✅` in the status cell (the fixture's own `## Milestones` section uses
`✅` and `shipped`). A milestone marked `Shipped` would be reported as not-done,
flipping the tree icon from `check-all` to `milestone` and the phase icon from
`pass-filled` to `circle-outline`.
**Fix:** Broaden the test, e.g.
`/^(complete|completed|done|shipped)$/i.test(s) || /✅/.test(s)`, and add a fixture
row exercising a non-`Complete` status.

### WR-04: Collapsed phases get `headerLine: 0`, producing a broken "Open Roadmap" jump

**File:** `src/parsers/roadmap.ts:114-115`
**Issue:** Collapsed-path phases are created with `headerLine: 0, endLine: 0`. In
`provider.ts:145-149` every phase node wires a `gsd.openRoadmap` command with
`arguments: [phase.headerLine]`. For a collapsed roadmap that argument is always `0`,
so clicking any phase row jumps to line 0/1 of ROADMAP.md regardless of which phase
was clicked — a silently wrong but non-crashing behavior. The expanded path correctly
sets a 1-based `headerLine`.
**Fix:** Either set `headerLine` to the 1-based index of the Progress-table row line
(so the jump lands on the row), or have `provider.ts` suppress/alter the
`gsd.openRoadmap` command when `headerLine === 0`. A `headerLine` of 0 is also an
out-of-band sentinel that the type does not document — consider making it `number`
with a comment, or `headerLine?: number`.

## Info

### IN-01: `milestoneLabel` is optional on `RoadmapPhase` but collapsed path always sets it; expanded path never does

**File:** `src/parsers/types.ts:19`, `src/parsers/roadmap.ts`
**Issue:** `milestoneLabel?` is correctly optional, but the split behavior (always
present on the collapsed path, always absent on the expanded path even when an
expanded roadmap has a `## Milestones` section) is undocumented. An expanded roadmap
with a `## Milestones` section gets `data.milestones` populated (line 157-160) but
its phases carry no `milestoneLabel`, so `provider.ts:268`'s filter yields empty
milestone groups for expanded-with-milestones roadmaps too — same shape as CR-01.
**Fix:** Document the invariant, and decide whether the expanded path should also
populate `milestoneLabel` (it has the data once milestones + phases are known).

### IN-02: `parseMilestonesSection` ignores bullets indented or nested under the heading

**File:** `src/parsers/roadmap.ts:22, 59`
**Issue:** `MILESTONE_BULLET_PATTERN` anchors on `^-\s+`, so any indented milestone
bullet (sub-list) is skipped. Acceptable for the documented grammar, but worth a
one-line comment so a future maintainer does not treat it as a bug.
**Fix:** Add a comment noting only top-level bullets are recognized.

### IN-03: Magic punctuation set duplicated across six directive regexes

**File:** `src/parsers/roadmap.ts:31-35`
**Issue:** `GOAL`, `MODE`, `DEPENDS_ON`, `REQUIREMENTS` each repeat the
`(?:\*\*:|:\*\*)` punctuation alternation. Not a bug, but a single helper
(`directive('Goal')`) building the RegExp would remove the duplication and the risk
of the variants drifting apart.
**Fix:** Extract a `makeDirective(name: string): RegExp` factory.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
