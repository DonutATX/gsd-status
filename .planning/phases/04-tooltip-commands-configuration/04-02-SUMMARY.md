---
phase: 04-tooltip-commands-configuration
plan: "02"
subsystem: extension-host
tags: [commands, command-palette, package-json, tdd]
dependency_graph:
  requires: [04-01]
  provides: [CMD-01, CMD-02, CMD-03, CMD-04]
  affects: [package.json, src/extension.ts, src/test/extension.test.ts]
tech_stack:
  added: []
  patterns: [commands.registerCommand, openTextDocument-try-catch, fire-and-forget-void]
key_files:
  created:
    - src/test/extension.test.ts
  modified:
    - package.json
    - src/extension.ts
decisions:
  - "Commands registered before item.command assignment — prevents anti-pattern of assigning command before it is live"
  - "openFile() helper uses try/catch on openTextDocument per Pitfall 4 — rejects on missing file"
  - "planningBase computed from workspaceFolders[0] in activate() — same scope as folder variable already present"
  - "void operator on fire-and-forget async calls — consistent with existing extension.ts pattern"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
---

# Phase 04 Plan 02: Commands (gsd.refresh / openRoadmap / openState) Summary

**One-liner:** Three Command Palette commands declared in package.json and registered in activate() with absent-file fallback via try/catch on openTextDocument, covered by 6 new smoke tests.

## What Was Built

### Task 1 — Declare commands in package.json

`package.json` `contributes.commands` replaced from empty `{}` to an array of 3 entries:
- `gsd.refresh` / title "Refresh" / category "GSD"
- `gsd.openRoadmap` / title "Open Roadmap" / category "GSD"
- `gsd.openState` / title "Open State" / category "GSD"

These appear in the Command Palette as "GSD: Refresh", "GSD: Open Roadmap", "GSD: Open State".

Note: `vscode-stub.ts` already contained all required stubs (`commands.registerCommand`, `Uri.file`, `workspace.openTextDocument`, `window.showTextDocument`, `window.showInformationMessage`) from Plan 01 — no stub changes needed in this plan.

### Task 2 — Register commands in activate()

`src/extension.ts` updated with:
- `import * as path from 'node:path'` added at top
- `planningBase` computed from `workspaceFolders?.[0]` — `path.join(folder.uri.fsPath, '.planning')` or `undefined`
- `openFile(filename)` async helper: shows info message when no workspace folder, otherwise builds URI, calls `openTextDocument` in try/catch, shows info message on catch
- Three `vscode.commands.registerCommand` calls pushed to `context.subscriptions` in a single `.push(...)` call
- Commands registered before `item.command = 'gsd.openState'` assignment

### Task 3 — Command wiring smoke tests

New `src/test/extension.test.ts` with two describe suites (6 `it()` cases total):

**activate() — command registration:**
- verifies `gsd.refresh` is registered
- verifies `gsd.openRoadmap` is registered
- verifies `gsd.openState` is registered

**activate() — command callbacks:**
- invoking `gsd.refresh` does not throw
- invoking `gsd.openRoadmap` with no workspace folder calls `showInformationMessage`
- invoking `gsd.openState` with no workspace folder calls `showInformationMessage`

Spies patch `vscode.commands.registerCommand` and `vscode.window.showInformationMessage` before calling `activate()`, then restore originals via `after()`.

## Test Coverage

| Suite | Tests | Result |
|-------|-------|--------|
| activate() command registration (new) | 3 | PASS |
| activate() command callbacks (new) | 3 | PASS |
| prior suites (parsers, controller, debounce, relativeTime, tooltip) | 66 | PASS |
| **Total** | **72** | **PASS** |

## Deviations from Plan

### TDD Gate Note

Task 3 is marked `tdd="true"` but implementation (Task 2) was already complete before the test file was authored. Tests passed immediately on first run rather than following a strict RED-then-GREEN cycle. This is a sequencing artifact of the plan structure (Task 2 = implementation, Task 3 = tests). All 6 behaviors are covered by green tests; no functional deviation from the plan's acceptance criteria.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. T-04-03 (openFile try/catch for missing file) was applied as specified — `openTextDocument` rejection produces an info message, not an unhandled rejection.

## Self-Check: PASSED

Files exist:
- src/test/extension.test.ts: FOUND
- package.json (contributes.commands): FOUND
- src/extension.ts (registerCommand calls): FOUND

Commits exist:
- 5edddb6: feat(04-02): declare gsd.refresh, gsd.openRoadmap, gsd.openState in package.json contributes
- 87445a0: feat(04-02): register gsd.refresh/openRoadmap/openState commands in activate()
- 6d997db: test(04-02): command wiring smoke tests for activate()
