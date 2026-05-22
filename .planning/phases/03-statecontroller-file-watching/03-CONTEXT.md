# Phase 3: StateController + File Watching - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers automatic, non-blocking state updates: a `StateController` that owns the current GSD state, re-parses `ROADMAP.md` and `STATE.md` on demand, and fires a change event consumed by the status bar. It wires a `FileSystemWatcher` (debounced) plus a periodic fallback timer so the status bar reflects on-disk changes within 500ms — including projects where `.planning/` is created after VS Code is already open. Covers WSP-02/03/04, WAT-01/02/03/04, STAT-05.

Out of scope: tooltip detail (Phase 4), commands and configuration UI (Phase 4), side panel (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### StateController Architecture
- StateController lives in a new module `src/state/controller.ts`, keeping parsers and UI surfaces separate.
- State is a single `GsdState` object with a discriminated `kind: 'ok' | 'no-project' | 'error'` plus the parsed roadmap/state data.
- Change notification uses `vscode.EventEmitter<GsdState>` exposed as a public `onStateChanged` event.
- StateController is UI-agnostic — it does NOT own the StatusBarItem. `extension.ts` subscribes to `onStateChanged` and updates the status bar.

### File Watching
- Debounce is a hand-rolled `setTimeout`-based util in `src/state/debounce.ts`.
- Debounce delay is 300ms (per WAT-02).
- A single `FileSystemWatcher` uses `vscode.RelativePattern(folder, '.planning/{ROADMAP,STATE}.md')` (brace glob) — never a `path.join` string.
- `.planning/` created after VS Code is open is handled by the same watcher's `onDidCreate` — no separate directory watcher.

### Errors & Periodic Refresh
- Parse/IO errors render as a compact `$(error) GSD: Error` status bar text; the "Error parsing GSD files" detail goes in the tooltip.
- The periodic refresh `setInterval` is wrapped in a `Disposable` (interval cleared on dispose) and pushed to `context.subscriptions`.
- Refresh interval is a hardcoded 30s constant for this phase; Phase 4 wires the `gsd.refreshIntervalSeconds` configuration.
- The timer always runs; `refresh()` short-circuits to the `no-project` state when there is no workspace folder.

### Claude's Discretion
All other implementation choices (file naming beyond the above, internal helper structure, test layout) are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/parsers/roadmap.ts`, `src/parsers/state.ts` — pure parsers producing `RoadmapData` / `StateData`; StateController calls these on refresh.
- `src/parsers/types.ts` — `RoadmapData`, `StateData` interfaces; `GsdState` builds on these.
- `src/extension.ts` — `activate()` already creates the StatusBarItem and tracks a `lifecycle.disposed` flag; the inline `parseLite` will be replaced by StateController + real parsers.

### Established Patterns
- All disposables pushed to `context.subscriptions` (SCAF-04).
- Fire-and-forget async with defensive `try/catch` so shutdown races never throw (IN-04).
- Parsers are zero-`vscode`-import pure modules; `vscode`-dependent code stays out of `src/parsers/`.

### Integration Points
- `extension.ts` `activate()` constructs StateController, subscribes to `onStateChanged`, replaces `parseLite`/`updateStatusBar`.
- StateController reads files via `node:fs/promises` and parses with `src/parsers/`.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
