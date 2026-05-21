---
phase: 05-side-panel-treeview
plan: "03"
subsystem: extension-wiring
tags: [activity-bar, tree-view, svg-icon, package-json, setContext, PANL-01, PANL-05, PANL-06]
dependency_graph:
  requires: [GsdTreeProvider (05-02), StateController]
  provides: [Activity Bar GSD panel, gsd.refreshTree command, gsd.hasProject context key]
  affects: [package.json, resources/gsd-icon.svg, src/extension.ts, src/test/extension.test.ts]
tech_stack:
  added: []
  patterns: [viewsContainers, viewsWelcome, setContext, createTreeView, onStateChanged-subscription]
key_files:
  created:
    - resources/gsd-icon.svg
  modified:
    - package.json
    - src/extension.ts
    - src/test/extension.test.ts
decisions:
  - "SVG icon uses checklist motif (24x24 viewBox, currentColor, single path, no width/height attributes)"
  - "Second onStateChanged subscription for setContext + provider.update registered before controller.refresh() to prevent welcome-view flash (Pitfall 2)"
  - "gsd.recentActivityCount config change triggers provider.setRecentCount + controller.refresh()"
metrics:
  duration: "8 minutes"
  completed: "2026-05-21"
  tasks: 3
  files: 4
---

# Phase 05 Plan 03: Activity Bar Panel Wiring and Package.json Contributions Summary

**One-liner:** Wired the Activity Bar GSD panel by contributing `viewsContainers`, `views`, `viewsWelcome`, `gsd.refreshTree` command, and `view/title` menu in `package.json`, plus registering `GsdTreeProvider` via `createTreeView` and driving `gsd.hasProject` context key in `activate()`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Activity Bar SVG icon and package.json contributions | 607e4cd | resources/gsd-icon.svg, package.json |
| 2 | Wire GsdTreeProvider into extension.ts | c60bd61 | src/extension.ts |
| 3 | Smoke test that gsd.refreshTree is registered | c22e093 | src/test/extension.test.ts |

## What Was Built

- `resources/gsd-icon.svg` — 24x24 monochrome SVG checklist icon using `fill="currentColor"`, single `<path>`, no `width`/`height`, no hardcoded hex colors
- `package.json` extensions:
  - `contributes.viewsContainers.activitybar` — `{ id: "gsd", title: "GSD", icon: "resources/gsd-icon.svg" }`
  - `contributes.views.gsd` — `[{ id: "gsd.treeView", name: "GSD Workflow" }]`
  - `contributes.viewsWelcome` — exact no-project message, `when: "!gsd.hasProject"`
  - `contributes.commands` — `gsd.refreshTree` command with `$(refresh)` icon appended to existing 3 commands
  - `contributes.menus.view/title` — `gsd.refreshTree` action with `when: "view == gsd.treeView"` in `navigation` group
- `src/extension.ts` additions:
  - Import `GsdTreeProvider` from `./tree/provider.js`
  - Construct provider, read `gsd.recentActivityCount` (default 5), call `setRecentCount()`
  - Register `gsd.treeView` via `vscode.window.createTreeView`, push `treeView` + `provider` to `context.subscriptions`
  - Register `gsd.refreshTree` command calling `controller.refresh()`
  - Second `onStateChanged` subscription: `setContext('gsd.hasProject', state.kind === 'ok')` + `provider.update(state)` — registered before `void controller.refresh()`
  - Extended `onDidChangeConfiguration` to handle `gsd.recentActivityCount` changes
- `src/test/extension.test.ts` — Added `it` case asserting `gsd.refreshTree` is registered during `activate()` (PANL-06)

## Human Verification (Deferred UAT)

The plan's `checkpoint:human-verify` task is deferred for manual UAT:

1. Run `npm run compile` so `out/` is fresh.
2. Ensure `../gsd-test/.planning/` has a current ROADMAP.md and multi-entry STATE.md.
3. Press F5 to launch the Extension Development Host against `../gsd-test`.
4. Confirm the GSD icon appears in the Activity Bar; click it — the "GSD Workflow" panel opens.
5. Confirm "Recent Activity" is the first node and lists up to 5 STATE.md entries.
6. The active phase node uses the play icon and is expanded; done phases use check/pass-filled; pending phases use circle-outline.
7. Expand a phase node — confirm a "Goal: ..." child and one child per success criterion.
8. Click a phase node — ROADMAP.md opens at that phase's header line. Click a Recent Activity entry — STATE.md opens.
9. Click the toolbar refresh button — the tree updates; expanded nodes stay expanded.
10. Open a folder with no `.planning/` — confirm: "No GSD project found. Run /gsd:new-project to initialize."

## Verification

```
115 passing (454ms)
```

All 115 tests pass (1 new + 114 prior). Zero regressions.

Additional checks:
- `node -e` contributes check: `contributes OK`
- `grep -c currentColor resources/gsd-icon.svg` → 1
- `grep -c "createTreeView" src/extension.ts` → 1
- `npm run compile` succeeds with no type errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All wiring is live: `GsdTreeProvider.update()` is called on every `onStateChanged` event; `gsd.hasProject` context key is set on each state change.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns beyond what is in the plan's threat model. Threat register items confirmed:
- T-05-06 (welcome view flash): `setContext` called in `onStateChanged` registered before `controller.refresh()` — mitigated.
- T-05-07 (headerLine elevation): `gsd.openRoadmap` handler validates `headerLine` before `revealLine` use — pre-existing mitigation confirmed.
- T-05-08 (SVG tampering): Static authored asset, no script surface — accepted.
- T-05-SC (package installs): Zero new packages this plan — confirmed.

## Self-Check: PASSED

- [x] `resources/gsd-icon.svg` exists with `currentColor` and no hex colors
- [x] `package.json` contains `viewsContainers`, `views`, `viewsWelcome`, `gsd.refreshTree`, `view/title` menu
- [x] `src/extension.ts` imports GsdTreeProvider, creates treeView, registers gsd.refreshTree
- [x] `src/test/extension.test.ts` asserts `gsd.refreshTree` is registered
- [x] Commit 607e4cd exists (Task 1)
- [x] Commit c60bd61 exists (Task 2)
- [x] Commit c22e093 exists (Task 3)
- [x] Full test suite: 115 passing, 0 failing
