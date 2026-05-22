# Roadmap: GSD Status — VS Code Extension

## Overview

Six vertical slices that build a living GSD workflow status display inside VS Code. Phase 1 ships the smallest observable thing — a status bar item reading a real ROADMAP.md — and each subsequent phase layers on parsers, live watching, commands, a side panel, and final packaging. Every phase delivers something a developer can see and use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffold + Minimal Status Bar** - Working extension scaffold that shows current phase name in VS Code status bar by reading a real ROADMAP.md (completed 2026-05-20)
- [x] **Phase 2: Parsers + Tests** - Pure, fully-tested parser modules for ROADMAP.md and STATE.md — no VS Code host required to run tests (completed 2026-05-20)
- [x] **Phase 3: StateController + File Watching** - Live state management with FileSystemWatcher, debounce, and periodic refresh fallback wired to the status bar (completed 2026-05-21)
- [x] **Phase 4: Tooltip, Commands + Configuration** - Complete status bar surface with hover tooltip, user commands in the Command Palette, and configurable settings (completed 2026-05-21)
- [x] **Phase 5: Side Panel TreeView** - Activity Bar side panel listing all phases with active phase highlight, recent activity, and welcome view (completed 2026-05-21)
- [x] **Phase 6: Packaging + Distribution** - Distributable .vsix build with verified size, compatibility, and documented install instructions (completed 2026-05-21)
- [ ] **Phase 7: Milestone-Collapsed Roadmap Support** - Parser handles milestone-collapsed ROADMAP.md and the TreeView groups phases under their milestones (gap closure — extension errored on multi-milestone projects)

## Phase Details

### Phase 1: Scaffold + Minimal Status Bar
**Goal**: Developer sees current phase name in VS Code status bar when opening a workspace that already has .planning/ROADMAP.md
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05, STAT-01, STAT-02, WSP-01
**Success Criteria** (what must be TRUE):
  1. Developer opens a workspace with .planning/ROADMAP.md and sees `$(icon) Milestone › Phase` in the VS Code status bar without any manual action
  2. Developer opens a workspace without .planning/ and sees `GSD: No project` in the status bar
  3. Extension activates via onStartupFinished and never blocks VS Code startup
  4. All disposables (status bar item) are registered in context.subscriptions so they clean up on deactivation
  5. Extension manifest is complete (publisher, name, displayName, description, categories, repository, LICENSE)
**Plans**: 2 plans
- [x] 01-01-PLAN.md — Hand-written extension scaffold (manifest, tsconfig, .vscodeignore, LICENSE, README, launch.json)
- [x] 01-02-PLAN.md — Extension activation + StatusBarItem with inline parseLite helper
**UI hint**: yes

### Phase 2: Parsers + Tests
**Goal**: Pure parser modules for ROADMAP.md and STATE.md with full unit test coverage runnable without a VS Code Extension Development Host
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PARS-01, PARS-02, PARS-03, PARS-04, PARS-05
**Success Criteria** (what must be TRUE):
  1. Developer runs `npm test` and parser unit tests pass (canonical, partial, malformed inputs) without launching VS Code
  2. ROADMAP.md parser returns typed RoadmapData (project name, phases, goals, mode, success criteria, line numbers) for any valid GSD roadmap file
  3. STATE.md parser returns typed StateData (milestone, phase id/name, last entry text + timestamp) for any valid GSD state file
  4. Both parsers handle missing fields, partial files, and CRLF/LF line endings without throwing
  5. A stress test with pathological regex input passes in <100ms, confirming no catastrophic backtracking
**Plans**: 2 plans
- [ ] 02-01-PLAN.md — Install Mocha harness, define parser types + line helper, stage fixtures
- [ ] 02-02-PLAN.md — TDD parseRoadmap + parseState + PARS-05 stress guard

### Phase 3: StateController + File Watching
**Goal**: Status bar updates automatically within 500ms whenever ROADMAP.md or STATE.md changes on disk, with no editor blocking
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: WSP-02, WSP-03, WSP-04, WAT-01, WAT-02, WAT-03, WAT-04, STAT-05
**Success Criteria** (what must be TRUE):
  1. Developer saves ROADMAP.md and sees the status bar reflect the new phase name within 500ms
  2. Developer initializes a new GSD project (.planning/ created after VS Code is already open) and the status bar activates without a window reload
  3. Parse or I/O errors show an "Error parsing GSD files" status in the status bar rather than crashing or silently failing
  4. Developer verifies via Activity Monitor (or Task Manager) that the watcher causes no CPU spike on repeated rapid file saves
  5. Periodic refresh fallback fires on the configured interval (default 30s) even when no file-change events arrive
**Plans**: 2 plans
- [x] 03-01-PLAN.md — TDD GsdState + debounce util + StateController atomic refresh (WSP-02/03/04)
- [x] 03-02-PLAN.md — Wire FileSystemWatcher + 30s timer; replace parseLite in extension.ts (WAT-01/02/03/04, STAT-05)

### Phase 4: Tooltip, Commands + Configuration
**Goal**: Developer can hover the status bar for full detail, open GSD files from the Command Palette, and adjust refresh behavior from VS Code settings
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: STAT-03, STAT-04, CMD-01, CMD-02, CMD-03, CMD-04, CFG-01, CFG-02, CFG-03
**Success Criteria** (what must be TRUE):
  1. Developer hovers the status bar item and sees milestone name, active phase name + goal, and the most recent STATE.md entry with timestamp
  2. Developer runs `GSD: Open Roadmap` from the Command Palette and .planning/ROADMAP.md opens in an editor tab (or an info message appears if absent)
  3. Developer runs `GSD: Open State` and `GSD: Refresh` from the Command Palette and both behave correctly
  4. Developer changes gsd.refreshIntervalSeconds in VS Code settings and the periodic timer restarts at the new interval without a window reload
  5. All GSD commands are discoverable in the Command Palette under the "GSD" category
**Plans**: 3 plans
- [x] 04-01-PLAN.md — TDD relativeTime() + MarkdownString tooltip builders, wired into the status bar (STAT-03, STAT-04)
- [x] 04-02-PLAN.md — Three Command Palette commands under the "GSD" category (CMD-01..04)
- [x] 04-03-PLAN.md — Two configuration settings + live timer restart via onDidChangeConfiguration (CFG-01..03)
**UI hint**: yes

### Phase 5: Side Panel TreeView
**Goal**: Developer can browse all GSD phases, see the active phase highlighted, and view recent STATE.md activity from a dedicated Activity Bar panel
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PANL-01, PANL-02, PANL-03, PANL-04, PANL-05, PANL-06, PANL-07
**Success Criteria** (what must be TRUE):
  1. Developer opens the GSD Activity Bar panel and sees all phases from ROADMAP.md listed as expandable nodes, with the active phase visually distinguished
  2. Developer expands a phase node and sees its goal and success criteria as child items
  3. Developer sees a "Recent Activity" section at the top of the tree showing the last 5 STATE.md entries
  4. Developer opens a workspace with no .planning/ and sees the welcome view: "No GSD project found. Run /gsd:new-project to initialize."
  5. Developer clicks the manual refresh toolbar button in the TreeView and the tree updates immediately
**Plans**: 3 plans
- [x] 05-01-PLAN.md — Extend STATE.md parser with recentEntries array (TDD)
- [x] 05-02-PLAN.md — GsdTreeItem types + GsdTreeProvider with tree stubs (TDD)
- [x] 05-03-PLAN.md — Activity Bar contributions, SVG icon, welcome view, extension wiring
**UI hint**: yes

### Phase 6: Packaging + Distribution
**Goal**: Developer can install the extension from a .vsix file in VS Code stable with a single command and share it without a marketplace publisher account
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04
**Success Criteria** (what must be TRUE):
  1. Developer runs `npm run package` and a .vsix file is produced with no errors
  2. Developer runs `code --install-extension gsd-status-*.vsix` and the extension installs and activates cleanly in VS Code stable
  3. Developer runs `vsce ls` and confirms packaged size is under 500 KB with no source files, test files, or planning docs included
  4. README.md documents install steps, a feature overview, and includes a screenshot of the status bar and tree panel
**Plans**: 2 plans
- [x] 06-01-PLAN.md — Packaging toolchain: install @vscode/vsce, fix scripts + .vscodeignore, build verified .vsix
- [x] 06-02-PLAN.md — Documentation: CHANGELOG.md v0.1.0 + expanded README.md with install/features/settings

### Phase 7: Milestone-Collapsed Roadmap Support
**Goal**: A developer with a multi-milestone GSD project sees the extension work correctly — phases grouped under their milestones — instead of "GSD: Error", because the parser handles a milestone-collapsed ROADMAP.md
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: PARS-06, PARS-07, PANL-08
**Success Criteria** (what must be TRUE):
  1. Opening a project whose ROADMAP.md is milestone-collapsed (no `### Phase N:` detail headers; phases under `<details>` blocks plus a `## Progress` table) shows the phases — never the "GSD: Error" state
  2. The parser sources the phase list from the `## Progress` table when no `### Phase N:` headers are present, and still parses normal expanded roadmaps unchanged
  3. The parser extracts milestone grouping (which phases belong to which milestone) from the roadmap
  4. The TreeView renders milestones as top-level nodes with their phases nested underneath; the active phase remains visually distinguished
  5. This extension's own ROADMAP.md, once v1.0 is milestone-collapsed, is displayed correctly by the extension
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold + Minimal Status Bar | 2/2 | Complete   | 2026-05-20 |
| 2. Parsers + Tests | 2/2 | Complete   | 2026-05-20 |
| 3. StateController + File Watching | 2/2 | Complete   | 2026-05-21 |
| 4. Tooltip, Commands + Configuration | 3/3 | Complete   | 2026-05-21 |
| 5. Side Panel TreeView | 3/3 | Complete   | 2026-05-21 |
| 6. Packaging + Distribution | 2/2 | Complete   | 2026-05-21 |
| 7. Milestone-Collapsed Roadmap Support | 0/TBD | Not started | - |
