# Phase 5: Side Panel TreeView - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 adds a dedicated Activity Bar panel with a `TreeView` that lets a developer browse the GSD workflow without opening planning files. It contributes: a view container + view with a custom icon; a tree showing a "Recent Activity" section plus all ROADMAP.md phases as expandable nodes (active phase distinguished); per-phase child nodes for goal and success criteria; a welcome view when no `.planning/` exists; and a toolbar refresh action. It does NOT add status bar features (Phases 1–4) or packaging (Phase 6). It consumes the `gsd.recentActivityCount` setting declared in Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Tree Structure & Content
- "Recent Activity" is the first top-level node in the tree; phase nodes are listed below it.
- The number of recent entries shown is driven by the `gsd.recentActivityCount` setting (declared in Phase 4, default 5).
- The STATE.md parser is extended with an additive `recentEntries: StateEntry[]` field; the existing `lastEntry` field is kept unchanged. The TreeView reads `recentEntries`.
- An expanded phase node shows one "Goal" child item plus each success criterion as its own separate child node.

### Visual Distinction & Interaction
- Phase node icons are state-specific `ThemeIcon`s: active phase uses a distinct icon (e.g. `$(play)`), done phases use `$(pass-filled)`, pending phases use `$(circle-outline)`.
- Default collapse state: the active phase node is expanded; all other phase nodes are collapsed.
- Clicking a phase node opens `.planning/ROADMAP.md` at that phase's header line (RoadmapPhase exposes `headerLine`).
- The Activity Bar view container uses a simple custom GSD-themed SVG icon (checklist/pulse motif).

### Welcome View & Refresh
- The no-project state uses a `contributes.viewsWelcome` contribution showing the exact message: "No GSD project found. Run `/gsd:new-project` to initialize."
- The toolbar refresh button triggers `StateController.refresh()`; the tree updates by listening to `onStateChanged`.
- Tree refresh (PANL-07) fires `onDidChangeTreeData(undefined)` and uses stable element identities so VS Code preserves expansion state rather than collapsing the whole tree.
- Clicking a "Recent Activity" entry opens `.planning/STATE.md`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/state/controller.ts` — `StateController` owns state and fires `onStateChanged(GsdState)`. The TreeDataProvider subscribes to it exactly as `extension.ts` does for the status bar.
- `src/state/types.ts` — `GsdState` discriminated union (`ok` | `no-project` | `error`).
- `src/parsers/types.ts` — `RoadmapPhase` already exposes `name`, `goal`, `successCriteria`, `done`, `headerLine`, `endLine`; `StateData` exposes `lastEntry` (single) — needs the new `recentEntries` array.
- `src/parsers/state.ts` — `buildEntry()` constructs a `StateEntry`; extend to collect multiple entries into `recentEntries`.
- `src/extension.ts` — `activate()` registers the status bar, commands, config listener; the TreeView registration and its refresh command slot in here, all pushed to `context.subscriptions`.

### Established Patterns
- All disposables pushed to `context.subscriptions` (SCAF-04).
- `StateController` is the single state owner; UI surfaces consume `onStateChanged` (WSP-02).
- Pure parsers in `src/parsers/`, zero `vscode` imports; tests run under bare Mocha via `vscode-stub.ts`.
- `.js` extension on relative imports (Node16 module resolution).

### Integration Points
- `package.json` `contributes`: add `viewsContainers` (Activity Bar), `views`, `viewsWelcome`, the tree refresh `command`, and a `menus` entry placing the refresh button in `view/title`.
- New file: a `TreeDataProvider` implementation (e.g. `src/tree/provider.ts`) plus tree node types.
- A custom SVG icon asset for the view container.
- `vscode-stub.ts` will need `TreeItem`, `ThemeIcon`, `TreeItemCollapsibleState`, `EventEmitter`, `window.registerTreeDataProvider` / `createTreeView` stubs for tests.

</code_context>

<specifics>
## Specific Ideas

Standard VS Code Extension API patterns — `TreeDataProvider<T>`, `onDidChangeTreeData` `EventEmitter`, `contributes.viewsContainers`/`views`/`viewsWelcome`, `TreeItem` with `ThemeIcon` and `command`. No third-party tree libraries.

</specifics>

<deferred>
## Deferred Ideas

- Success-criteria checklist nodes with pass/fail icons (UX-01) — v2.
- Activity Bar badge showing phase completion count (UX-02) — v2.
- Quick-pick to jump to any phase node (UX-04) — v2.

</deferred>
