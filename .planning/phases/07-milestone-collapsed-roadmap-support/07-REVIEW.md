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
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Re-review after fixes for CR-01, WR-02, WR-03, and WR-04. All four prior findings
are confirmed resolved:

- **CR-01 (milestone↔phase join key mismatch) — RESOLVED.** The new `milestoneKey()`
  helper (roadmap.ts:54-57) normalizes both the `## Milestones` bullet label and the
  Progress-table milestone column to a leading `v\d+(.\d+)*` version token, and both
  `parseCollapsedRoadmap` (roadmap.ts:224-231) and `provider._getRootChildren`
  (provider.ts:276-279) join on it. Regression tests at roadmap.test.ts:145-160 and
  provider.test.ts:683-701 lock the behavior in.
- **WR-02 (rigid Progress-table column regex) — RESOLVED.** `splitTableCells` /
  `findStatusColumn` / `parseProgressRow` replace the full-row regex; the 4-column
  fixture and its tests (roadmap.test.ts:173-196) prove a missing "Plans Complete"
  column no longer mis-maps the status cell.
- **WR-03 (done-status literal matching) — RESOLVED.** `isDoneStatus()` (roadmap.ts:64-67)
  accepts `Complete|Completed|Done|Shipped` case-insensitively plus `✅`; covered by
  roadmap.test.ts:163-170.
- **WR-04 (collapsed phase headerLine: 0 navigation) — RESOLVED.** Collapsed phases
  carry `headerLine: 0`; provider.ts:150-154 omits the `openRoadmap` line argument
  when `headerLine < 1`. The `RoadmapPhase.headerLine` JSDoc (types.ts:17-23) now
  documents the sentinel. Verified by provider.test.ts:703-712.

No new BLOCKER-level defects were introduced by the fixes. Two WARNING-level issues
and three INFO items remain — none block shipping, but the milestone-grouping
fallback gap (WR-01 below) narrows rather than eliminates the original CR-01 failure
class and is worth addressing before this layout reaches users with non-version
milestone labels.

## Warnings

### WR-01: Collapsed-roadmap phases vanish from the tree when a milestone label has no version token

**File:** `src/parsers/roadmap.ts:54-57`, `src/parsers/roadmap.ts:224-231`, `src/tree/provider.ts:276-279`
**Issue:** `milestoneKey()` falls back to the *full normalized label* when no leading
`v\d+` token is present. This produces an asymmetric join failure: a `## Milestones`
bullet label like `"Foundation Phase"` normalizes to `"foundation phase"`, while the
Progress-table milestone column for the same milestone is typically a short token
(`"M1"`, `"Foundation"`, or empty) that normalizes to something else. The two keys
will not be equal, so `parseCollapsedRoadmap` (roadmap.ts:227-229) assigns that
milestone an empty `phases` list, and `provider._getRootChildren` (provider.ts:277-279)
renders a milestone node with **zero phase children** — the phases silently disappear
(they are not re-shown via the flat fallback, because `data.milestones` is still
non-empty so the flat branch at provider.ts:295-303 is skipped). The "CR-01: no
milestone has an empty phases list" test only exercises version-token labels, so this
gap is untested. CR-01 was downgraded from "always broken" to "broken for a narrower
input class," not eliminated.
**Fix:** Detect unjoined phases after grouping and surface them so no phase is ever
dropped — either revert to flat layout when any phase is orphaned, or add a synthetic
catch-all milestone:
```ts
// after the grouping loop in parseCollapsedRoadmap:
const assigned = new Set(data.milestones.flatMap(m => m.phases));
const orphans = data.phases.filter(p => !assigned.has(p.number));
if (orphans.length > 0) {
  data.milestones.push({ label: 'Unassigned', phases: orphans.map(p => p.number) });
}
```
Also add a fixture/test where a milestone label carries no `v\d+` token.

### WR-02: Header detection in the Progress section can latch onto the separator row and silently mis-resolve `statusCol`

**File:** `src/parsers/roadmap.ts:191-201`
**Issue:** Inside `## Progress`, the code sets `sawHeader = true` on the *first* line
where `splitTableCells` returns non-undefined, assuming it is the header row. For the
shipped fixtures the header row is genuinely first, so this works. But the assumption
is fragile: if a generator emits the separator row first, or the real header row lacks
a leading `|` (and is therefore rejected by `splitTableCells`), then `findStatusColumn`
runs on the separator cells (`['-------','-----------',...]`), finds no `status` cell,
and silently falls back to index 3. In a 4-column table that maps the "Completed"
column as status, marking every phase not-done with no diagnostic. The index-3 fallback
masks the misparse instead of signaling it.
**Fix:** Only treat a `|`-row as the header when at least one cell matches a known
header name, and skip the table entirely if no header is ever found rather than
guessing index 3:
```ts
if (!sawHeader) {
  const headerCells = splitTableCells(line);
  const looksLikeHeader = headerCells?.some(c => /^(phase|milestone|status)$/i.test(c.trim()));
  if (headerCells && looksLikeHeader) {
    statusCol = findStatusColumn(headerCells);
    sawHeader = true;
  }
}
```

## Info

### IN-01: `milestoneKey` version regex permits multi-segment tokens broader than the documented `vX.Y` contract

**File:** `src/parsers/roadmap.ts:56`
**Issue:** The pattern `^v\d+(?:\.\d+)*` greedily consumes every dotted segment, so a
bullet label `"v1.0.1 Patch"` yields key `"v1.0.1"` while a Progress column of `"v1.0"`
yields `"v1.0"` — no join. The CR-01 doc comment describes the column as "a bare
version token (`v1.0`)"; a label with a patch segment would break the join. Real GSD
milestones use `vMAJOR.MINOR` only, so this is currently latent.
**Fix:** Constrain the key to two segments (`^v\d+(?:\.\d+)?`) to match the documented
`vX.Y` shape, or document that label and column must share an identical version token.

### IN-02: `splitTableCells` does not handle escaped pipes inside table cells

**File:** `src/parsers/roadmap.ts:73-79`
**Issue:** A plain `.split('|')` treats a `\|` escaped pipe inside a Markdown cell as a
column boundary, shifting every subsequent cell by one and mis-mapping the status
column. GSD Progress tables rarely contain pipes in phase names, so this is INFO not
WARNING, but the assumption is undocumented.
**Fix:** Note the "no escaped pipes" assumption in the function JSDoc, or split on
`/(?<!\\)\|/` if escaped pipes ever occur in practice.

### IN-03: `parseProgressRow` can read a wrong status cell from a short data row once `statusCol` shrinks

**File:** `src/parsers/roadmap.ts:104, 115`
**Issue:** The guard `cells.length <= statusCol` rejects rows shorter than the status
column. With the default `statusCol = 3` a malformed 3-cell row is rejected. But once a
4-column header sets `statusCol = 2`, a stray 3-cell row passes the guard and
`isDoneStatus(cells[2])` reads whatever the 3rd cell holds (possibly a date), producing
a wrong `done` flag rather than dropping the row. Behavior is bounded (no crash), so
this is INFO.
**Fix:** Optionally also require the milestone cell to be non-empty, or skip rows whose
cell count differs from the header cell count.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
