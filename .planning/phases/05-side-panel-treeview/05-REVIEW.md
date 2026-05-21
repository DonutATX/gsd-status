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
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 5 adds the GSD side-panel TreeView: `GsdTreeProvider`, the `GsdTreeItem`
discriminated union, `recentEntries` support in the STATE parser, and wiring in
`activate()`. The code is clean, well-typed, and well-tested at the unit level.

No security issues and no crash-class bugs were found. However there is a real
functional defect: phase tree nodes carry a `headerLine` argument that the
`gsd.openRoadmap` command never consumes, so clicking a phase opens ROADMAP.md
but does not jump to that phase. Several other warnings concern missing input
validation and a redundant command. Unit tests are thorough for the provider
but do not cover the click-to-navigate behavior, which is why the dead-argument
bug slipped through.

## Warnings

### WR-01: Phase node click argument is silently discarded — no navigation to phase

**File:** `src/tree/provider.ts:68-72`, `src/extension.ts:47`
**Issue:** `getTreeItem()` for a `phase` node builds a command with
`arguments: [phase.headerLine]`, and the test at
`src/test/tree/provider.test.ts:235-242` asserts that argument is present.
But `gsd.openRoadmap` is registered as
`() => { void openFile('ROADMAP.md'); }` — it takes no parameters and
`openFile()` never accepts or uses a line number. Result: clicking a phase
opens ROADMAP.md at the top, never scrolling to the phase header. The
`headerLine` plumbing is dead weight that gives a false impression of
working navigation, and the provider test only checks the argument exists,
not that it does anything.
**Fix:** Make the command accept and honor the line. For example:
```ts
vscode.commands.registerCommand('gsd.openRoadmap', (line?: number) => {
  void openFile('ROADMAP.md', line);
}),
```
and in `openFile`, after `showTextDocument`, when `line` is provided:
```ts
const editor = await vscode.window.showTextDocument(doc);
if (typeof line === 'number') {
  const pos = new vscode.Position(line, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos));
}
```
Then add a test that invokes the registered callback with a line number.
Alternatively, if navigation is intentionally deferred, remove the
`arguments: [phase.headerLine]` field and the assertion so the code does
not claim a capability it lacks.

### WR-02: `setRecentCount` accepts zero / negative / non-integer values without validation

**File:** `src/tree/provider.ts:37-39`, `src/extension.ts:55-57,127-131`
**Issue:** `setRecentCount(n)` stores `n` verbatim and `_getActivityChildren()`
uses it directly in `entries.slice(0, this._recentCount)`. The value comes
from `getConfiguration().get<number>('recentActivityCount', 5)`. While
`package.json` declares `"minimum": 1`, VS Code does not hard-enforce
`minimum` on programmatic reads of user settings — a user who hand-edits
`settings.json` to `0`, a negative number, or a float gets that value
through. `slice(0, 0)` silently shows no activity, `slice(0, -1)` drops the
last entry, a float produces undefined slice behavior. No crash, but a
confusing empty/short panel with no error.
**Fix:** Clamp in `setRecentCount`:
```ts
setRecentCount(n: number): void {
  this._recentCount = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
}
```

### WR-03: `gsd.refreshTree` is an exact duplicate of `gsd.refresh`

**File:** `src/extension.ts:46,64-66`
**Issue:** Both `gsd.refresh` and `gsd.refreshTree` are registered with the
identical body `() => { void controller.refresh(); }`. Two command ids for
one behavior is a maintenance hazard — a future change to one will likely
be forgotten on the other, and the separate `package.json` command entry
(`gsd.refreshTree`, title "Refresh GSD tree") implies a distinct action
that does not exist.
**Fix:** Point the `view/title` menu contribution in `package.json` at the
existing `gsd.refresh` command and delete the `gsd.refreshTree` command
entry and its registration. If a distinct id must remain for the toolbar
icon, at minimum extract the shared callback into one named function so
both ids cannot drift.

### WR-04: Activity node ids are positional, not content-stable — defeats expansion preservation

**File:** `src/tree/provider.ts:91-93,173-175`
**Issue:** The provider doc comment promises stable ids "to preserve
user-expanded nodes". Phase ids (`phase-<number>`) and the section id are
content-stable, but activity ids are `activity-${index}` where `index` is
the array position. When STATE.md gains a new entry, every existing entry
shifts index, so `activity-0` now points at a different log line. Activity
nodes are leaves (`None` collapsibleState) so expansion state is not lost,
but VS Code keys selection and reveal on `id` — selection will jump to an
unrelated entry after a refresh, and the id no longer means what the
comment claims.
**Fix:** Derive the id from stable content, e.g. the timestamp plus a hash
or the raw text: `id: \`activity-${entry.timestamp ?? ''}-${entry.raw}\``
(or a short hash of `entry.raw`). If positional ids are acceptable for
leaves, update the doc comment to stop claiming activity ids are stable.

## Info

### IN-01: `recentEntries` and `lastEntry` share the same object reference

**File:** `src/parsers/state.ts:63-64,71-72`
**Issue:** `data.lastEntry = bodyEntries[0]` and `data.recentEntries = bodyEntries`
make `lastEntry` an alias of `recentEntries[0]` (the test at
`state.test.ts:86` even relies on `deepEqual`). `StateEntry` is currently
treated as immutable so this is harmless today, but any future mutation of
one field silently mutates the other.
**Fix:** No change required while entries stay immutable; consider freezing
entries (`Object.freeze`) or documenting the shared-reference contract.

### IN-02: `getTreeItem` switch has no `default` / exhaustiveness guard

**File:** `src/tree/provider.ts:45-108`
**Issue:** The `switch` over `element.kind` covers all six current variants,
but has no `default` branch and no `never`-assertion. If a seventh
`GsdTreeItem` variant is added to `items.ts`, `getTreeItem` will fall
through and implicitly return `undefined`, which VS Code does not expect.
The compiler will not flag the omission today because every path returns.
**Fix:** Add an exhaustiveness guard:
```ts
default: {
  const _exhaustive: never = element;
  throw new Error(`Unhandled tree item kind: ${JSON.stringify(_exhaustive)}`);
}
```

### IN-03: Phase node ids assume unique phase numbers

**File:** `src/tree/provider.ts:60,178-198`
**Issue:** `phase-${phase.number}` and `goal-${phaseId}` /
`criterion-${phaseId}-${index}` are unique only if `RoadmapPhase.number`
values are unique across the roadmap. `number` is a free-form string from
the parser (`POSITION` regex allows decimals like `2.1`). A malformed
ROADMAP.md with two `Phase: 2` headers would produce duplicate tree-item
ids, which VS Code handles unpredictably.
**Fix:** Either dedupe phase numbers in the roadmap parser, or fall back to
a positional suffix when building ids. Low priority — depends on parser
guarantees not in scope here.

### IN-04: Dead/unused test plumbing — `infoCalls` declared but never asserted in registration suite

**File:** `src/test/extension.test.ts:79,84-85`
**Issue:** In the `'activate() — command registration'` suite, `infoCalls`
and `restoreInfo` are set up via `spyShowInfoMessage()` but the suite only
asserts command registration — `infoCalls` is never read. It is harmless
spy setup, but it is noise that suggests an assertion was intended.
**Fix:** Drop the `spyShowInfoMessage()` call from the registration suite's
`before` hook (keep it in the `command callbacks` suite where it is used),
or add the missing assertion.

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
