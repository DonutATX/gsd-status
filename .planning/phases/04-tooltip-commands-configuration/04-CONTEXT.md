# Phase 4: Tooltip, Commands + Configuration - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 makes the already-functional status bar item informative and controllable. It adds: (1) a rich hover tooltip exposing milestone, active phase name + goal, and the most recent STATE.md entry; (2) three Command Palette commands (`gsd.refresh`, `gsd.openRoadmap`, `gsd.openState`) under a "GSD" category; (3) two VS Code settings (`gsd.refreshIntervalSeconds`, `gsd.recentActivityCount`) that apply live without a window reload. It does NOT add the side panel TreeView (Phase 5) or packaging (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Tooltip Content & Format
- Tooltip is a `vscode.MarkdownString` — supports bold field labels, theme icons, and readable multi-line structure.
- On `error` state, the tooltip shows the actual error message text (not a generic string).
- The last STATE.md entry timestamp is rendered as a relative time ("2h ago") with the absolute timestamp beneath it.
- The active phase goal is shown in full (tooltips allow multi-line); no truncation.

### Commands
- The status bar item's default command is `gsd.openState` — "what just happened" is the primary glance value.
- `gsd.openRoadmap` / `gsd.openState` show an info message (e.g., "ROADMAP.md not found") when the target file is absent — not a silent no-op.
- `gsd.refresh` gives no toast feedback; the status bar updates visibly on its own.
- Command Palette titles: "GSD: Refresh", "GSD: Open Roadmap", "GSD: Open State", all under the "GSD" category.

### Configuration
- `gsd.refreshIntervalSeconds` changes apply live: an `onDidChangeConfiguration` listener restarts the periodic timer via a new `StateController` method (no window reload).
- `gsd.recentActivityCount` manifest entry is declared now even though it is consumed by the Phase 5 panel.
- Out-of-range config values are guarded by a `package.json` `minimum` plus a defensive clamp in code.
- Both settings use `window` configuration scope (per-window).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/extension.ts` — `activate()` already creates the status bar item, subscribes to `controller.onStateChanged`, and renders `ok` / `no-project` / `error` states. Tooltip assignment slots into the existing switch.
- `src/state/controller.ts` — `StateController` owns the `FileSystemWatcher` and a `setInterval`-based periodic refresh (`REFRESH_INTERVAL_MS = 30_000`). The timer is wrapped in `_timerDisposable`; a new `setRefreshInterval(seconds)` method can clear and recreate it.
- `src/state/types.ts` — `GsdState` discriminated union (`ok` | `no-project` | `error`).
- Parsers (`src/parsers/`) already produce `RoadmapData` and `StateData` (milestone, phases, last entry text + timestamp) — the tooltip just formats existing parsed data.

### Established Patterns
- All disposables pushed to `context.subscriptions` (SCAF-04).
- `StateController` is the single state owner; UI surfaces consume `onStateChanged` (WSP-02).
- `vscode.RelativePattern` for watchers; `.js` extension on relative imports (Node16 module resolution).

### Integration Points
- `package.json` `contributes`: add `commands`, `configuration`, and the status bar `command`.
- `extension.ts` `activate()`: register command handlers, set `item.command`, build the tooltip in the `onStateChanged` handler, add the `onDidChangeConfiguration` listener.
- `StateController`: new method to restart the timer with a configurable interval; constructor should read the initial interval from config.

</code_context>

<specifics>
## Specific Ideas

No specific external references — standard VS Code Extension API patterns (`MarkdownString`, `commands.registerCommand`, `contributes.configuration`, `workspace.onDidChangeConfiguration`).

</specifics>

<deferred>
## Deferred Ideas

- Side panel TreeView consumption of `gsd.recentActivityCount` — Phase 5.
- Status bar highlight animation on STATE.md change (UX-03) — v2.

</deferred>
