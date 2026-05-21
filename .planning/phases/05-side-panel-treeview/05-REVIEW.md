---
phase: 05-side-panel-treeview
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/extension.ts
  - src/parsers/state.ts
  - src/parsers/types.ts
  - src/tree/items.ts
  - src/tree/provider.ts
  - src/test/extension.test.ts
  - src/test/parsers/state.test.ts
  - src/test/setup/vscode-stub.ts
  - src/test/tree/provider.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Status:** issues_found

## Summary

Re-review after fixes for prior findings WR-01 through WR-04. All four prior
warnings are resolved and verified:

- **WR-01 (resolved):** `gsd.openRoadmap` now accepts `(line?: number)` and
  `openFile()` honors it, validating the line is a non-negative integer before
  moving the editor selection and revealing the range
  (`extension.ts:32-49,60`). A new test suite drives the click-to-navigate
  path (`extension.test.ts:158-233`).
- **WR-02 (resolved):** `setRecentCount` clamps via
  `Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5` (`provider.ts:64`), with
  tests for 0, negative, and float inputs (`provider.test.ts:364-391`).
- **WR-03 (resolved):** Both `gsd.refresh` and `gsd.refreshTree` now share a
  single `refreshHandler` const (`extension.ts:55,59,81`) — no duplicated body.
- **WR-04 (resolved):** Activity node ids are now derived from a content hash
  (FNV-1a over `entry.raw` plus timestamp) instead of array position
  (`provider.ts:26-35,122`), with a test confirming stability across index
  shifts (`provider.test.ts:516-544`).

No new bugs were introduced by the fixes. One residual edge case in the WR-04
hash scheme is worth noting (WR-01 below). The four Info items are carried
forward unchanged from the prior review — they were not in the fix scope.

## Warnings

### WR-01: `activityId` produces duplicate ids for content-identical entries

**File:** `src/tree/provider.ts:26-35,122`
**Issue:** The WR-04 fix derives an activity node id from
`${entry.timestamp ?? ''}-${FNV1a(entry.raw)}`. Because the hash is a pure
function of `entry.raw`, two STATE.md "Last activity:" lines with identical
raw text yield the identical id. VS Code requires `TreeItem.id` to be unique
within the tree; duplicate ids cause unpredictable selection/reveal behavior
and can drop nodes from rendering. This is a realistic input — a STATE.md
that repeats the same activity line (e.g. two identical "Roadmap created"
entries, or a copy-paste in the planning file) would trigger it. The new
test at `provider.test.ts:516-544` only asserts uniqueness for a fixture
where every `raw` differs, so this case is uncovered.
**Fix:** Incorporate the array index as a tiebreaker only when needed, or
append the positional index unconditionally as a stable-within-snapshot
suffix while keeping the content hash as the primary key:
```ts
function activityId(entry: StateEntry, index: number): string {
  let hash = 0x811c9dc5;
  const raw = entry.raw;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const slug = (hash >>> 0).toString(16);
  return `activity-${entry.timestamp ?? ''}-${slug}-${index}`;
}
```
Note this reintroduces positional sensitivity; if strict content-stability
must be preserved, instead detect collisions when building the activity
children list and append a disambiguating counter only to the duplicates.
Add a test with two identical `raw` entries asserting distinct ids.

## Info

### IN-01: `recentEntries` and `lastEntry` share the same object reference

**File:** `src/parsers/state.ts:63-64,71-72`
**Issue:** `data.lastEntry = bodyEntries[0]` and
`data.recentEntries = bodyEntries` make `lastEntry` an alias of
`recentEntries[0]`. `StateEntry` is treated as immutable today so this is
harmless, but a future mutation of one field would silently mutate the other.
**Fix:** No change required while entries stay immutable; consider
`Object.freeze` on entries or documenting the shared-reference contract.

### IN-02: `getTreeItem` switch has no `default` / exhaustiveness guard

**File:** `src/tree/provider.ts:71-138`
**Issue:** The `switch` over `element.kind` covers all six current
`GsdTreeItem` variants but has no `default` branch and no `never`-assertion.
If a seventh variant is added to `items.ts`, `getTreeItem` falls through and
implicitly returns `undefined`, which VS Code does not expect. The compiler
will not flag the omission because every existing path returns.
**Fix:** Add an exhaustiveness guard:
```ts
default: {
  const _exhaustive: never = element;
  throw new Error(`Unhandled tree item kind: ${JSON.stringify(_exhaustive)}`);
}
```

### IN-03: Phase / goal / criterion node ids assume unique phase numbers

**File:** `src/tree/provider.ts:86,104,111,213-223`
**Issue:** `phase-${phase.number}`, `goal-${phaseId}`, and
`criterion-${phaseId}-${index}` are unique only if `RoadmapPhase.number`
values are unique across the roadmap. `number` is a free-form string from
the parser (the `POSITION` regex permits decimals like `2.1`). A malformed
ROADMAP.md with two `Phase: 2` headers would produce duplicate tree-item
ids, which VS Code handles unpredictably.
**Fix:** Dedupe phase numbers in the roadmap parser, or append a positional
suffix when building ids. Low priority — depends on parser guarantees that
are out of scope for this phase.

### IN-04: Unused test spy plumbing in the command-registration suite

**File:** `src/test/extension.test.ts:79,84-85`
**Issue:** The `'activate() — command registration'` suite sets up
`infoCalls` / `restoreInfo` via `spyShowInfoMessage()`, but the suite asserts
only command registration — `infoCalls` is never read. Harmless, but it is
noise suggesting an intended-but-missing assertion.
**Fix:** Drop the `spyShowInfoMessage()` call from the registration suite's
`before` hook (keep it in the `command callbacks` suite where it is used).

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
