# Phase 5: Side Panel TreeView - Research

**Researched:** 2026-05-21
**Domain:** VS Code Extension API — TreeDataProvider, viewsContainers, viewsWelcome, setContext
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tree Structure & Content**
- "Recent Activity" is the first top-level node; phase nodes are listed below it.
- Number of recent entries driven by `gsd.recentActivityCount` setting (default 5).
- `StateData` gains an additive `recentEntries: StateEntry[]` field; existing `lastEntry` is kept.
- An expanded phase node shows one "Goal" child plus each success criterion as its own child.

**Visual Distinction & Interaction**
- Phase node icons: active = `$(play)`, done = `$(pass-filled)`, pending = `$(circle-outline)`.
- Default collapse: active phase node expanded; all others collapsed.
- Clicking a phase node opens `.planning/ROADMAP.md` at that phase's `headerLine`.
- Activity Bar view container uses a custom 24x24 monochrome SVG icon (checklist/pulse motif).

**Welcome View & Refresh**
- Welcome message (exact): `"No GSD project found. Run /gsd:new-project to initialize."`
- Welcome view `when` clause: `!gsd.hasProject`
- Toolbar refresh button triggers `StateController.refresh()`; tree subscribes to `onStateChanged`.
- PANL-07: tree refresh fires `onDidChangeTreeData(undefined)` with stable element `id` values to preserve expansion state.
- Clicking a "Recent Activity" entry opens `.planning/STATE.md`.

### Claude's Discretion

None specified — all implementation decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- UX-01: Success-criteria checklist nodes with pass/fail icons — v2.
- UX-02: Activity Bar badge showing phase completion count — v2.
- UX-04: Quick-pick to jump to any phase node — v2.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANL-01 | TreeView under dedicated Activity Bar view container with SVG icon | `contributes.viewsContainers.activitybar` + `resources/gsd-icon.svg` (24x24, currentColor SVG) |
| PANL-02 | Tree displays all ROADMAP.md phases; active phase visually distinguished | `TreeDataProvider.getChildren()` returning phase nodes; `ThemeIcon` per state |
| PANL-03 | Each phase node expandable to show goal + success criteria as children | `TreeItemCollapsibleState.Collapsed/Expanded`; `getChildren(element)` for phase items |
| PANL-04 | "Recent Activity" section at top shows last N STATE.md entries | `StateData.recentEntries: StateEntry[]` (additive parser extension); top-level section node |
| PANL-05 | Welcome view shown when no `.planning/` exists | `contributes.viewsWelcome` + `setContext('gsd.hasProject', false)` |
| PANL-06 | Toolbar exposes a manual refresh action | `gsd.refreshTree` command in `menus["view/title"]` |
| PANL-07 | Refresh uses EventEmitter-based `onDidChangeTreeData`; does not collapse entire tree | Stable `TreeItem.id` per node; fire `onDidChangeTreeData(undefined)` |
</phase_requirements>

---

## Summary

Phase 5 adds a dedicated Activity Bar panel to the extension. The entire implementation uses VS Code's built-in `TreeDataProvider<T>` API — no third-party libraries, no custom rendering. The work breaks into four pieces: (1) extending `StateData` with `recentEntries: StateEntry[]` in the pure parser layer; (2) creating `src/tree/items.ts` defining the `GsdTreeItem` discriminated union (section, phase, goal, criterion, recent-entry, placeholder nodes); (3) creating `src/tree/provider.ts` implementing `TreeDataProvider<GsdTreeItem>` that subscribes to `StateController.onStateChanged`; and (4) wiring the provider into `package.json` contributions and `extension.ts`.

The `TreeDataProvider` pattern is well-established in VS Code's API. `getTreeItem(element)` returns a `TreeItem` built from a typed node object. `getChildren(element?)` returns top-level nodes when called without an argument and child nodes when called with a parent. `onDidChangeTreeData` is a `vscode.EventEmitter` exposed as an event; firing it with `undefined` signals VS Code to re-query the whole tree. Stable `TreeItem.id` values (one per logical node, computed deterministically from the node's data) prevent VS Code from collapsing expanded nodes on every refresh.

The welcome view is implemented entirely in `package.json` via `contributes.viewsWelcome` gated by the `!gsd.hasProject` when-clause. The extension calls `vscode.commands.executeCommand('setContext', 'gsd.hasProject', value)` after each `onStateChanged` event to drive the welcome visibility. No code path inside the provider itself needs to handle the no-project case in `getChildren` — VS Code renders the welcome content when the context key is false.

**Primary recommendation:** Implement `GsdTreeProvider` as a class that (a) holds a reference to the current `GsdState`, (b) subscribes to `StateController.onStateChanged`, (c) updates local state and fires `onDidChangeTreeData(undefined)`, and (d) implements `getTreeItem`/`getChildren` from that local state. Register it via `vscode.window.createTreeView` (not `registerTreeDataProvider`) so the `TreeView` handle can be pushed to `context.subscriptions`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tree data structure | Extension host (Node.js) | — | `TreeDataProvider` runs in the extension host; VS Code renders the UI |
| `recentEntries` collection | Pure parser (`src/parsers/state.ts`) | — | Parser is the single source of truth for STATE.md data; zero vscode imports enforced |
| State ownership | `StateController` | — | WSP-02: controller is the single state owner; tree is a consumer |
| Tree refresh trigger | `StateController.onStateChanged` event | — | Matches existing status bar pattern — all UI surfaces subscribe to same event |
| Welcome view visibility | VS Code runtime (context key) | Extension host (setContext) | `viewsWelcome` when-clause is evaluated by VS Code; extension sets the context key |
| `package.json` contributions | Static manifest | — | `viewsContainers`, `views`, `viewsWelcome`, `menus` are declarative |
| Activity Bar icon | Static asset (`resources/gsd-icon.svg`) | — | SVG is loaded by VS Code at startup; extension code does not reference it |

---

## Standard Stack

### Core (no new packages)

This phase adds **zero new npm dependencies**. All APIs used are built into VS Code.

| API | Source | Purpose |
|-----|--------|---------|
| `vscode.TreeDataProvider<T>` | `vscode` module (built-in) | Interface the provider must implement |
| `vscode.TreeItem` | `vscode` module (built-in) | Data object returned by `getTreeItem()` |
| `vscode.TreeItemCollapsibleState` | `vscode` module (built-in) | Enum: `None`, `Collapsed`, `Expanded` |
| `vscode.ThemeIcon` | `vscode` module (built-in) | Named codicon icons — no file assets needed |
| `vscode.EventEmitter<T>` | `vscode` module (built-in) | Powers `onDidChangeTreeData` — same pattern as `StateController` |
| `vscode.window.createTreeView` | `vscode` module (built-in) | Registers the provider; returns a `TreeView<T>` disposable |
| `vscode.commands.executeCommand('setContext', ...)` | `vscode` module (built-in) | Sets context keys driving when-clauses |

[VERIFIED: https://code.visualstudio.com/api/extension-guides/tree-view]
[VERIFIED: https://code.visualstudio.com/api/references/vscode-api#TreeItem]

### No Installation Required

No `npm install` step for this phase. All dependencies are `@types/vscode` (already installed as dev dep) and VS Code runtime built-ins.

---

## Package Legitimacy Audit

> This phase installs zero external packages. No legitimacy audit is required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
 onStateChanged event
 (StateController fires)
        │
        ▼
 GsdTreeProvider
 ┌──────────────────────────────┐
 │ _currentState: GsdState      │
 │                              │
 │ onStateChanged subscription  │──► executeCommand('setContext',
 │   → update _currentState         'gsd.hasProject', kind==='ok')
 │   → _emitter.fire(undefined) │
 │                              │
 │ getChildren(element?)        │──► returns GsdTreeItem[]
 │   if no element: top-level   │    [SectionNode, PhaseNode, ...]
 │   if element=section: entries│
 │   if element=phase: children │
 │                              │
 │ getTreeItem(element)         │──► returns vscode.TreeItem
 │   build label, icon, command │    (id, label, iconPath, command,
 │   from GsdTreeItem data      │     collapsibleState)
 └──────────────────────────────┘
        │
        ▼
 vscode.window.createTreeView('gsd.treeView', { treeDataProvider })
 → TreeView<GsdTreeItem> pushed to context.subscriptions

 package.json (static)
 ┌──────────────────────────────────────────────────────┐
 │ contributes.viewsContainers.activitybar              │
 │   id: "gsd", icon: "resources/gsd-icon.svg"          │
 │                                                      │
 │ contributes.views.gsd                                │
 │   id: "gsd.treeView", name: "GSD Workflow"           │
 │                                                      │
 │ contributes.viewsWelcome                             │
 │   view: "gsd.treeView"                               │
 │   when: "!gsd.hasProject"                            │
 │   contents: "No GSD project found..."                │
 │                                                      │
 │ contributes.menus["view/title"]                      │
 │   command: "gsd.refreshTree", when: "view==gsd.treeView" │
 └──────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── tree/
│   ├── items.ts          # GsdTreeItem discriminated union + node constructors
│   └── provider.ts       # GsdTreeProvider: TreeDataProvider<GsdTreeItem>
├── parsers/
│   ├── state.ts          # EXTEND: collect recentEntries array (additive)
│   └── types.ts          # EXTEND: add recentEntries: StateEntry[] to StateData
├── state/
│   └── controller.ts     # NO CHANGE — provider subscribes to existing onStateChanged
└── extension.ts          # ADD: createTreeView + gsd.refreshTree command registration
resources/
└── gsd-icon.svg          # NEW: 24x24 monochrome SVG icon
```

### Pattern 1: TreeDataProvider with EventEmitter

**What:** The provider holds a snapshot of `GsdState` and re-builds tree items on demand from that snapshot. `onDidChangeTreeData` signals VS Code when the snapshot changes.

**When to use:** Any time the tree data comes from an async event source (like `StateController`).

```typescript
// Source: https://code.visualstudio.com/api/extension-guides/tree-view
import * as vscode from 'vscode';
import type { GsdTreeItem } from './items.js';

export class GsdTreeProvider implements vscode.TreeDataProvider<GsdTreeItem> {
  private readonly _emitter = new vscode.EventEmitter<GsdTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._emitter.event;

  private _state: import('../state/types.js').GsdState = { kind: 'no-project' };

  /** Called by extension.ts after subscribing to StateController.onStateChanged */
  update(state: import('../state/types.js').GsdState): void {
    this._state = state;
    this._emitter.fire(undefined); // undefined = refresh entire tree
  }

  getTreeItem(element: GsdTreeItem): vscode.TreeItem {
    return buildTreeItem(element); // implemented in items.ts
  }

  getChildren(element?: GsdTreeItem): GsdTreeItem[] {
    if (!element) {
      return getTopLevel(this._state);
    }
    return getChildrenOf(element, this._state);
  }
}
```

[CITED: https://code.visualstudio.com/api/extension-guides/tree-view]

### Pattern 2: Stable TreeItem Identity (PANL-07)

**What:** Assigning a deterministic `id` to each `TreeItem` lets VS Code preserve expansion state across refreshes. Without `id`, VS Code re-creates all items and collapses expanded nodes.

**When to use:** Any tree that should not collapse on refresh.

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api#TreeItem
// id must be unique within the tree and stable (same data = same id)
const item = new vscode.TreeItem('Phase 5: Side Panel TreeView');
item.id = 'phase-5';                    // stable: derived from phase.number
item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
item.iconPath = new vscode.ThemeIcon('play');
item.command = {
  command: 'gsd.openRoadmap',
  title: 'Open Roadmap',
  arguments: [headerLine],             // passed to the command handler
};
```

[CITED: https://code.visualstudio.com/api/references/vscode-api#TreeItem]

### Pattern 3: GsdTreeItem Node Union (items.ts)

**What:** A discriminated union for each node type replaces ad-hoc objects and gives `getTreeItem` + `getChildren` type-safe dispatch.

```typescript
// Zero vscode imports — pure data types
export type GsdTreeItem =
  | { kind: 'section';    label: string }
  | { kind: 'phase';      phase: RoadmapPhase; isActive: boolean }
  | { kind: 'goal';       text: string }
  | { kind: 'criterion';  text: string }
  | { kind: 'activity';   entry: StateEntry; index: number }
  | { kind: 'placeholder'; label: string };
```

Note: `GsdTreeItem` is a plain data type (no `vscode` imports). `TreeItem` instances are constructed only inside `provider.ts`/`getTreeItem()`, keeping items.ts free of VS Code API coupling and testable under bare Mocha.

### Pattern 4: setContext for Welcome View

**What:** VS Code evaluates `when` clauses in `viewsWelcome` against context keys. The extension must call `setContext` after each state change.

```typescript
// In provider.update() or the onStateChanged callback in extension.ts:
await vscode.commands.executeCommand(
  'setContext',
  'gsd.hasProject',
  state.kind === 'ok',
);
```

The `viewsWelcome` entry in package.json uses `"when": "!gsd.hasProject"` to show the message only when the project is absent. [CITED: https://code.visualstudio.com/api/references/when-clause-contexts]

### Pattern 5: Extending parseState Additively (PANL-04)

**What:** Add `recentEntries: StateEntry[]` to `StateData` while preserving `lastEntry` unchanged. The state parser collects up to `N` entries but `N` is determined by the caller (the provider reads `gsd.recentActivityCount` from config and slices the array). The parser returns all detectable entries; callers slice.

**Current state.ts scan:** The body scan already runs line-by-line. Extend `buildEntry` calls into an array instead of stopping at the first match.

```typescript
// In parseState — additive change:
// Before: bodyLastActivity = la[1]; (stops at first)
// After: collect all matches into an array
const entries: StateEntry[] = [];
for (const line of lines) {
  const la = LAST_ACT.exec(line);
  if (la) { entries.push(buildEntry(la[1])); }
}
data.recentEntries = entries;
data.lastEntry = entries[0]; // preserve existing behaviour
```

**Important:** The STATE.md body scan currently only looks for `Last activity:` lines. The actual STATE.md grammar has log entries in a different format. Review `src/test/parsers/fixtures/canonical-state.md` before writing the extension — the regex pattern may need adjusting to match real log lines.

### Pattern 6: Registering the TreeView in extension.ts

**What:** Call `vscode.window.createTreeView` and push the result (a `TreeView` disposable) to `context.subscriptions`. Also register `gsd.refreshTree` command here.

```typescript
// In activate():
const provider = new GsdTreeProvider();
const treeView = vscode.window.createTreeView('gsd.treeView', {
  treeDataProvider: provider,
  showCollapseAll: false,
});
context.subscriptions.push(treeView);

context.subscriptions.push(
  vscode.commands.registerCommand('gsd.refreshTree', () => {
    void controller.refresh();
  }),
);

// Subscribe tree to same state events as status bar:
context.subscriptions.push(
  controller.onStateChanged(state => {
    void vscode.commands.executeCommand(
      'setContext', 'gsd.hasProject', state.kind === 'ok',
    );
    provider.update(state);
  }),
);
```

[CITED: https://code.visualstudio.com/api/extension-guides/tree-view]

### Anti-Patterns to Avoid

- **Putting `vscode.TreeItem` construction in `items.ts`:** Keep tree node types as plain data objects. Build `TreeItem` only in `getTreeItem()`. This keeps node types free of VS Code API coupling and testable without stubs.
- **Calling `_emitter.fire(specificElement)` for partial refresh without verifying identity:** Partial refresh (firing with a specific element) only works if VS Code can match the element by identity. For Phase 5, `fire(undefined)` (full tree re-query) is the safe default per PANL-07; stable `id` values prevent unwanted collapse.
- **Forgetting to call `setContext`on initial load:** The welcome view will show incorrectly if `gsd.hasProject` is never set. Call `setContext` in the initial `onStateChanged` subscription (or after the initial `controller.refresh()` completes).
- **Importing `vscode` in `items.ts`:** Breaks bare-Mocha testability. Node types must be zero-vscode-import.
- **Using `registerTreeDataProvider` instead of `createTreeView`:** `createTreeView` returns a `Disposable`; `registerTreeDataProvider` does not. Always use `createTreeView` and push to `context.subscriptions`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree node expansion/collapse | Manual DOM state | `TreeItemCollapsibleState` enum | VS Code manages all collapse state natively |
| Icon rendering | Custom SVG in tree rows | `new ThemeIcon('codicon-id')` | Codicons are built into VS Code; ThemeIcon respects the active theme |
| Welcome / empty state UI | Conditional `getChildren` returning placeholder | `contributes.viewsWelcome` + `setContext` | VS Code renders a polished welcome view with link support; no code needed |
| Tree refresh debouncing | Custom timer in provider | `StateController` already debounces (300ms); subscribe to `onStateChanged` | Controller already handles debounce and coalescing |
| Activity Bar icon sizing | Resize SVG in code | Author a 24x24 SVG at design time | VS Code applies the icon as-is; wrong viewBox = blurry icon |

**Key insight:** VS Code's TreeView API handles all the hard parts — selection, keyboard navigation, theming, accessibility, collapse persistence. The extension only needs to supply data objects and let VS Code render them.

---

## Common Pitfalls

### Pitfall 1: Missing `id` causes full collapse on every refresh

**What goes wrong:** When `TreeItem.id` is not set, VS Code cannot identify stable nodes across re-renders. Every `onDidChangeTreeData` fire causes all expanded nodes to collapse.

**Why it happens:** VS Code uses `id` to reconcile old and new tree items. Without `id`, every node is treated as a new node.

**How to avoid:** Assign a deterministic `id` to every non-leaf node. Use a stable key derived from the node's data — e.g., `'phase-' + phase.number` for phase nodes, `'recent-activity-section'` for the section header.

**Warning signs:** Tree visually "resets" (everything collapses) whenever STATE.md is saved.

### Pitfall 2: `setContext` not called on initial activation

**What goes wrong:** Welcome view shows even when a valid project exists (or vice versa) on first load.

**Why it happens:** `gsd.hasProject` context key is undefined (not false) until `executeCommand('setContext', ...)` is called. VS Code treats an undefined context key as falsy, so `!gsd.hasProject` is initially true.

**How to avoid:** Call `setContext` during the initial `onStateChanged` event (which `controller.refresh()` fires at the end of `activate()`). The existing `void controller.refresh()` call at the end of `activate()` already triggers this chain — just make sure the listener is registered before that call.

**Warning signs:** Welcome message flickers on startup even when `.planning/` exists.

### Pitfall 3: `contributes.views` key must match the `viewsContainers` id exactly

**What goes wrong:** The tree view never appears in the Activity Bar panel — the view container shows but is empty.

**Why it happens:** `contributes.views` is a map keyed by view container id. If the key is `"gsd"` but the view container declares `"id": "gsd-status"`, VS Code silently drops the view.

**How to avoid:** Keep `contributes.viewsContainers[].id` and the key under `contributes.views` in sync. Per the UI-SPEC, both use `"gsd"`.

**Warning signs:** Activity Bar shows the GSD icon, clicking it opens an empty panel.

### Pitfall 4: SVG icon not rendering (wrong format)

**What goes wrong:** Activity Bar icon appears as a broken image or blank square.

**Why it happens:** VS Code requires SVG icons to be: (a) in the `resources/` directory, (b) 24x24 viewBox, (c) monochrome using `currentColor` so the theme can tint it, (d) single `<path>` preferred (multi-element SVGs may render unexpectedly).

**How to avoid:** Use a minimal SVG:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="..."/>
</svg>
```
Do not include `width`/`height` attributes, hardcoded color values, or `fill="#XXXXXX"`.

**Warning signs:** Activity Bar icon is invisible or shows as a box.

### Pitfall 5: `vscode-stub.ts` needs new stubs before provider tests compile

**What goes wrong:** Tests that instantiate `GsdTreeProvider` fail at runtime with "TreeItem is not a constructor" or "ThemeIcon is not defined".

**Why it happens:** `vscode-stub.ts` only stubs the APIs used by prior phases. It does not have `TreeItem`, `ThemeIcon`, `TreeItemCollapsibleState`, or `window.createTreeView`.

**How to avoid:** Add the following stubs to `vscode-stub.ts` before writing provider tests:
- `TreeItem` class with `id`, `label`, `description`, `tooltip`, `iconPath`, `collapsibleState`, `command`, `contextValue`
- `ThemeIcon` class with a `id` string property
- `TreeItemCollapsibleState` enum object: `{ None: 0, Collapsed: 1, Expanded: 2 }`
- `window.createTreeView` returning a minimal `{ dispose: () => undefined }` object
- `window.registerTreeDataProvider` returning `{ dispose: () => undefined }`

**Warning signs:** Compile error or runtime "X is not a constructor" when running `npm test`.

### Pitfall 6: `getChildren` called with an element the provider doesn't recognize

**What goes wrong:** VS Code calls `getChildren` with a leaf node element; provider crashes or returns wrong data.

**Why it happens:** If a `TreeItem` has `collapsibleState` other than `None`, VS Code will call `getChildren` with it. Leaf nodes (goal, criterion, activity entry) must be set to `TreeItemCollapsibleState.None` to prevent this.

**How to avoid:** Leaf node items always get `collapsibleState: TreeItemCollapsibleState.None`. The `getChildren` dispatch should also have a default branch returning `[]`.

### Pitfall 7: recentEntries parser extension relies on incorrect grammar assumption

**What goes wrong:** `recentEntries` is always empty even though STATE.md has log entries.

**Why it happens:** The current `parseState` body scan only matches `Last activity:` lines. Real STATE.md log entries may have a different format (e.g., bullet points under a `## Activity Log` section).

**How to avoid:** Read the canonical STATE.md fixture (`src/test/parsers/fixtures/canonical-state.md`) before writing the parser extension. Verify what pattern actual log entries match before coding the regex. The extension must match real STATE.md grammar, not an assumed format.

**Warning signs:** `recentEntries.length === 0` in tests against the canonical fixture.

---

## Code Examples

### Full package.json contributions block for Phase 5

```jsonc
// Source: https://code.visualstudio.com/api/extension-guides/tree-view
// Add to existing "contributes" object — do not replace existing commands/configuration
"viewsContainers": {
  "activitybar": [
    {
      "id": "gsd",
      "title": "GSD",
      "icon": "resources/gsd-icon.svg"
    }
  ]
},
"views": {
  "gsd": [
    {
      "id": "gsd.treeView",
      "name": "GSD Workflow"
    }
  ]
},
"viewsWelcome": [
  {
    "view": "gsd.treeView",
    "contents": "No GSD project found. Run `/gsd:new-project` to initialize.",
    "when": "!gsd.hasProject"
  }
],
// Add "gsd.refreshTree" to existing "commands" array:
{
  "command": "gsd.refreshTree",
  "title": "Refresh GSD tree",
  "icon": "$(refresh)",
  "category": "GSD"
},
// Add to "menus":
"menus": {
  "view/title": [
    {
      "command": "gsd.refreshTree",
      "when": "view == gsd.treeView",
      "group": "navigation"
    }
  ]
}
```

### Minimal Activity Bar SVG icon

```xml
<!-- resources/gsd-icon.svg — 24x24, monochrome, currentColor -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
</svg>
```

### vscode-stub.ts additions for Phase 5 tests

```typescript
// Add to module.exports in src/test/setup/vscode-stub.ts:

class TreeItem {
  id?: string;
  label?: string;
  description?: string;
  tooltip?: string | MarkdownString;
  iconPath?: ThemeIcon | { light: string; dark: string };
  collapsibleState?: number;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;
  constructor(labelOrUri: string | { fsPath: string }, collapsibleState?: number) {
    if (typeof labelOrUri === 'string') {
      this.label = labelOrUri;
    }
    this.collapsibleState = collapsibleState ?? 0;
  }
}

class ThemeIcon {
  constructor(public readonly id: string) {}
}

const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };

// Add to window in module.exports:
// createTreeView: (_id: string, _opts: unknown) => ({ dispose: () => undefined }),
// registerTreeDataProvider: (_id: string, _p: unknown) => ({ dispose: () => undefined }),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `registerTreeDataProvider` | `window.createTreeView` (preferred) | VS Code 1.x | `createTreeView` returns a `Disposable`; enables `reveal()`, selection access |
| Manual activation event `onView:id` | Automatic (VS Code handles it) | VS Code 1.74+ | No need to add `onView:gsd.treeView` to `activationEvents` in package.json |
| `EventEmitter.fire(element)` for partial refresh | `fire(undefined)` + stable `id` for PANL-07 | Ongoing best practice | Partial refresh requires robust identity; full re-query with stable ids is simpler and safe |

**Deprecated/outdated:**
- Manual `activationEvents: ["onView:yourViewId"]`: No longer needed in VS Code 1.74+. The extension already uses `onStartupFinished` which covers all views.
- `vscode.window.registerTreeDataProvider`: Still works but returns `void`, not a `Disposable`. Use `createTreeView` instead.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | STATE.md log entries are matched by the existing `LAST_ACT` regex or a simple variant | Common Pitfalls #7, Pattern 5 | `recentEntries` is always empty; Pitfall 7 explains mitigation: read the fixture first |
| A2 | `onStartupFinished` activation event covers the `gsd.treeView` activation without needing a separate `onView:gsd.treeView` entry | State of the Art | Tree view does not activate on first open; fix: add `onView:gsd.treeView` to activationEvents |

**If table is empty:** All other claims are cited from official VS Code documentation verified during this session.

---

## Open Questions

1. **Real STATE.md log entry format for `recentEntries`**
   - What we know: `parseState` currently collects `Last activity:` lines; `StateData.lastEntry` works.
   - What's unclear: Whether actual STATE.md files have multiple `Last activity:` lines, or if entries follow a different heading/bullet structure that a new regex must match.
   - Recommendation: Read `src/test/parsers/fixtures/canonical-state.md` as step 0 of the parser extension wave. If no multi-entry grammar exists in the fixture, extend the fixture to reflect the real format before writing parser code.

2. **`onView:gsd.treeView` activation event**
   - What we know: VS Code 1.74+ auto-handles view activation, and the extension already uses `onStartupFinished`.
   - What's unclear: Whether `onStartupFinished` guarantees the tree view is active before the user manually opens it. In practice this is not an issue since `onStartupFinished` runs very early.
   - Recommendation: Do not add `onView:gsd.treeView` — `onStartupFinished` is sufficient. Document in plan if there are concerns.

---

## Environment Availability

> This phase is code/config-only changes with zero new external tool dependencies. All tooling (TypeScript, Mocha, npm) was verified in prior phases. Step 2.6: SKIPPED (no new external dependencies).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mocha 11.7.5 (bare Node — no Extension Development Host) |
| Config file | `.mocharc.cjs` — `require: ['out/test/setup/vscode-mock.js']` |
| Quick run command | `npm test` (compiles + runs all `out/test/**/*.test.js`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANL-01 | package.json has viewsContainers + views with correct ids | smoke (manual EDH) | manual only — package.json is static | N/A |
| PANL-02 | `getChildren(undefined)` returns phase nodes with correct icon for active/done/pending | unit | `npm test` — `out/test/tree/provider.test.js` | ❌ Wave 0 |
| PANL-03 | `getChildren(phaseNode)` returns goal + criterion children | unit | `npm test` — `out/test/tree/provider.test.js` | ❌ Wave 0 |
| PANL-04 | `getChildren(sectionNode)` returns N recent entries; slices by `recentActivityCount` | unit | `npm test` — `out/test/tree/provider.test.js` | ❌ Wave 0 |
| PANL-04 | `parseState` with multi-entry STATE.md populates `recentEntries` | unit | `npm test` — `out/test/parsers/state.test.js` | ❌ Wave 0 |
| PANL-05 | Welcome view: `setContext` called with `false` when state is `no-project` | unit | `npm test` — `out/test/tree/provider.test.js` | ❌ Wave 0 |
| PANL-06 | `gsd.refreshTree` command registered in `activate()` | smoke | `npm test` — `out/test/extension.test.js` | ❌ Wave 0 |
| PANL-07 | `onDidChangeTreeData` fires after `provider.update()`; TreeItem ids are stable | unit | `npm test` — `out/test/tree/provider.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/tree/provider.test.ts` — covers PANL-02, PANL-03, PANL-04, PANL-05, PANL-07
- [ ] `src/test/tree/items.test.ts` — covers GsdTreeItem node construction helpers (optional, can fold into provider.test.ts)
- [ ] `src/test/setup/vscode-stub.ts` additions — `TreeItem`, `ThemeIcon`, `TreeItemCollapsibleState`, `window.createTreeView`
- [ ] Fixture extension or new fixture for `canonical-state.md` with multiple log entries (for PANL-04 `recentEntries` tests)

---

## Security Domain

> VS Code extension with no network calls, no user-input parsing, and no secrets handling. Standard ASVS categories do not apply to a read-only file-display extension.

| ASVS Category | Applies | Rationale |
|---------------|---------|-----------|
| V2 Authentication | No | Extension reads local files only; no auth layer |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Read-only; no write paths |
| V5 Input Validation | Partial | Parser input is `.planning/` file content written by the user's own GSD tooling; parsers are already total (PARS-03) |
| V6 Cryptography | No | No cryptographic operations |

**Phase-specific security note:** `TreeItem.command.arguments` passes `headerLine` (a number) to `gsd.openRoadmap`. The command handler should validate that `headerLine` is a non-negative integer before using it in `revealLine` to avoid unexpected behavior on malformed ROADMAP.md values.

---

## Sources

### Primary (HIGH confidence)
- [VS Code Extension API — Tree View Guide](https://code.visualstudio.com/api/extension-guides/tree-view) — `TreeDataProvider` interface, `EventEmitter` refresh pattern, `viewsContainers`/`views`/`viewsWelcome`, `createTreeView` vs `registerTreeDataProvider`
- [VS Code API Reference — TreeItem](https://code.visualstudio.com/api/references/vscode-api#TreeItem) — `TreeItem.id` stable identity, `TreeItemCollapsibleState` enum, `ThemeIcon` constructor
- [VS Code API Reference — When Clause Contexts](https://code.visualstudio.com/api/references/when-clause-contexts) — `setContext` pattern for custom context keys driving `viewsWelcome`
- [VS Code API Reference — window.createTreeView](https://code.visualstudio.com/api/references/vscode-api#window.createTreeView) — `TreeViewOptions`, `TreeView<T>` disposable, `showCollapseAll`

### Secondary (MEDIUM confidence)
- Existing codebase: `src/state/controller.ts` — EventEmitter pattern confirmed as the established pattern for this extension
- Existing codebase: `src/test/setup/vscode-stub.ts` — confirmed stub architecture that Phase 5 must extend
- Existing codebase: `src/parsers/state.ts` — confirmed `buildEntry`/`LAST_ACT` pattern to extend for `recentEntries`

---

## Metadata

**Confidence breakdown:**
- Standard stack (VS Code APIs): HIGH — verified directly from official VS Code documentation
- Architecture patterns: HIGH — well-established VS Code TreeView patterns with official examples
- Parser extension approach: HIGH — existing code confirmed; extension is purely additive
- Pitfalls: HIGH for API pitfalls (verified); MEDIUM for STATE.md grammar (see A1 in Assumptions Log)
- vscode-stub.ts gaps: HIGH — confirmed by reading actual stub source

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (VS Code API is stable; no major changes expected in 30 days)
