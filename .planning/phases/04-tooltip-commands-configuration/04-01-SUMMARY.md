---
phase: 04-tooltip-commands-configuration
plan: "01"
subsystem: extension-host
tags: [tooltip, status-bar, relative-time, tdd]
dependency_graph:
  requires: []
  provides: [STAT-03, STAT-04]
  affects: [src/extension.ts, src/state/tooltip.ts, src/state/relativeTime.ts]
tech_stack:
  added: []
  patterns: [vscode.MarkdownString, pure-utility-module, TDD-red-green]
key_files:
  created:
    - src/state/relativeTime.ts
    - src/state/tooltip.ts
    - src/test/state/relativeTime.test.ts
    - src/test/state/tooltip.test.ts
  modified:
    - src/extension.ts
    - src/test/setup/vscode-stub.ts
decisions:
  - "relativeTime is a zero-import pure function — no date library needed for 5 comparison branches"
  - "tooltip.ts uses isTrusted=false on all MarkdownString instances to block command URI injection from user-controlled STATE.md content (T-04-01)"
  - "item.command = 'gsd.openState' set after status bar item creation — command itself registered in Plan 04-02"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 04 Plan 01: Tooltip + Status Bar Command Summary

**One-liner:** Rich MarkdownString tooltip (milestone / phase / goal / last entry) wired to status bar, with zero-import relativeTime formatter and gsd.openState command assignment.

## What Was Built

### Task 1 — relativeTime() Pure Formatter (TDD)

New `src/state/relativeTime.ts`: a zero-import pure function with 5 time buckets (just now / Nm ago / Nh ago / N days ago / unknown). Followed strict TDD red-green cycle: test file created first (compilation failed), then implementation added (all 12 tests green).

### Task 2 — Tooltip Builders + vscode-stub Extension (TDD)

New `src/state/tooltip.ts` exports `buildOkTooltip` and `buildErrorTooltip`. `buildOkTooltip` renders milestone (with two fallback levels), active phase + goal (with "All phases complete" and "(no goal defined)" fallbacks), and an optional Last Entry section with relative + absolute timestamps. `buildErrorTooltip` shows the actual parse error message. Both use `isTrusted: false` (default) per the T-04-01 threat mitigation.

`src/test/setup/vscode-stub.ts` extended with: `MarkdownString` class (stores appended text), `commands.registerCommand`, `Uri.file`, `workspace.getConfiguration`, `workspace.onDidChangeConfiguration`, `workspace.openTextDocument`, `window.showTextDocument`, `window.showInformationMessage`.

### Task 3 — Wire into extension.ts

`src/extension.ts` now imports `buildOkTooltip` / `buildErrorTooltip` and calls them in the `onStateChanged` switch. `item.command = 'gsd.openState'` assigned after the status bar item is created (STAT-04). TypeScript reports zero errors; all 66 tests pass.

## Test Coverage

| Suite | Tests | Result |
|-------|-------|--------|
| relativeTime (new) | 12 | PASS |
| tooltip (new) | 10 | PASS |
| existing (parsers, controller, debounce) | 44 | PASS |
| **Total** | **66** | **PASS** |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The T-04-01 mitigation (isTrusted=false on MarkdownString) was applied as specified in the threat model.

## TDD Gate Compliance

Task 1 followed strict red-green cycle:
- RED: `src/test/state/relativeTime.test.ts` created; `tsc` failed with "Cannot find module relativeTime.js"
- GREEN: `src/state/relativeTime.ts` created; all 12 tests pass

Task 2 followed strict red-green cycle:
- RED: `src/test/state/tooltip.test.ts` created; `tsc` failed with "Cannot find module tooltip.js"
- GREEN: `src/state/tooltip.ts` created; all 10 tests pass

## Self-Check: PASSED

Files exist:
- src/state/relativeTime.ts: FOUND
- src/state/tooltip.ts: FOUND
- src/test/state/relativeTime.test.ts: FOUND
- src/test/state/tooltip.test.ts: FOUND

Commits exist:
- 7f201cd: feat(04-01): add relativeTime() pure formatter with TDD tests
- a2ae9fc: feat(04-01): add tooltip builders and extend vscode-stub for MarkdownString
- 1fd4cc9: feat(04-01): wire tooltip builders and gsd.openState command into extension.ts
