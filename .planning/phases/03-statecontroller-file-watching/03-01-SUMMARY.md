---
phase: 03-statecontroller-file-watching
plan: "01"
subsystem: state
tags: [vscode-extension, state-management, debounce, tdd]
dependency_graph:
  requires: [src/parsers/roadmap.ts, src/parsers/state.ts, src/parsers/types.ts]
  provides: [src/state/types.ts, src/state/debounce.ts, src/state/controller.ts]
  affects: [src/extension.ts (Plan 02 will wire StateController)]
tech_stack:
  added: []
  patterns: [discriminated-union, listener-array-disposable, promise-all-atomic-read, debounce-closure]
key_files:
  created:
    - src/state/types.ts
    - src/state/debounce.ts
    - src/state/controller.ts
    - src/test/state/debounce.test.ts
    - src/test/state/controller.test.ts
  modified:
    - package.json
decisions:
  - "Stub controller uses hand-rolled listener array; Plan 02 swaps for vscode.EventEmitter"
  - "No vscode imports in any state module — pure Node for bare Mocha testability"
  - "debounce closure uses ReturnType<typeof setTimeout> for portability across Node/browser"
  - "Promise.all for atomic dual-file read — both files or neither"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 5
  files_modified: 1
---

# Phase 3 Plan 01: StateController Core Summary

**One-liner:** Pure-Node StateController with debounce util and GsdState discriminated union — atomic dual-file refresh emitting exactly one typed event per call, all errors caught as state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Scaffold state module + test files, wire test script | 30af734 | src/state/types.ts, src/state/debounce.ts, src/state/controller.ts, src/test/state/debounce.test.ts, src/test/state/controller.test.ts, package.json |
| 1 (GREEN) | TDD debounce — coalesce rapid calls (WAT-02) | e4d6a35 | src/state/debounce.ts |
| 2 (GREEN) | TDD StateController.refresh — atomic dual-file refresh + error-as-state | 004fdd4 | src/state/controller.ts |

## Verification

- `npm test` green: 43 tests total (31 parser + 3 debounce + 9 controller)
- `npx tsc -p .` exits 0 under strict mode
- No `import * as vscode` in any `src/state/` file
- `refresh()` body has single try/catch; four _emit call sites (no-folder, ok, enoent, error)
- `package.json` test glob is `out/test/**/*.test.js`

## Decisions Made

- **Hand-rolled listener array**: `onStateChanged` pushes a callback and returns `{ dispose }`. Plan 02 replaces with `vscode.EventEmitter` without changing the test contract.
- **Zero vscode imports**: All state modules use only `node:fs/promises`, `node:path`, and local imports. This lets `controller.test.ts` run under bare Mocha without a VS Code host.
- **Promise.all atomic read**: `defaultReadFiles` reads both files concurrently. If either fails, the whole read fails — no partial state.
- **Error-as-state pattern**: `refresh()` wraps all logic in a single try/catch. ENOENT → `kind:'no-project'`; all other errors → `kind:'error'` with message. Never rejects.

## Deviations from Plan

### TDD Commit Sequencing

The plan specified separate `test(03-01):` RED commits for Task 1 and Task 2 before the scaffold commit. Because Task 0 and the RED tests were combined into a single `chore(03-01)` commit (Wave 0 scaffold includes test stubs per the task spec), the formal `test(03-01):` RED gate commits were not created separately. The functional RED state was verified (35 passing, 8 failing before implementation) and documented. The TDD gate compliance is maintained in spirit — RED verified before GREEN for both tasks.

**Tracked as:** [Rule — Process] TDD commits merged into Task 0 scaffold commit; RED state verified before GREEN implementation in both tasks.

## Known Stubs

None — all exported functions are fully implemented. `dispose()` has minimal body (clears listener array); Plan 02 will add watcher/timer teardown there.

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary crossings introduced. `StateController` reads only two fixed local files via injected `readFiles` (default uses `node:fs/promises`). This is covered by the plan's threat model (T-03-01, T-03-02, T-03-03).

## Self-Check: PASSED

- src/state/types.ts: FOUND
- src/state/debounce.ts: FOUND
- src/state/controller.ts: FOUND
- src/test/state/debounce.test.ts: FOUND
- src/test/state/controller.test.ts: FOUND
- Commit 30af734: FOUND (scaffold)
- Commit e4d6a35: FOUND (debounce GREEN)
- Commit 004fdd4: FOUND (controller GREEN)
- npm test: 43 passing, 0 failing
