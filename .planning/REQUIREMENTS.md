# Requirements: GSD Status — VS Code Extension

**Defined:** 2026-05-20
**Core Value:** A developer running GSD in a project can glance at VS Code and immediately know: which milestone, which phase, and what just happened — without leaving the editor.

## v1 Requirements

### Scaffold & Activation

- [ ] **SCAF-01**: Extension scaffolded as a TypeScript VS Code extension (`yo code`, unbundled) with `engines.vscode: "^1.95.0"` and `@types/vscode` pinned to the same minor
- [x] **SCAF-02**: Activation event is `onStartupFinished` so the extension never blocks VS Code startup
- [ ] **SCAF-03**: `.vscodeignore` configured so the packaged `.vsix` excludes sources, tests, planning docs, and dev-only files
- [x] **SCAF-04**: All disposables (status bar item, watcher, timer wrapper, tree view) are pushed to `context.subscriptions`
- [ ] **SCAF-05**: Extension manifest declares `publisher`, `name`, `displayName`, `description`, `categories`, repository URL, and a `LICENSE` is present

### Parsing

- [ ] **PARS-01**: Pure parser module reads ROADMAP.md text and returns a typed `RoadmapData` (project name, phases with `name`, `goal`, `mode`, `successCriteria`, source line numbers) — zero `vscode` imports
- [ ] **PARS-02**: Pure parser module reads STATE.md text and returns a typed `StateData` (current milestone, current phase id/name, last entry text + timestamp) — zero `vscode` imports
- [ ] **PARS-03**: Parsers handle missing fields, partial files, and CRLF/LF line endings without throwing
- [ ] **PARS-04**: Parser modules have unit tests (mocha + @vscode/test-cli) covering canonical, partial, and malformed inputs; no VS Code Extension Development Host required to run them
- [ ] **PARS-05**: Parser regex avoids catastrophic backtracking — verified by a stress test with pathological input

### Workspace Detection & State

- [x] **WSP-01**: Extension uses `workspaceFolders?.[0]` and shows a "No GSD project" state when no workspace folder, no `.planning/` directory, or no `ROADMAP.md` is present
- [ ] **WSP-02**: `StateController` owns the current `GsdState`, calls parsers on refresh, and fires an `onStateChanged` event consumed by all UI surfaces
- [ ] **WSP-03**: `StateController.refresh()` reads both ROADMAP.md and STATE.md atomically (one logical refresh, one event emission)
- [ ] **WSP-04**: Parse / I/O errors are surfaced as an "Error parsing GSD files" status (not a thrown exception that kills the controller)

### File Watching & Refresh

- [ ] **WAT-01**: `FileSystemWatcher` uses `vscode.RelativePattern(workspaceFolder, '.planning/{ROADMAP,STATE}.md')` — never a string built with `path.join`
- [ ] **WAT-02**: Watcher callbacks are debounced (~300ms) so a single save's 4–12 OS events trigger one refresh
- [ ] **WAT-03**: A periodic refresh timer runs as a `Disposable` (interval cleared on dispose); default interval 30s, configurable via `contributes.configuration`
- [ ] **WAT-04**: Watcher also fires when `.planning/` is created after VS Code is already open (extension picks up newly-initialized GSD projects without reload)

### Status Bar UI

- [x] **STAT-01**: Status bar item is always visible (left-aligned, low priority) and shows `$(icon) Milestone › Phase` when a GSD project is detected
- [x] **STAT-02**: Status bar shows `GSD: No project` when no `.planning/` is detected in the active workspace
- [x] **STAT-03**: Hover tooltip shows milestone name, active phase name + goal, and the most recent STATE.md entry (text + timestamp)
- [x] **STAT-04**: Status bar item has a default command (clicking it runs `gsd.openState` or opens the side panel — choose one and document)
- [ ] **STAT-05**: Status bar text updates ≤500ms after a debounced file-change event under normal load

### Side Panel (TreeView)

- [ ] **PANL-01**: A TreeView is contributed under a dedicated Activity Bar view container with an SVG icon
- [x] **PANL-02**: Tree displays all phases from ROADMAP.md as top-level nodes; the active phase is visually distinguished (theme icon)
- [x] **PANL-03**: Each phase node is expandable to reveal its goal and success criteria as child items
- [x] **PANL-04**: A "Recent Activity" section at the top of the tree shows the last N (default 5) STATE.md entries
- [ ] **PANL-05**: A welcome view shows "No GSD project found. Run `/gsd:new-project` to initialize." when no `.planning/` exists
- [ ] **PANL-06**: TreeView toolbar exposes a manual refresh action
- [x] **PANL-07**: Tree refresh uses `EventEmitter`-based `onDidChangeTreeData` and does not fully collapse on every update (partial refresh / stable identities)

### Commands

- [x] **CMD-01**: `gsd.refresh` — manually trigger `StateController.refresh()`
- [x] **CMD-02**: `gsd.openRoadmap` — open `.planning/ROADMAP.md` in an editor tab (no-op with info message if absent)
- [x] **CMD-03**: `gsd.openState` — open `.planning/STATE.md` in an editor tab (no-op with info message if absent)
- [x] **CMD-04**: All commands appear in the Command Palette under a "GSD" category and are wired into the extension activation

### Configuration

- [x] **CFG-01**: `gsd.refreshIntervalSeconds` (number, default 30, min 5) — periodic refresh interval
- [x] **CFG-02**: `gsd.recentActivityCount` (number, default 5, min 1) — how many recent STATE.md entries to surface
- [x] **CFG-03**: Configuration changes apply without a window reload (listener re-creates timer / refreshes tree)

### Packaging & Distribution

- [ ] **PKG-01**: `npm run package` produces a `.vsix` via `@vscode/vsce` that installs cleanly in VS Code stable
- [ ] **PKG-02**: `vsce ls` output reviewed; packaged size <500 KB
- [ ] **PKG-03**: Compatibility verified on the minimum declared `engines.vscode` version
- [ ] **PKG-04**: README.md documents install (`code --install-extension <vsix>`), feature overview, and screenshot of status bar + tree

## v2 Requirements

Deferred until v1 is shipped and validated.

### Marketplace Publishing

- **MKT-01**: Publisher account created and verified
- **MKT-02**: GitHub Actions workflow publishes `.vsix` to the Marketplace on tag push
- **MKT-03**: Marketplace listing assets prepared (icon 128×128, gallery banner, README rendering)

### Advanced UX

- **UX-01**: Success criteria checklist nodes rendered with `$(pass-filled)` / `$(circle-outline)` icons
- **UX-02**: Activity Bar badge shows phase completion count
- **UX-03**: Status bar briefly highlights when STATE.md changes (validate non-annoying first)
- **UX-04**: Quick-pick command to jump to any phase node in the tree

## Out of Scope

| Feature | Reason |
|---------|--------|
| Writing to `.planning/` from the extension | Read-only by design; GSD CLI / Claude Code owns writes |
| Running GSD commands from the extension | Users prefer running GSD in their terminal of choice in v1 |
| Cross-workspace aggregation | Single-workspace scope keeps v1 simple |
| Webview-based custom UI | TreeView is the right primitive for hierarchical read-only data |
| Telemetry / cloud sync | Local-file-driven; no servers, no accounts |
| Bundler (esbuild/webpack) | Zero runtime deps — `tsc` is sufficient; add bundler only if deps appear |
| `chokidar` for file watching | `vscode.workspace.createFileSystemWatcher` is the supported API |
| Third-party Markdown parsers (markdown-it/remark) | Hand-rolled line scanner is simpler and faster for our limited grammar |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01 | Phase 1 | Pending |
| SCAF-02 | Phase 1 | Complete |
| SCAF-03 | Phase 1 | Pending |
| SCAF-04 | Phase 1 | Complete |
| SCAF-05 | Phase 1 | Pending |
| STAT-01 | Phase 1 | Complete |
| STAT-02 | Phase 1 | Complete |
| WSP-01 | Phase 1 | Complete |
| PARS-01 | Phase 2 | Pending |
| PARS-02 | Phase 2 | Pending |
| PARS-03 | Phase 2 | Pending |
| PARS-04 | Phase 2 | Pending |
| PARS-05 | Phase 2 | Pending |
| WSP-02 | Phase 3 | Pending |
| WSP-03 | Phase 3 | Pending |
| WSP-04 | Phase 3 | Pending |
| WAT-01 | Phase 3 | Pending |
| WAT-02 | Phase 3 | Pending |
| WAT-03 | Phase 3 | Pending |
| WAT-04 | Phase 3 | Pending |
| STAT-05 | Phase 3 | Pending |
| STAT-03 | Phase 4 | Complete |
| STAT-04 | Phase 4 | Complete |
| CMD-01 | Phase 4 | Complete |
| CMD-02 | Phase 4 | Complete |
| CMD-03 | Phase 4 | Complete |
| CMD-04 | Phase 4 | Complete |
| CFG-01 | Phase 4 | Complete |
| CFG-02 | Phase 4 | Complete |
| CFG-03 | Phase 4 | Complete |
| PANL-01 | Phase 5 | Pending |
| PANL-02 | Phase 5 | Complete |
| PANL-03 | Phase 5 | Complete |
| PANL-04 | Phase 5 | Complete |
| PANL-05 | Phase 5 | Pending |
| PANL-06 | Phase 5 | Pending |
| PANL-07 | Phase 5 | Complete |
| PKG-01 | Phase 6 | Pending |
| PKG-02 | Phase 6 | Pending |
| PKG-03 | Phase 6 | Pending |
| PKG-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 after roadmap creation*
