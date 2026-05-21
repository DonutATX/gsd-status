---
phase: 05-side-panel-treeview
plan: "02"
subsystem: tree
tags: [tdd, tree, provider, PANL-02, PANL-03, PANL-04, PANL-07]
dependency_graph:
  requires: [StateData.recentEntries (05-01)]
  provides: [GsdTreeItem, GsdTreeProvider]
  affects: [src/tree/items.ts, src/tree/provider.ts, src/test/setup/vscode-stub.ts, src/test/tree/provider.test.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, discriminated-union, EventEmitter-consumer, TreeDataProvider]
key_files:
  created:
    - src/tree/items.ts
    - src/tree/provider.ts
    - src/test/tree/provider.test.ts
  modified:
    - src/test/setup/vscode-stub.ts
decisions:
  - "GsdTreeItem is a zero-vscode-import discriminated union in items.ts; TreeItem construction lives exclusively in provider.ts getTreeItem()"
  - "Section node (Recent Activity) always first in root children list, followed by roadmap-ordered phase nodes"
  - "Active phase detection: phase.number === state.state.phaseNumber string comparison"
  - "Leaf nodes (goal/criterion/activity/placeholder) always get TreeItemCollapsibleState.None (Pitfall 6)"
  - "Stable deterministic ids: recent-activity-section, phase-<N>, goal-<phaseId>, criterion-<phaseId>-<index>, activity-<index>"
metrics:
  duration: "12 minutes"
  completed: "2026-05-21"
  tasks: 3
  files: 4
---

# Phase 05 Plan 02: GsdTreeProvider (Tree Node Union + Data Engine) Summary

**One-liner:** Implemented `GsdTreeItem` discriminated union (zero vscode imports) and `GsdTreeProvider` that turns any `GsdState` into section + phase + Recent Activity tree nodes with stable ids and `onDidChangeTreeData` firing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add tree stubs to vscode-stub.ts and define GsdTreeItem union | 88ef976 | vscode-stub.ts, items.ts |
| 2 | Write failing GsdTreeProvider tests (RED) | ace090a | provider.test.ts |
| 3 | Implement GsdTreeProvider to pass all tests (GREEN) | de2bd26 | provider.ts |

## What Was Built

- `src/tree/items.ts` — `GsdTreeItem` discriminated union with 6 variants (section/phase/goal/criterion/activity/placeholder). Zero vscode imports — pure TypeScript data types testable under bare Mocha.
- `src/tree/provider.ts` — `GsdTreeProvider` implementing `vscode.TreeDataProvider<GsdTreeItem>` and `vscode.Disposable`:
  - `update(state)` stores snapshot and fires `onDidChangeTreeData(undefined)` (full-tree refresh)
  - `setRecentCount(n)` controls Recent Activity limit (default 5)
  - `getTreeItem()` builds VS Code TreeItems with deterministic ids, correct ThemeIcons (play/pass-filled/circle-outline/history/pulse/target/check), collapsible states, and commands
  - `getChildren()` produces [section, ...phases] for root; goal+criteria for phase nodes; activity entries or placeholder for section nodes; [] for leaf nodes
  - `dispose()` cleans up the internal EventEmitter
- `src/test/setup/vscode-stub.ts` — extended with `TreeItem`, `ThemeIcon`, `TreeItemCollapsibleState` classes and `window.createTreeView`, `window.registerTreeDataProvider`, `commands.executeCommand` stubs
- `src/test/tree/provider.test.ts` — 32 unit tests across PANL-02/03/04/07 `describe` blocks

## TDD Gate Compliance

- RED commit: `ace090a` — `test(05-02)` — compile error (provider.ts did not exist), confirming RED state
- GREEN commit: `de2bd26` — `feat(05-02)` — 114 tests passing (32 new + 82 existing), zero regressions
- REFACTOR: not needed — implementation was clean on first pass

## Verification

```
114 passing (454ms)
```

All 32 new GsdTreeProvider cases pass. Zero regressions across 82 prior tests.

Additional checks:
- `grep -c "from 'vscode'" src/tree/items.ts` → 0 (items.ts is vscode-free)
- `grep -c "EventEmitter" src/tree/provider.ts` → 1 (EventEmitter present)
- `npm run compile` succeeds with no type errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. Threat register items confirmed:
- T-05-03 (label tampering): Labels are plain strings, VS Code renders as text only. Accepted.
- T-05-04 (headerLine elevation): `phase.headerLine` passed unchanged via command.arguments to `gsd.openRoadmap`; validation responsibility documented as plan-03 acceptance criterion.
- T-05-05 (DoS via recentCount): `_recentCount` bounded; slice is O(N) with small N. Accepted.
- T-05-SC (package installs): Zero new packages this plan. Confirmed.

## Self-Check: PASSED

- [x] `src/tree/items.ts` exists with GsdTreeItem discriminated union
- [x] `src/tree/provider.ts` exists exporting GsdTreeProvider
- [x] `src/test/tree/provider.test.ts` exists with 32 test cases
- [x] `src/test/setup/vscode-stub.ts` modified with tree stubs
- [x] Commit 88ef976 exists (Task 1 — stubs + items)
- [x] Commit ace090a exists (Task 2 — RED tests)
- [x] Commit de2bd26 exists (Task 3 — GREEN implementation)
- [x] Full test suite: 114 passing, 0 failing
- [x] `src/tree/items.ts` contains zero vscode imports
- [x] `src/tree/provider.ts` contains EventEmitter
