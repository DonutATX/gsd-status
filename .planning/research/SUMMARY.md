# Research Summary — GSD Status VS Code Extension

## Executive Summary

A VS Code extension that surfaces live GSD workflow state (milestone, active phase, last GSD step) via a status bar item and TreeView side panel, reading `.planning/ROADMAP.md` and `.planning/STATE.md` from the local workspace. Recommended approach: TypeScript on the VS Code Extension API directly — no bundler, no runtime dependencies, no third-party Markdown parser. The `yo code` scaffold ("New Extension (TypeScript)", unbundled) is the correct starting point; `tsc` compiles to `dist/`, `@vscode/vsce` packages the `.vsix`.

The architecture cleanly separates pure parser functions (no `vscode` imports, fully unit-testable) from a `StateController` orchestrator and thin UI wrappers (`StatusBarController`, `GsdTreeDataProvider`). A single `FileSystemWatcher` on `.planning/{ROADMAP,STATE}.md` drives refresh, with a configurable periodic fallback for WSL2 and network paths. All resources are pushed to `context.subscriptions` for automatic disposal. Build order is bottom-up: types → parsers → state controller → UI → watcher → commands → wiring.

Top risks — none novel, all with well-documented VS Code solutions:
1. Windows backslash path bug in `FileSystemWatcher` → use `vscode.RelativePattern` always
2. Missing disposal of watchers/timers → `context.subscriptions` discipline from Phase 1
3. Missing debounce on rapid file changes → 300–400ms debounce in the watcher layer

## Key Findings

### Stack (HIGH confidence)
- TypeScript 5.8 + `@types/vscode@^1.95.0` + `tsc` — zero runtime deps means no bundling benefit
- `@vscode/test-cli@^0.0.12` + `@vscode/test-electron@^2.5.2` + `mocha@^11` — current Microsoft-recommended test pair
- `@vscode/vsce@^3.9.1` — packages `.vsix` without marketplace account
- `vscode.workspace.createFileSystemWatcher` only — do NOT pull in `chokidar`
- Hand-rolled line scanner for ROADMAP.md / STATE.md — ~60 lines of regex, zero deps, faster than `markdown-it`/`remark`
- `engines.vscode: "^1.95.0"` for broad coverage with all needed APIs

### Features
**Table stakes (must ship for v1 to not feel broken):**
- Status bar item always visible (milestone + active phase)
- Hover tooltip with milestone, phase goal, last GSD step
- TreeView listing all phases; active phase visually distinguished
- Auto-refresh via FileSystemWatcher + periodic fallback (configurable, default ~30s)
- "No GSD project" graceful fallback state
- Commands: refresh, open ROADMAP.md, open STATE.md
- Manual refresh button on the TreeView toolbar

**Differentiators (post-MVP, v1.x):**
- Success criteria checklist nodes in TreeView (`$(pass-filled)` / `$(circle-outline)`)
- Activity Bar badge showing phase completion count (`TreeView.badge`, VS Code 1.72+)
- Brief status bar flash on STATE.md change (validate it's not annoying first)

**Anti-features (deliberately excluded):**
- No writes to `.planning/`
- No GSD CLI command invocation from the extension
- No webview (TreeView is the right primitive)
- No multi-workspace aggregation
- No telemetry / cloud sync

### Architecture (7-component layered design)
1. `parsers/types.ts` — Domain types only; shapes everything
2. `parsers/roadmap-parser.ts` + `parsers/state-parser.ts` — Pure functions, zero `vscode` imports
3. `stateController.ts` — Orchestrator; owns `GsdState`; fires `onStateChanged` event to all UI
4. `ui/statusBarController.ts` — Thin wrapper updating `.text` and `.tooltip`
5. `ui/treeDataProvider.ts` — `TreeDataProvider` with `EventEmitter`; `refresh(state)` fires emitter
6. `watcher/workspaceWatcher.ts` — `RelativePattern` watcher + 300ms debounce + periodic timer (all `Disposable`)
7. `extension.ts` — Thin wiring file; instantiates, connects, pushes disposables to `context.subscriptions`

### Pitfalls (top 5)
1. **Windows backslash glob bug** — `FileSystemWatcher` registers silently but never fires when given a path with `\`. Always use `RelativePattern`. (VS Code issue #172939)
2. **Watcher/timer disposal** — `deactivate()` is not guaranteed. Push every resource (watcher, status bar item, status bar disposable, timer wrapper) to `context.subscriptions`.
3. **No debounce on rapid file changes** — A single file save fires 4–12 OS events; without ~300ms debounce, the status bar flickers and the tree collapses.
4. **`workspaceFolders` undefined crash** — Guard with `workspaceFolders?.[0]`; show "No GSD project" state; never create watchers without a workspace folder.
5. **Activation event** — Use `onStartupFinished`, not `*`, and not deep `workspaceContains` globs.

### Open questions for planning
- STATE.md exact grammar for "latest entry" — needs to be pinned before writing `state-parser.ts` (real STATE.md file review)
- Debounce window — tune against real GSD save burst duration
- Activity Bar icon SVG — Phase 4 detail, not blocking

## Roadmap Implications — Suggested Phase Structure

**Phase 1: Scaffold + Domain Types** — `yo code` scaffold, `onStartupFinished` activation, `workspaceFolders` guard, `.vscodeignore`, `context.subscriptions` discipline, and `GsdState`/`RoadmapData`/`StateData` types. Establishes the skeleton everything else hangs on.

**Phase 2: Parsers + StateController + Watcher** — Pure parser functions (unit-tested first, no VS Code host needed). `StateController` and `WorkspaceWatcher` built together so all four watcher pitfalls (backslash, debounce, timer disposal, WSL2 polling) land in one phase.

**Phase 3: Status Bar + Tooltip** — Thin rendering layer on `StateController` output. Delivers the core value proposition; validate UX before building the TreeView.

**Phase 4: TreeView Side Panel** — Requires working `StateController`. Includes Activity Bar icon, welcome view, toolbar refresh button, and the parse-and-diff partial-refresh model.

**Phase 5: Packaging + Distribution (.vsix)** — `vsce package`, `vsce ls` verification, engine compatibility check, `.vsix` size check (<500 KB). Marketplace publish deferred to a later milestone.

## Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions npm-verified; official VS Code docs |
| Features | HIGH | API docs + adjacent extensions analyzed |
| Architecture | HIGH | Matches official `vscode-extension-samples` and Microsoft dev blog |
| Pitfalls | HIGH | Backed by tracked VS Code GitHub issues with numbers cited |

**Overall: HIGH** — Ready for roadmap.
