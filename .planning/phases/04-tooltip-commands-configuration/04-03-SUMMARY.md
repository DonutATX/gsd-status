---
phase: 04-tooltip-commands-configuration
plan: "03"
subsystem: extension-host
tags: [configuration, settings, vscode-api, timer, tdd]

requires:
  - phase: 04-02
    provides: commands registered in activate() and vscode-stub stubs for extension.ts

provides:
  - CFG-01: gsd.refreshIntervalSeconds declared in package.json contributes.configuration
  - CFG-02: gsd.recentActivityCount declared in package.json contributes.configuration
  - CFG-03: onDidChangeConfiguration listener in activate() calls controller.setRefreshInterval live

affects: [05-side-panel, package.json, src/extension.ts, src/state/controller.ts]

tech-stack:
  added: []
  patterns: [onDidChangeConfiguration-lifecycle-guard, timer-mutability-pattern, disposed-guard]

key-files:
  created: []
  modified:
    - package.json
    - src/state/controller.ts
    - src/extension.ts
    - src/test/state/controller.test.ts

key-decisions:
  - "Drop readonly on _timerDisposable so setRefreshInterval can reassign without TypeScript error (Pitfall 2)"
  - "_disposed guard set in dispose() prevents post-dispose timer leaks from late config-change events (T-04-06)"
  - "Use fully-qualified key 'gsd.refreshIntervalSeconds' in affectsConfiguration to avoid spurious timer restarts on gsd.recentActivityCount changes (Pitfall 6)"
  - "gsd.recentActivityCount declared in manifest now; live action deferred to Phase 5"

patterns-established:
  - "onDidChangeConfiguration-lifecycle-guard: listener checks lifecycle.disposed before acting, consistent with onStateChanged pattern"
  - "timer-mutability-pattern: _timerDisposable as private mutable field, dispose/reassign cycle in setRefreshInterval"
  - "disposed-guard: _disposed boolean set in dispose() guards setRefreshInterval from creating leaked intervals"

requirements-completed: [CFG-01, CFG-02, CFG-03]

duration: ~15min
completed: 2026-05-21
---

# Phase 04 Plan 03: Configuration (gsd.refreshIntervalSeconds + gsd.recentActivityCount) Summary

**Two VS Code settings declared in package.json manifest with live timer reload wired via onDidChangeConfiguration — refresh interval applies immediately without a window reload, clamped to a 5-second minimum.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-21
- **Completed:** 2026-05-21
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `package.json` `contributes.configuration` declares both `gsd.refreshIntervalSeconds` (default 30, min 5) and `gsd.recentActivityCount` (default 5, min 1) alongside the existing commands
- `StateController.setRefreshInterval(seconds)` replaces the running interval with clamping and a `_disposed` guard preventing post-dispose timer leaks
- `activate()` registers `onDidChangeConfiguration` listener that reads the new value and calls `controller.setRefreshInterval` live — no window reload required
- 5 new passing test cases covering all `setRefreshInterval` behaviors (TDD RED/GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare configuration in package.json** - `812358f` (feat)
2. **Task 2: RED — setRefreshInterval failing tests** - `58bdadf` (test)
3. **Task 2: GREEN — StateController.setRefreshInterval implementation** - `da0a93e` (feat)
4. **Task 3: Wire onDidChangeConfiguration listener in activate()** - `298899e` (feat)

## Files Created/Modified

- `package.json` — added `contributes.configuration` block with two `gsd.*` settings
- `src/state/controller.ts` — dropped `readonly` on `_timerDisposable`; added `_disposed` field; added `setRefreshInterval()` method
- `src/extension.ts` — added `onDidChangeConfiguration` listener with lifecycle guard and fully-qualified affectsConfiguration key
- `src/test/state/controller.test.ts` — added `describe('setRefreshInterval', ...)` with 5 behavior cases

## Decisions Made

- Dropped `readonly` on `_timerDisposable` rather than boxing it in an object, keeping the field interface minimal and direct
- Used `Math.max(5, seconds) * 1000` clamping in `setRefreshInterval` (not the constructor) so the minimum is enforced at the call site closest to user input
- `_disposed` boolean preferred over checking `_timerDisposable` nullability — explicit semantic intent for leak prevention
- Fully-qualified key `'gsd.refreshIntervalSeconds'` in `affectsConfiguration` per RESEARCH.md Pitfall 6

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

T-04-05 mitigated: `Math.max(5, seconds)` clamp in `setRefreshInterval` prevents a 0s busy-loop from workspace settings.
T-04-06 mitigated: `_disposed` guard returns early on post-dispose config changes, no leaked interval timer.
No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 5 (Side Panel) can read `gsd.recentActivityCount` via `getConfiguration('gsd').get<number>('recentActivityCount', 5)` — setting is declared and defaulted
- Configuration schema is complete for the v1 feature set
- `setRefreshInterval` is public on `StateController` and ready for any future caller

## Self-Check: PASSED

Files exist:
- package.json (contributes.configuration): FOUND
- src/state/controller.ts (setRefreshInterval): FOUND
- src/extension.ts (onDidChangeConfiguration): FOUND
- src/test/state/controller.test.ts (setRefreshInterval tests): FOUND

Commits exist:
- 812358f: feat(04-03): declare gsd.refreshIntervalSeconds and gsd.recentActivityCount
- 58bdadf: test(04-03): add failing tests for StateController.setRefreshInterval
- da0a93e: feat(04-03): add StateController.setRefreshInterval with dispose guard
- 298899e: feat(04-03): wire onDidChangeConfiguration listener for gsd.refreshIntervalSeconds

---
*Phase: 04-tooltip-commands-configuration*
*Completed: 2026-05-21*
