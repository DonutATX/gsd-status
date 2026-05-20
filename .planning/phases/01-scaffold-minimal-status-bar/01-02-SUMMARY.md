---
phase: 01-scaffold-minimal-status-bar
plan: 02
subsystem: extension-entrypoint
tags: [extension, status-bar, parser, activation]
dependency-graph:
  requires:
    - package.json (manifest, activationEvents=onStartupFinished, main=./out/extension.js)
    - tsconfig.json (strict mode, outDir=out, rootDir=src)
  provides:
    - src/extension.ts (activate, deactivate, updateStatusBar, parseLite)
    - out/extension.js (compiled output, loadable by VS Code)
  affects:
    - Phase 2 will replace parseLite with a full parser module
    - Phase 3 will add file watching (currently one-shot read on activation)
    - Phase 4 will add tooltip/command/click handlers
tech-stack:
  added: []
  patterns:
    - Sync activate() with fire-and-forget async I/O (never block extension host)
    - Inline regex parser (≤40 LOC) — replaced wholesale in Phase 2
    - Three-state status bar (GSD: No project | $(pulse) {milestone} › {phase} | GSD: Parse error)
key-files:
  created:
    - src/extension.ts
  modified: []
decisions:
  - Inline parseLite in extension.ts (no src/roadmap-lite.ts) — Phase 2 deletes it wholesale, so splitting now is churn
  - Milestone resolution order — first `## Milestone vX.Y` header, else H1 with `Roadmap:` prefix / `— Roadmap` suffix stripped, else literal `GSD` — handles current ROADMAP shape and future milestone-tagged shapes
  - activate() is synchronous; updateStatusBar is fire-and-forget via `void` — eliminates host-blocking risk per RESEARCH anti-pattern
  - Default `item.text = 'GSD: No project'` set synchronously before async read so the bar is never empty during the I/O window
metrics:
  duration_minutes: 3
  completed_date: 2026-05-20
  tasks_completed: 1
  files_created: 1
---

# Phase 1 Plan 2: Extension Activation + Inline parseLite Summary

Implemented `src/extension.ts` (83 lines, parseLite is 30 LOC) with a sync `activate()` that creates a left-aligned, priority-100 `StatusBarItem`, registers it in `context.subscriptions`, and fires `updateStatusBar()` to read `.planning/ROADMAP.md` once — rendering `$(pulse) GSD Status — VS Code Extension › Phase 1: Scaffold + Minimal Status Bar` against this repo's real ROADMAP.

## Tasks Completed

| # | Task                                                                   | Commit    | Files             |
| - | ---------------------------------------------------------------------- | --------- | ----------------- |
| 1 | Implement activate(), deactivate(), updateStatusBar(), parseLite()     | `1cf2efe` | src/extension.ts  |

Task 2 (human-verify F5 checkpoint) is intentionally deferred to the orchestrator / human reviewer per the execute_plan_context note — the manual three-scenario F5 walk through cannot be executed by the agent.

## Verification Results

- `npx tsc --noEmit` → **0 errors** (strict mode satisfied)
- `npm run compile` → produced `out/extension.js` (3.9K) + sourcemap (2.4K)
- API contract greps:
  - `createStatusBarItem(\s*vscode.StatusBarAlignment.Left,\s*100` → **match**
  - `context.subscriptions.push` → **match**
  - `.show()` → **match**
  - `workspaceFolders?.[0]` → **match**
  - `item.tooltip` / `item.command =` → **NO match** (Phase 4 boundary preserved)
- parseLite dry-run against real `.planning/ROADMAP.md` →
  `{"milestone":"GSD Status — VS Code Extension","phase":"Phase 1: Scaffold + Minimal Status Bar"}`
- **Expected Scenario A status bar string** (manual F5 will confirm):
  `$(pulse) GSD Status — VS Code Extension › Phase 1: Scaffold + Minimal Status Bar`

## Requirements Satisfied

- **SCAF-02** — `activationEvents: ["onStartupFinished"]` (set in plan 01-01) drives `activate()` on host startup
- **SCAF-04** — Sole disposable (the `StatusBarItem`) is pushed to `context.subscriptions` immediately after creation
- **STAT-01** — Status bar item is left-aligned at priority 100, `.show()` called, rendered as `$(pulse) {milestone} › {phase}` on success
- **STAT-02** — Missing `.planning/`, missing `ROADMAP.md`, or any `fs.readFile` failure all fall through to `GSD: No project`
- **WSP-01** — Uses `vscode.workspace.workspaceFolders?.[0]`; both `undefined` and missing-ROADMAP paths converge to `GSD: No project`

## Key Decisions

1. **Inline parseLite** — kept in `extension.ts` (~30 LOC) rather than a sibling module; Phase 2 will replace it wholesale, so factoring now produces a file Phase 2 deletes.
2. **Milestone resolution precedence** — `## Milestone vX.Y` > H1-with-prefix-stripping > literal `"GSD"`; resolves RESEARCH Open Question 1 and keeps the parser robust as the ROADMAP evolves.
3. **Three-state status bar** — `GSD: No project` (no folder / no ROADMAP / read error) | `$(pulse) {ms} › {ph}` (parse OK) | `GSD: Parse error` (read OK but parse threw). Matches CONTEXT.md locked decisions verbatim.
4. **Sync activate()** — `activate()` is not `async`. All I/O is in `void updateStatusBar(item)` so the activation handler returns in O(microseconds) and an unhandled rejection inside the async update can never propagate to the host (every code path inside `updateStatusBar` lands in a try/catch that sets text and returns).
5. **No `vscode.workspace.fs`** — used `node:fs/promises` instead. Acceptable per RESEARCH ("Don't Hand-Roll" table) since Phase 1 is local-only; Phase 3 may migrate when remote-workspace support is in scope.

## Deviations from Plan

None — plan executed exactly as written. parseLite landed at 30 LOC (under the 40-line cap). All locked decisions, regex shapes, and fallback text strings match CONTEXT.md and the plan's `<action>` block verbatim.

## Threat Mitigations Confirmed

- **T-01-02-01** (Catastrophic regex backtracking): parseLite uses linear regex only — no nested quantifiers. Three regex patterns (`^##\s+Milestone\s+v\d+\.\d+[^\n]*$`, `^#\s+(.+)$`, `^###\s+(Phase\s+\d+:\s+.+)$`) all have single-quantifier shape. PARS-05 stress test arrives Phase 2.
- **T-01-02-02** (activate() exception kills host): `activate()` is sync and contains no `await`; the async `updateStatusBar` wraps `fs.readFile` and `parseLite` in independent try/catch blocks that always end in an `item.text = …` assignment + return. No code path inside the activation lifecycle can throw.
- **T-01-02-03** (Path tampering): `roadmapPath` is constructed with `path.join(folder.uri.fsPath, '.planning', 'ROADMAP.md')` — no user-supplied path segments. Symlink-following is accepted (user's own workspace).
- **T-01-02-04** (ROADMAP content disclosure): accepted per threat register — the user owns the file and already reads it.

## Open Items for Phase 2+

- Manual F5 verification (the human-verify checkpoint) — the orchestrator/human runs the three scenarios; no agent action.
- Phase 2 will replace `parseLite` with a tested parser module under `src/parsers/` plus the `@vscode/test-cli` + `mocha` harness.
- Phase 3 will swap the one-shot `updateStatusBar` call for a `FileSystemWatcher`-driven refresh.

## Self-Check: PASSED

- FOUND: src/extension.ts
- FOUND: out/extension.js (3.9K, produced by `npm run compile`)
- FOUND commit: 1cf2efe (Task 1 — feat(01-02): implement extension activation and inline parseLite)
- VERIFIED: parseLite output against real `.planning/ROADMAP.md` matches both acceptance criteria values exactly
