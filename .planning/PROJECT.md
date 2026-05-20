# GSD Status — VS Code Extension

## What This Is

A VS Code extension that surfaces the live GSD (Get-Shit-Done) workflow state directly inside the editor. It shows the current milestone, active phase, and the most recent GSD step in a status bar item, with a side panel for browsing all phases and recent activity. The extension reads `.planning/ROADMAP.md` and `.planning/STATE.md` so developers running GSD never have to switch terminals or open planning files to know where they are.

## Core Value

A developer running GSD in a project can glance at VS Code and immediately know: which milestone, which phase, and what just happened — without leaving the editor.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Status bar item shows current GSD milestone (from ROADMAP.md)
- [ ] Status bar item shows the active GSD phase (from STATE.md / ROADMAP.md)
- [ ] Status bar item shows the last GSD step run (latest entry in STATE.md)
- [ ] Extension auto-activates on workspace open and always displays — shows "No GSD project" when `.planning/` is missing
- [ ] Status updates automatically when `.planning/ROADMAP.md` or `.planning/STATE.md` change on disk
- [ ] Periodic refresh fallback (configurable interval) for cases where file-watch events are missed
- [ ] Hover/tooltip on the status bar reveals milestone, phase goal, and full last-step detail
- [ ] Side panel (tree view) lists all phases from ROADMAP.md with status indicators and recent STATE.md activity
- [ ] Commands: refresh status, open ROADMAP.md, open STATE.md
- [ ] Distributable as a local `.vsix` build; marketplace publishing prepared but deferred to a later milestone

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Editing GSD files from the extension — read-only by design; GSD CLI / Claude Code owns writes
- Running GSD commands from the extension — opening a terminal and invoking GSD is the user's choice; we don't wrap the CLI in v1
- Cross-workspace aggregation (multiple projects in one view) — single-workspace scope keeps v1 simple
- Authentication, telemetry, sync to a cloud dashboard — local-file-driven only

## Context

- The GSD workflow is documented and active in `~/.claude/get-shit-done/` and stores per-project state in `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, and per-phase artifacts.
- `ROADMAP.md` is a Markdown document with `### Phase N: <name>` headers, `**Goal:**`, `**Mode:**`, and a `**Success Criteria**:` list — parsable without a full Markdown AST.
- `STATE.md` is the project memory document; "last GSD step" is defined as the latest entry written there.
- The user runs GSD primarily via Claude Code in a Bash/PowerShell terminal on Windows 11; VS Code is the editor of record.
- VS Code Extension API exposes both a `StatusBarItem` and a `TreeDataProvider` for side panels; a `FileSystemWatcher` covers file-change notifications.

## Constraints

- **Tech stack**: TypeScript + VS Code Extension API (Node.js runtime that ships with VS Code). No bundler-heavy stack unless required.
- **Distribution**: `.vsix` build must work without marketplace publisher account; marketplace publish is opt-in and deferred.
- **Performance**: Status updates must not block the editor; parsing should complete in <100ms for typical `.planning/` files.
- **Compatibility**: VS Code stable, Windows 11 (primary dev environment); should also run on macOS/Linux without OS-specific code.
- **Read-only**: The extension never writes to `.planning/` — it observes only.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Always-visible status bar with "No GSD project" fallback | Discoverability — users see GSD is wired up even before they run `/gsd:new-project` | — Pending |
| v1 includes status bar + side panel (TreeView), no webview | TreeView is native VS Code UI, low effort, matches workflow needs | — Pending |
| "Last GSD step" = latest entry in STATE.md | Single source of truth; avoids racing git log against file writes | — Pending |
| Build .vsix locally first, defer marketplace publish | Validate behavior in real use before committing to publisher setup, versioning, CI | — Pending |
| TypeScript on the VS Code Extension API (no framework) | Standard VS Code path; minimal dependencies; aligns with "every change should be simple" | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-20 after initialization*
