---
phase: 03-statecontroller-file-watching
plan: "02"
subsystem: state
tags: [vscode-extension, file-watching, status-bar, event-emitter]
dependency_graph:
  requires: [src/state/controller.ts (Plan 01), src/state/debounce.ts, src/parsers/roadmap.ts, src/parsers/state.ts]
  provides: [src/state/controller.ts (vscode-integrated), src/extension.ts (StateController-driven)]
  affects: [status bar rendering, file watcher lifecycle]
tech_stack:
  added: []
  patterns: [vscode-EventEmitter, FileSystemWatcher-RelativePattern, setInterval-Disposable, lifecycle-disposed-guard, vscode-module-stub-for-mocha]
key_files:
  created:
    - .mocharc.cjs
    - src/test/setup/vscode-mock.ts
    - src/test/setup/vscode-stub.ts
  modified:
    - src/state/controller.ts
    - src/extension.ts
decisions:
  - "Keep { uri: { fsPath } } union in controller constructor so Plan 01 tests remain valid without type widening"
  - "vscode-stub + .mocharc.cjs require hook: bare Mocha intercepts require('vscode') for pure-Node controller tests"
  - "Dispose order: _watcher -> _timerDisposable -> _emitter (prevents stray events after deactivate)"
  - "lifecycle.disposed guard is first statement in onStateChanged callback (IN-04/Pitfall 5)"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 3 Plan 02: StateController Wiring + Extension Integration Summary

**One-liner:** Debounced FileSystemWatcher + 30s periodic timer in StateController with vscode.EventEmitter, driving status bar via onStateChanged subscription; parseLite removed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add FileSystemWatcher, periodic timer, vscode.EventEmitter (WAT-01/02/03/04) | 33cd27c | src/state/controller.ts, .mocharc.cjs, src/test/setup/vscode-mock.ts, src/test/setup/vscode-stub.ts |
| 2 | Wire StateController into extension.ts, remove parseLite (STAT-05) | 41bb059 | src/extension.ts |

## Verification

- `npm test` green: 43 tests passing (31 parser + 3 debounce + 9 controller)
- `npx tsc -p .` exits 0 under strict mode
- `grep -c "RelativePattern" src/state/controller.ts` = 1
- `grep -c "createFileSystemWatcher" src/state/controller.ts` = 1
- `grep -c "parseLite|updateStatusBar|pickMilestone" src/extension.ts` = 0
- `grep "if (lifecycle.disposed)" src/extension.ts` confirms guard is first statement in callback
- Dispose order: `_watcher?.dispose()` → `_timerDisposable.dispose()` → `_emitter.dispose()` (lines 98-100)
- `onDidChange`, `onDidCreate`, `onDidDelete` all registered with `debouncedRefresh`

## Decisions Made

- **Union constructor type**: The `folder` parameter accepts `vscode.WorkspaceFolder | { uri: { fsPath: string } } | undefined`. This keeps Plan 01's test stubs valid without needing `WorkspaceFolder`-typed mocks. The cast `folder as vscode.WorkspaceFolder` is used only for the `RelativePattern` constructor which needs the richer type.

- **vscode stub via Module._resolveFilename hook**: Adding `import * as vscode from 'vscode'` to `controller.ts` would break bare Mocha tests (vscode not available outside EDH). Solution: `.mocharc.cjs` specifies `require: ['out/test/setup/vscode-mock.js']`, which installs a `Module._resolveFilename` hook intercepting `require('vscode')` and returning a minimal EventEmitter/FileSystemWatcher/RelativePattern stub. Tests pass without EDH.

- **Dispose order**: `_watcher` stopped first (halts new events), then `_timerDisposable` (stops new refresh calls), then `_emitter` (clears listeners). This prevents stray `fire()` calls on a disposed emitter (RESEARCH.md Pitfall 4).

## Deviations from Plan

### Auto-added vscode-stub infrastructure

**[Rule 2 - Missing Critical Functionality] vscode module stub for bare Mocha testability**
- **Found during:** Task 1
- **Issue:** Adding `import * as vscode from 'vscode'` to `controller.ts` would cause `require('vscode')` to fail under bare Mocha since the vscode runtime only exists inside the Extension Development Host.
- **Fix:** Created `src/test/setup/vscode-stub.ts` (minimal EventEmitter/FileSystemWatcher/RelativePattern implementation) and `src/test/setup/vscode-mock.ts` (Module._resolveFilename interceptor). Added `.mocharc.cjs` with `require: ['out/test/setup/vscode-mock.js']` so Mocha loads the hook before any test file.
- **Files created:** `.mocharc.cjs`, `src/test/setup/vscode-mock.ts`, `src/test/setup/vscode-stub.ts`
- **Commit:** 33cd27c
- **Result:** All 43 tests remain green under `npm test` (bare Mocha).

## Manual Verification Checkpoint Pending

Task 3 is a `checkpoint:human-verify` requiring Extension Development Host testing:

1. Press F5 against a workspace with `.planning/ROADMAP.md` — confirm `$(pulse) Milestone › Phase N:` in status bar.
2. Edit and save `.planning/ROADMAP.md` — confirm status bar updates within ~500ms (STAT-05).
3. Open a workspace with NO `.planning/`, confirm `GSD: No project`. Then create `.planning/ROADMAP.md` while VS Code stays open — confirm status bar activates without reload (WAT-04).
4. Corrupt `.planning/ROADMAP.md` content and save — confirm `$(error) GSD: Error` with tooltip "Error parsing GSD files" (WSP-04).
5. Rapid-save ROADMAP.md ~10 times — confirm no sustained CPU spike (WAT-02 debounce).

Use the `~/dev/gsd-test` scratch workspace (EDH same-folder lockout — do NOT F5 against the dev repo).

## Known Stubs

None — all exported functions fully implemented and wired end-to-end.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. The plan's threat model covers all surfaces:
- T-03-04: `RelativePattern` brace glob used (never `path.join` for watcher pattern) — mitigated
- T-03-05: 300ms debounce coalesces OS events — mitigated
- T-03-06: `lifecycle.disposed` guard + correct dispose order — mitigated

## Self-Check: PASSED

- src/state/controller.ts: FOUND (modified)
- src/extension.ts: FOUND (modified)
- .mocharc.cjs: FOUND (created)
- src/test/setup/vscode-mock.ts: FOUND (created)
- src/test/setup/vscode-stub.ts: FOUND (created)
- Commit 33cd27c: FOUND (Task 1 — controller + vscode stub)
- Commit 41bb059: FOUND (Task 2 — extension.ts wiring)
- npm test: 43 passing, 0 failing
- npx tsc -p .: exits 0
