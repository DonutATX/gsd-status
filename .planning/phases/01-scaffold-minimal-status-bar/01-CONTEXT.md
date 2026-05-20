# Phase 1: Scaffold + Minimal Status Bar - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a working VS Code extension that, on workspace open, displays a status bar item showing `{milestone} › {phase}` from `.planning/ROADMAP.md` — or `GSD: No project` when `.planning/` is absent. The extension activates via `onStartupFinished`, registers a single `StatusBarItem` disposable, and ships a complete `package.json` manifest plus LICENSE. No file watching, no commands, no tooltip, no side panel — those belong to later phases.

Requirements covered: SCAF-01 through SCAF-05, STAT-01, STAT-02, WSP-01.

</domain>

<decisions>
## Implementation Decisions

### Status Bar Display
- Icon: `$(pulse)` — denotes live workflow signal
- Format: `$(pulse) {milestone} › {phase}` (e.g., `$(pulse) v1.0 › Phase 1`)
- Alignment: Left, priority 100 (low) — non-intrusive
- Click action: None in Phase 1 — `command` field omitted on the status bar item; default click is a no-op. `gsd.openState` / `gsd.openRoadmap` ship in Phase 4.

### Phase 1 Parsing Strategy
- Use a thin inline regex helper (~≤40 lines) inside `extension.ts` (or a sibling `src/roadmap-lite.ts`) — Phase 2 will replace it with the proper parser module
- "Active phase" = first `### Phase N:` header in ROADMAP.md whose line is not marked `✅` or `[x]` — no STATE.md dependency yet (STATE parsing is Phase 3)
- Refresh model: read ROADMAP.md once on activation only — file watching arrives in Phase 3
- Parse error behavior: show `GSD: Parse error` text in the status bar; never throw out of the activation handler (consistent with WSP-04's intent applied early)

### Extension Manifest Identity
- `publisher`: `donutatx`
- `name`: `gsd-status`
- `displayName`: `GSD Status`
- `repository.url`: `https://github.com/DonutATX/gsd-extenstion`
- `description`: from PROJECT.md core value (one-line)
- `categories`: `["Other"]`
- LICENSE: MIT (matches user's GitHub default; no conflicting prior decision)

### Claude's Discretion
- File layout under `src/` (e.g., whether the regex helper is inline in `extension.ts` or split into `src/roadmap-lite.ts`)
- Icon SVG / extension icon image — defer until packaging (Phase 6) unless trivial to add now
- Whether to scaffold with `yo code` (clean baseline) or hand-write `package.json` + `src/extension.ts` (lower complexity) — planner decides based on what produces the smallest, simplest diff

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is the first code-producing phase. Repository currently contains only `.planning/` artifacts and root config (`CLAUDE.md`, etc.).

### Established Patterns
- None code-side. Project conventions documented in `CLAUDE.md` lock the stack: TypeScript ^5.8, `@types/vscode` ^1.120.0 with matching `engines.vscode`, no bundler (tsc-only), no runtime dependencies, hand-rolled regex for `.planning/` parsing, `vscode.workspace.createFileSystemWatcher` when watching is needed (Phase 3).

### Integration Points
- `.planning/ROADMAP.md` (read-only source for milestone + phase names)
- VS Code Extension API surfaces used in Phase 1: `vscode.ExtensionContext`, `vscode.window.createStatusBarItem`, `vscode.workspace.workspaceFolders`, `vscode.StatusBarAlignment`

</code_context>

<specifics>
## Specific Ideas

- Milestone label comes from the `.planning/ROADMAP.md` `# {Project} — Roadmap` heading or the first `## Milestone vX.Y` header — planner picks whichever the current ROADMAP actually exposes (verify against `.planning/ROADMAP.md` during planning).
- The status bar item must be created and shown even when `.planning/` is missing — the "No GSD project" text is the discoverability hook called out in PROJECT.md Key Decisions.

</specifics>

<deferred>
## Deferred Ideas

- Status bar click command and tooltip → Phase 4
- File watching + debounced refresh → Phase 3
- Full parser module with unit tests → Phase 2
- Side panel TreeView → Phase 5
- Extension icon / marketplace assets → Phase 6 (or v2 if marketplace publish)

</deferred>
