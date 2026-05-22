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
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Iteration 2 re-review of the StateController / file-watching phase. All four prior
Warning findings were re-verified and are confirmed **fixed**, with sound fixes
that introduced no new bugs or security issues:

- **WR-01 (event-ordering race):** A monotonic `_generation` counter is now
  implemented. `refresh()` captures `gen = ++this._generation` at entry and
  re-checks `gen !== this._generation` after *every* `await` boundary — both the
  success path (controller.ts:99) and the catch path (controller.ts:115). A
  superseded refresh drops its result and never fires. Correct and complete.
- **WR-02 (unhandled rejection):** `safeRefresh` wraps `refresh()` with
  `.catch(e => console.error(...))` and is used for both the debounced watcher
  callbacks and the `setInterval` fallback. The remaining direct `refresh()`
  calls are intentional (`extension.ts:45` uses `void`; tests `await`).
- **WR-03 (stale tooltip):** Every branch of the `onStateChanged` switch in
  `extension.ts` now explicitly assigns `item.tooltip` — `undefined` for
  `ok`/`no-project`, a message for `error`. Leaving the error state clears it.
- **WR-04 (misleading test):** The WSP-04 suite now exercises three distinct
  paths (generic rejection, zero-phase gibberish, non-ENOENT I/O error) with an
  accurate comment that the parser-throw branch is unreachable. No dead `ctrl`
  variable remains; assertions match the emitted state.

One pre-existing latent defect and three minor quality items remain. No
critical issues, no security vulnerabilities.

## Warnings

### WR-01: `setInterval` fallback timer is created even with no workspace folder

**File:** `src/state/controller.ts:77-78`
**Issue:** The `setInterval(safeRefresh, REFRESH_INTERVAL_MS)` fallback is created
unconditionally, including when `folder` is `undefined`. In a folderless window
(e.g., an empty VS Code window), every 30 seconds `safeRefresh` runs `refresh()`,
which immediately fires `{ kind: 'no-project' }` and returns. This is a wasted
periodic wakeup with no benefit for the entire lifetime of the extension. It is
harmless to correctness (`extension.ts` re-renders "No project" idempotently),
but it contradicts the performance intent in CLAUDE.md and burns a timer for
nothing. The `_watcher` is already guarded by `if (folder)`; the interval is not.
**Fix:** Guard the interval the same way as the watcher:
```typescript
if (folder) {
  // ...watcher setup...
  const id = setInterval(safeRefresh, REFRESH_INTERVAL_MS);
  this._timerDisposable = { dispose: () => clearInterval(id) };
} else {
  this._timerDisposable = { dispose: () => undefined };
}
```

## Info

### IN-01: `.mocharc.cjs` does not declare a `spec` glob

**File:** `.mocharc.cjs:13-15`
**Issue:** The config only sets `require`. With no `spec` field, Mocha falls back
to its default `./test/*.{js,cjs,mjs}`, which does not match the compiled layout
(`out/test/**`). Test discovery therefore depends entirely on the `spec` argument
being passed on the command line (npm script). It works today but is fragile:
bare `npx mocha` finds nothing, and an edit to the npm script can silently break
discovery with no config-level safety net.
**Fix:** Add an explicit spec glob so the config is self-sufficient:
```javascript
module.exports = {
  require: ['out/test/setup/vscode-mock.js'],
  spec: ['out/test/**/*.test.js'],
};
```

### IN-02: `debounce` provides no cancel; pending timer can outlive `dispose()`

**File:** `src/state/debounce.ts:17-28` (used at `controller.ts:71`)
**Issue:** `debounce` returns a bare function with no way to cancel a pending
timer. If `StateController.dispose()` is called within the 300ms debounce window
after a watcher event, the queued `safeRefresh` still fires ~300ms later and
calls `this._emitter.fire(...)` on an already-disposed `EventEmitter`. The vscode
`EventEmitter` tolerates `fire()` after `dispose()` (empty listener list), and
`extension.ts` additionally guards with the `lifecycle.disposed` flag, so no
crash is observed — but the extension still performs file I/O after disposal.
Low severity given the existing guards.
**Fix:** Optional hardening — give `debounce` a `.cancel()` method and invoke it
in `StateController.dispose()` before disposing the watcher.

### IN-03: `vscode-mock.ts` installs a permanent global `Module._resolveFilename` hook

**File:** `src/test/setup/vscode-mock.ts:28-34`
**Issue:** The require-hook replaces `Module._resolveFilename` process-wide for
the lifetime of the Mocha run and is never restored. Acceptable for a dedicated
bare-Mocha process, but any future mixed run that loads a *real* `vscode` (e.g.,
`@vscode/test-electron`) would be silently redirected to the stub. The original
is captured (`const original`) but never reinstalled.
**Fix:** No change required for bare-Mocha runs; add a comment that this hook
must not be combined with EDH-based test runs, or expose a restore function.

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
