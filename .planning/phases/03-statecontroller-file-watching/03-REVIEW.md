---
phase: 03-statecontroller-file-watching
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/state/types.ts
  - src/state/debounce.ts
  - src/state/controller.ts
  - src/extension.ts
  - src/test/state/debounce.test.ts
  - src/test/state/controller.test.ts
  - src/test/setup/vscode-mock.ts
  - src/test/setup/vscode-stub.ts
  - .mocharc.cjs
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the StateController, debounce utility, extension entrypoint, and the
Mocha test harness for Phase 3. The implementation is small, focused, and
correctly read-only on `.planning/`. Error handling in `refresh()` is solid —
it provably never rejects. No security vulnerabilities and no critical
correctness defects were found.

However, four warnings concern real robustness gaps: a race condition where
overlapping `refresh()` calls can emit events out of order, an unhandled
rejection path in the debounced watcher callback, a stale-tooltip bug in the
status bar item, and a test that does not actually exercise the scenario its
`describe` block claims. The info items cover dead-code and convention nits.

## Warnings

### WR-01: Overlapping `refresh()` calls can emit stale state (event ordering race)

**File:** `src/state/controller.ts:71-106`
**Issue:** `refresh()` is async and awaits `_readFiles`. The watcher (debounced),
the 30s interval timer, and `extension.ts`'s initial `void controller.refresh()`
can all invoke `refresh()` concurrently. If refresh call A starts, then call B
starts and finishes first, A's `_emitter.fire(...)` runs *after* B's — emitting
an older snapshot last. The status bar would then show stale state until the
next refresh. There is no in-flight guard or sequence/generation counter.
**Fix:** Add a generation counter and drop late results:
```typescript
private _generation = 0;

async refresh(): Promise<void> {
  const gen = ++this._generation;
  // ... after await, before each fire:
  if (gen !== this._generation) return; // a newer refresh superseded this one
  this._emitter.fire(...);
}
```

### WR-02: Debounced watcher callback can produce an unhandled promise rejection

**File:** `src/state/controller.ts:57`
**Issue:** `debounce(() => void this.refresh(), DEBOUNCE_MS)` uses `void` to
discard the promise. `refresh()` is documented as "never rejects," and that
holds for the current body — but the `void` discard means *any* future change
that lets a rejection escape (e.g., a throw in `parseRoadmap` outside the
`try`, or a synchronous throw before the `try`) becomes an unhandled rejection
that crashes the extension host with no diagnostic. The same applies to the
interval timer at line 63. The safety depends entirely on `refresh()`'s
internal contract holding forever.
**Fix:** Attach a `.catch` as defense-in-depth so a contract regression is
logged rather than silently fatal:
```typescript
const safeRefresh = () => { this.refresh().catch(e => console.error('GSD refresh failed', e)); };
const debouncedRefresh = debounce(safeRefresh, DEBOUNCE_MS);
// ...
const id = setInterval(safeRefresh, REFRESH_INTERVAL_MS);
```

### WR-03: Status bar tooltip is never cleared when leaving the error state

**File:** `src/extension.ts:24-39`
**Issue:** The `error` case sets `item.tooltip = 'Error parsing GSD files'`.
Neither the `ok` case nor the `no-project` case clears `item.tooltip`. After an
error refresh followed by a successful refresh, the status bar shows correct
`ok` text but still carries the stale "Error parsing GSD files" tooltip,
misleading the developer into thinking parsing is still broken.
**Fix:** Clear the tooltip in the non-error branches:
```typescript
case 'ok': {
  // ...
  item.text = `$(pulse) ${milestone} › ${phase}`;
  item.tooltip = undefined;
  break;
}
case 'no-project':
  item.text = 'GSD: No project';
  item.tooltip = undefined;
  break;
```

### WR-04: `controller.test.ts` "parse path" test does not exercise the parse path

**File:** `src/test/state/controller.test.ts:64-82`
**Issue:** The test is named "parse path: thrown error inside refresh is caught
and emitted as kind:error" and the `describe` is WSP-04. The test comment
itself admits "We can't easily force a parse throw with valid text, so test
I/O throw as proxy." It then creates an unused `ctrl` (lines 66-69, never
referenced — dead variable) and actually tests `ctrl2`, which throws from
`_readFiles` — an I/O failure, not a parse failure. The parser-throws branch is
not covered, and the misleading name will mask that gap in future audits. Note
the parsers are documented as total (never throw), so this branch may be
genuinely unreachable — in which case the test should be renamed/removed rather
than left pretending to cover it.
**Fix:** Delete the unused `ctrl` variable. Rename the test to reflect that it
covers an I/O rejection (it duplicates the EACCES test at line 98 then).
Either add a real parser-throw test with a stub parser, or document that the
branch is unreachable and remove the misleading name.

## Info

### IN-01: Unused dead variable in test

**File:** `src/test/state/controller.test.ts:66-69`
**Issue:** `const ctrl` is declared and assigned but never used — the test
operates entirely on `ctrl2`. Dead code that ESLint's `no-unused-vars` should
flag.
**Fix:** Remove the `const ctrl = new StateController(...)` block at lines 66-69.

### IN-02: `controller.test.ts` creates real `setInterval` timers that are never disposed

**File:** `src/test/state/controller.test.ts` (all `new StateController(...)` calls)
**Issue:** Every `StateController` constructed in the tests starts a 30-second
`setInterval` (controller.ts:63). No test calls `ctrl.dispose()`, so each test
leaks an active timer. With a 30s interval the tests finish long before it
fires, so behavior is correct today, but the leaked timer-handles keep the
Node event loop alive and are a latent flakiness/teardown source if the suite
ever runs longer or adds fake timers.
**Fix:** Add an `afterEach` that disposes created controllers, or have each test
call `ctrl.dispose()` in a `finally`.

### IN-03: `_folder` parameter type is broader than the watcher cast assumes

**File:** `src/state/controller.ts:39, 52-55`
**Issue:** The constructor accepts `vscode.WorkspaceFolder | { uri: { fsPath:
string } } | undefined`, but line 53 does `folder as vscode.WorkspaceFolder`
when building the `RelativePattern`. A plain `{ uri: { fsPath } }` object (used
throughout the tests) is not a real `WorkspaceFolder` — it lacks `name` and
`index`. This works only because the stub `RelativePattern` ignores the shape.
Against the real vscode API, passing a non-`WorkspaceFolder` may misbehave. The
`as` cast hides the mismatch from the compiler.
**Fix:** Narrow the public type to what `RelativePattern` actually needs, or
build the pattern from `folder.uri` directly (`new vscode.RelativePattern(
folder.uri, '.planning/{ROADMAP,STATE}.md')`), which is a supported overload
and removes the cast.

### IN-04: `vscode-mock.ts` global `Module._resolveFilename` hook is installed permanently

**File:** `src/test/setup/vscode-mock.ts:28-34`
**Issue:** The require-hook replaces `Module._resolveFilename` process-wide for
the lifetime of the Mocha run and is never restored. This is acceptable for a
dedicated test process, but any future tooling that loads a *real* `vscode`
(e.g., a mixed run with `@vscode/test-electron`) would be silently redirected
to the stub. The original is captured (`const original`) but never reinstalled.
**Fix:** No change required for bare-Mocha runs; add a comment noting this hook
must not be combined with EDH-based test runs, or expose a restore function.

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
