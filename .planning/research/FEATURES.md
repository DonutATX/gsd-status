# Feature Research

**Domain:** VS Code extension — workflow status visualization (status bar + side panel reading local Markdown project files)
**Researched:** 2026-05-20
**Confidence:** HIGH (VS Code Extension API docs verified; adjacent extension patterns observed directly)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Status bar item always visible | Every productivity extension that surfaces project state uses the status bar; users expect to glance down and see status | LOW | Use `StatusBarAlignment.Left`; higher priority number pushes it left of other items |
| Short, scannable status bar text | GitLens, GitHub Actions, and every status extension use terse labels (branch name, run status); wall-of-text in status bar is a UX violation | LOW | Pattern: `$(icon) Milestone › Phase` — keep under ~40 chars |
| Hover tooltip with full detail | VS Code UX guidelines explicitly call out tooltip as the place for extended info; users hover when they want more without clicking | LOW | `StatusBarItem.tooltip` accepts MarkdownString — use bold + line breaks for milestone / phase goal / last step |
| Click status bar item → focus side panel | Standard VS Code pattern: clicking a status bar item runs a command; users expect one click to expand detail | LOW | Register a `gsd.focusPanel` command; set as the item's `command` property |
| Side panel TreeView in Activity Bar | GitLens, GitHub Actions, Todo Tree, Project Manager — all use a TreeView in the Activity Bar sidebar; users expect a dedicated icon | MEDIUM | `contributes.views` in `activitybar`; custom icon SVG required |
| TreeView lists all phases from ROADMAP.md | The panel exists to show structure; a flat "loading..." with no data feels broken | MEDIUM | Parse `### Phase N:` headers; render as tree nodes with status icons |
| Active phase visually distinguished | GitHub Actions extension highlights the active run; Todo Tree bolds active tags; users expect current state to be obvious | LOW | Use a distinct `ThemeIcon` (e.g., `$(debug-start)`) and/or bold label for active phase node |
| Auto-refresh on file change | FileSystemWatcher is a first-class VS Code API; extensions that require manual refresh feel broken to power users | LOW | `vscode.workspace.createFileSystemWatcher` on `**/.planning/{ROADMAP,STATE}.md` |
| Manual refresh command | Fallback for missed file-watch events; also gives users control; GitHub Actions, GitLens both expose explicit refresh | LOW | Register `gsd.refresh`; add to view/title toolbar with `$(refresh)` icon |
| "No GSD project" fallback state | Extensions that silently show nothing or throw errors when the target files are absent feel broken; GitLens shows "No repository" gracefully | LOW | Status bar shows `$(circle-slash) No GSD`; TreeView shows a Welcome View with instructions |
| Open ROADMAP.md command | Every "read metadata from file" extension provides a "go to source" escape hatch; users want to jump to the file when they need detail | LOW | `vscode.open` with file URI; add to command palette and view toolbar |
| Open STATE.md command | Same reasoning as ROADMAP.md; STATE.md is the second source file | LOW | Same pattern as above |
| Commands appear in Command Palette | All VS Code extension commands must be discoverable via `Ctrl+Shift+P`; missing this makes the extension feel unfinished | LOW | All commands must have `title` in `contributes.commands`; use `gsd.` prefix for namespace |

### Differentiators (Competitive Advantage)

Features that set this extension apart. Not expected by default, but would delight users of the GSD workflow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Last GSD step shown in status bar | No adjacent extension surfaces "last workflow action taken" — this is unique to GSD and gives instant "where was I?" context after returning to a project | LOW | Parse STATE.md for most recent timestamped entry; truncate to ~30 chars in status bar |
| Phase goal shown in tooltip | ROADMAP.md has `**Goal:**` per phase — surfacing this in the hover tooltip means users never need to open the file just to remind themselves what a phase is for | LOW | Extract `**Goal:**` line from current phase block during parse |
| Success criteria checklist in TreeView | ROADMAP.md has `**Success Criteria**:` checklists; rendering `[ ]` vs `[x]` as checkmark icons in the tree gives a visual progress summary unique to GSD | MEDIUM | Parse checklist items; use `$(pass-filled)` vs `$(circle-outline)` ThemeIcons |
| Periodic refresh interval (configurable) | File watchers can miss events (network drives, WSL, certain save modes); a configurable polling interval as a safety net is a thoughtful fallback that distinguishes a polished extension | LOW | Default 30s; expose as `gsd.refreshInterval` setting (integer, seconds); 0 = disable |
| "GSD project detected" welcome view | When `.planning/` is present but the panel is first opened, a concise welcome view explaining the two source files and how to trigger commands reduces first-use confusion | LOW | `contributes.viewsWelcome` with brief copy; only shown when tree is empty/uninitialized |
| Status bar color on active phase transition | When STATE.md changes (new step written), briefly flash the status bar item using `StatusBarItemAlignment` background — subtle acknowledgment that GSD just ran something | MEDIUM | Use `vscode.ThemeColor` for `statusBarItem.warningBackground` for 2s then revert; must not be jarring |
| Phase completion percentage badge | `TreeView.badge` API (VS Code 1.72+) allows a numeric badge on the activity bar icon; showing "3/7 phases complete" gives at-a-glance milestone progress without opening the panel | MEDIUM | Count `[x]` vs `[ ]` phase entries from ROADMAP.md; set `TreeView.badge.value` |

### Anti-Features (Deliberately Omit for v1)

Features that seem valuable but would undermine the extension's purpose, create maintenance burden, or violate the read-only contract.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Writing to .planning/ files | Users may want to check off phases or update STATE.md from the panel | Violates the read-only contract; GSD CLI and Claude Code own writes; adding write paths creates two competing sources of truth and potential data corruption | The extension is a viewer; direct users to the terminal / Claude Code for writes |
| Running GSD CLI commands from the extension | Convenience — "run /gsd:start-phase from a button" | Wrapping the CLI hides what's happening; GSD is designed as an AI-assisted workflow; running commands without Claude Code context produces incorrect results; also adds shell-invocation complexity | Open an integrated terminal and let users run commands themselves |
| Webview panel instead of TreeView | Rich HTML/CSS rendering for a "dashboard" look | Webviews are heavyweight, require a separate JS bundle, are harder to theme-consistently, slower to render, and overkill for structured Markdown data; TreeView is native and fast | Use TreeView with ThemeIcons for visual richness; tooltip MarkdownString for formatted detail |
| Cross-workspace / multi-root aggregation | Users with many GSD projects want a combined view | Dramatically increases parser scope, state management complexity, and edge cases; single-workspace scope is the right v1 constraint | Defer to v2; the architecture can add a workspace-aggregation layer later |
| Cloud sync / telemetry / analytics | Tracking usage or syncing state across machines | Local-file-driven is the core design principle; any network calls break the "offline-first" contract and raise privacy concerns | Never build this; GSD is intentionally local |
| Notification popups on STATE.md change | Alert users when a GSD step completes | Notifications are intrusive and would fire on every Claude Code write; users are already in VS Code running GSD — they do not need a popup | Status bar item update is sufficient; tooltip provides detail |
| Custom color themes / settings for status bar colors | Power-user personalization | VS Code UX guidelines explicitly say "do not add custom colors" to status bar items; violates platform conventions and breaks accessibility | Use platform ThemeColors only (e.g., `statusBarItem.warningBackground` for error states) |
| Keybindings for GSD commands | Discoverability shortcut | Default keybindings for niche workflow commands pollute the global keymap and create conflicts; there is no universal key that doesn't clash | Ship command palette access only; let users assign their own keybindings via VS Code's standard keybinding editor |
| Markdown preview panel for ROADMAP.md | Inline rendering of the planning file | VS Code's built-in Markdown preview (`Ctrl+Shift+V`) already does this perfectly; duplicating it adds complexity for zero net value | Point users to the built-in preview; the "Open ROADMAP.md" command is sufficient |

---

## Feature Dependencies

```
[Status Bar Item]
    └──requires──> [ROADMAP.md Parser]
    └──requires──> [STATE.md Parser]
    └──requires──> [File Watcher]
    └──enhances──> [Tooltip (MarkdownString)]
    └──enhances──> [Click → Focus Panel command]

[TreeView Side Panel]
    └──requires──> [ROADMAP.md Parser]
    └──requires──> [STATE.md Parser]
    └──requires──> [File Watcher]
    └──enhances──> [Phase goal in TreeItem description]
    └──enhances──> [Success criteria checklist nodes]
    └──enhances──> [Activity Bar badge (phase count)]

[File Watcher]
    └──enhances──> [Periodic Refresh Interval] (fallback if watcher misses events)

[ROADMAP.md Parser]
    └──produces──> [Milestone name]
    └──produces──> [Phase list with status]
    └──produces──> [Phase goal text]
    └──produces──> [Success criteria items]

[STATE.md Parser]
    └──produces──> [Last GSD step text]
    └──produces──> [Recent activity feed]

["No GSD project" Welcome View]
    └──requires──> [workspace scan for .planning/ directory]
    └──conflicts──> [normal TreeView content] (only one shown at a time)
```

### Dependency Notes

- **Status Bar Item requires parsers:** The bar renders nothing meaningful without parsed milestone/phase/last-step data.
- **TreeView requires parsers:** Same shared parsing layer; both consumers share one parser module.
- **File Watcher triggers both:** A single watcher refresh call updates both the status bar item and fires `onDidChangeTreeData` on the TreeView provider.
- **Periodic refresh enhances File Watcher:** The interval timer calls the same refresh path as the watcher — no separate code path needed.
- **"No GSD project" Welcome View conflicts with normal content:** VS Code's `contributes.viewsWelcome` is shown only when `getChildren()` returns empty; this is the natural VS Code pattern.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what is needed to validate the core value proposition: "glance at VS Code and know where you are in GSD."

- [ ] Status bar item with milestone + active phase text — core glance-ability
- [ ] Hover tooltip showing milestone, phase goal, and last GSD step — eliminates need to open files for context
- [ ] Click status bar → focus side panel — standard discoverability pattern
- [ ] TreeView listing all phases with active phase visually distinguished — structure visibility
- [ ] Auto-refresh on ROADMAP.md and STATE.md file change — makes it feel live, not stale
- [ ] Periodic refresh fallback (configurable interval, default 30s) — reliability on Windows/WSL where file watchers can miss events
- [ ] "No GSD project" graceful fallback (status bar + welcome view) — prevents broken-feeling first impression
- [ ] Commands: `gsd.refresh`, `gsd.openRoadmap`, `gsd.openState` in command palette — required escape hatches
- [ ] Manual refresh button in view/title toolbar — power user control

### Add After Validation (v1.x)

Add once core v1 is in daily use and parser reliability is confirmed.

- [ ] Success criteria checklist nodes in TreeView — adds visual progress; requires robust ROADMAP.md parse
- [ ] Activity Bar badge showing phase completion count — high value, low code; requires TreeView.badge API (VS Code 1.72+)
- [ ] Status bar flash on STATE.md change — polish; validate that it isn't annoying before shipping

### Future Consideration (v2+)

Defer until product-market fit on v1 is established.

- [ ] Last GSD step shown directly in status bar text — trades real estate for convenience; validate whether users want this vs tooltip-only
- [ ] "GSD project detected" first-run welcome view — nice onboarding polish; not blocking v1
- [ ] Multi-root workspace support — meaningful architectural change; defer until v1 is proven

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Status bar item (milestone + phase) | HIGH | LOW | P1 |
| Tooltip (milestone + phase goal + last step) | HIGH | LOW | P1 |
| TreeView phase list | HIGH | MEDIUM | P1 |
| File watcher auto-refresh | HIGH | LOW | P1 |
| "No GSD project" fallback | HIGH | LOW | P1 |
| Open ROADMAP.md / STATE.md commands | HIGH | LOW | P1 |
| Manual refresh command + toolbar button | MEDIUM | LOW | P1 |
| Periodic refresh interval (configurable) | MEDIUM | LOW | P1 |
| Click status bar → focus panel | MEDIUM | LOW | P1 |
| Success criteria checklist in TreeView | MEDIUM | MEDIUM | P2 |
| Activity Bar badge (phase count) | MEDIUM | LOW | P2 |
| Status bar flash on STATE.md change | LOW | MEDIUM | P3 |
| Last step in status bar text | LOW | LOW | P3 |
| First-run welcome view | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when core is stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | GitLens | GitHub Actions ext | Todo Tree | Project Manager | Our Approach |
|---------|---------|-------------------|-----------|----------------|--------------|
| Status bar item | Yes — current branch/blame | Yes — last run status + pinned workflow | No | No | Yes — milestone + phase |
| Tooltip on hover | Yes — commit detail in Markdown | Yes — workflow run summary | No | No | Yes — milestone + phase goal + last step |
| Click → open panel | Yes | Yes | No | Yes | Yes — focus GSD side panel |
| TreeView side panel | Yes (multiple views) | Yes (workflows tree) | Yes (tag tree) | Yes (project list) | Yes — phase hierarchy |
| File-change auto-refresh | Yes (git events) | Yes (polling + webhooks) | Yes (file watcher) | No | Yes — FileSystemWatcher |
| Periodic polling fallback | No | Yes | No | No | Yes — configurable interval |
| "No data" welcome view | Yes — "No repository" state | Yes — "No workflows" state | Yes — empty state | No | Yes — "No GSD project" |
| Open source file command | Yes — open commit/file | Yes — open workflow YAML | No | Yes — open project | Yes — open ROADMAP.md / STATE.md |
| Manual refresh command | Yes | Yes | Yes | No | Yes |
| Activity Bar badge | No | Yes (run count) | No | No | v1.x — phase completion count |
| Write/edit capability | No (viewer) | Yes (trigger runs) | No (tags only) | No (viewer) | No — read-only by design |

---

## Sources

- [VS Code Status Bar UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/status-bar) — official, verified
- [VS Code Views UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/views) — official, verified
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) — official, verified
- [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events) — official, verified
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points) — official, verified
- [GitLens — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) — adjacent product analysis
- [GitHub Actions Extension — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-github-actions) — adjacent product analysis
- [Todo Tree — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) — adjacent product analysis
- [Project Manager — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager) — adjacent product analysis
- [ViewBadge API discussion](https://github.com/microsoft/vscode-discussions/discussions/543) — API capability verification

---

*Feature research for: GSD Status VS Code Extension (status bar + TreeView reading .planning/ Markdown files)*
*Researched: 2026-05-20*
