# Architecture Research

**Domain:** VS Code Extension — GSD Status (StatusBarItem + TreeDataProvider + FileSystemWatcher + Markdown parser)
**Researched:** 2026-05-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension Host                        │
├────────────────────────┬────────────────────────────────────────────┤
│     UI Layer           │            Watcher / Trigger Layer          │
│  ┌──────────────┐      │  ┌─────────────────┐  ┌──────────────────┐ │
│  │ StatusBar    │      │  │ FileSystem      │  │ Periodic Timer   │ │
│  │ Controller   │      │  │ Watcher         │  │ (setInterval)    │ │
│  └──────┬───────┘      │  └────────┬────────┘  └────────┬─────────┘ │
│  ┌──────────────┐      │           │                    │           │
│  │ GSD Tree     │      │           └──────────┬─────────┘           │
│  │ DataProvider │      │                      ▼                     │
│  └──────┬───────┘      │           ┌──────────────────┐             │
│         │              │           │  StateController  │             │
│         └──────────────┴──────────►│  (orchestrator)   │             │
│                                    └──────────┬─────────┘            │
├────────────────────────────────────────────────┼─────────────────────┤
│                   Parse / Data Layer           │                     │
│  ┌─────────────────────┐  ┌───────────────────┴───────────────────┐ │
│  │  roadmap-parser.ts  │  │           state-parser.ts             │ │
│  │  (pure functions,   │  │           (pure functions,            │ │
│  │  no vscode import)  │  │           no vscode import)           │ │
│  └─────────────────────┘  └───────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                     File System (Workspace)                          │
│  ┌──────────────────────┐  ┌────────────────────────────────────┐   │
│  │  .planning/ROADMAP.md│  │       .planning/STATE.md           │   │
│  └──────────────────────┘  └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `extension.ts` | Entry point; wires everything together; manages `context.subscriptions` | Exports `activate` / `deactivate` |
| `StateController` | Orchestrates parsing, holds the current `GsdState`, notifies UI | Plain TypeScript class; accepts parser fns as deps |
| `roadmap-parser.ts` | Parses ROADMAP.md text → structured `RoadmapData` | Pure functions, zero `vscode` imports |
| `state-parser.ts` | Parses STATE.md text → `StateData` (last step, active phase) | Pure functions, zero `vscode` imports |
| `StatusBarController` | Creates/updates/disposes the `StatusBarItem` | Thin wrapper around `vscode.window.createStatusBarItem` |
| `GsdTreeDataProvider` | Implements `TreeDataProvider<GsdTreeItem>` for the side panel | Class with `EventEmitter`, `getChildren`, `getTreeItem` |
| `WorkspaceWatcher` | Creates `FileSystemWatcher` for `.planning/*.md`; fires refresh callbacks | Manages watcher lifecycle + optional debounce |
| `commands.ts` | Registers `gsd.refresh`, `gsd.openRoadmap`, `gsd.openState` | Thin command handlers; push to `context.subscriptions` |

## Recommended Project Structure

```
src/
├── extension.ts            # activate/deactivate — pure wiring, no logic
├── stateController.ts      # Orchestrator: holds GsdState, triggers parse + UI refresh
├── parsers/
│   ├── roadmap-parser.ts   # Pure fn: string → RoadmapData (no vscode)
│   ├── state-parser.ts     # Pure fn: string → StateData  (no vscode)
│   └── types.ts            # Shared domain types: GsdState, RoadmapData, StateData
├── ui/
│   ├── statusBarController.ts   # StatusBarItem lifecycle
│   └── treeDataProvider.ts      # TreeDataProvider implementation
├── watcher/
│   └── workspaceWatcher.ts      # FileSystemWatcher + periodic timer
└── commands.ts             # Command registration helpers

tests/
├── parsers/
│   ├── roadmap-parser.test.ts   # Pure unit tests — no mocks needed
│   └── state-parser.test.ts     # Pure unit tests — no mocks needed
└── stateController.test.ts      # Unit tests with mocked vscode wrappers
```

### Structure Rationale

- **`parsers/`:** Zero `vscode` dependency means tests run with Mocha/Jest/Vitest natively — no VS Code host, no launch config.
- **`ui/`:** Groups all `vscode.window.*` calls; easy to mock at a single boundary.
- **`watcher/`:** Isolates FileSystemWatcher creation and disposal; the timer lives here too so they share one disposal path.
- **`stateController.ts`:** The only module all others talk to — prevents UI modules from reading files directly and parsers from knowing about the UI.
- **`extension.ts`:** Thin. Instantiates one of each module, wires callbacks, pushes everything into `context.subscriptions`.

## Architectural Patterns

### Pattern 1: Pure Parser Functions

**What:** Parsers accept raw `string` content and return typed data structures. They have no side effects and no `vscode` imports.
**When to use:** Any time you transform file text into domain data.
**Trade-offs:** Slightly more boilerplate (file reading happens in `StateController`), but parsers are fully testable in isolation.

**Example:**
```typescript
// parsers/roadmap-parser.ts
export interface RoadmapData {
  milestone: string;
  phases: Phase[];
  activePhaseIndex: number;
}

export function parseRoadmap(content: string): RoadmapData {
  // regex-based extraction from ### Phase N: <name> headers
  // returns structured data — no vscode, no fs
}
```

### Pattern 2: EventEmitter-Driven Tree Refresh

**What:** `GsdTreeDataProvider` holds an internal `EventEmitter<void>`. When `StateController` pushes new state, it calls `provider.refresh(state)`, which fires the emitter, triggering VS Code to re-call `getChildren`.
**When to use:** Any `TreeDataProvider` that needs to update in response to external data changes.
**Trade-offs:** Simple and idiomatic VS Code pattern. Avoids polling.

**Example:**
```typescript
// ui/treeDataProvider.ts
export class GsdTreeDataProvider implements vscode.TreeDataProvider<GsdTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private state: GsdState = emptyState();

  refresh(state: GsdState): void {
    this.state = state;
    this._onDidChangeTreeData.fire();
  }

  getChildren(element?: GsdTreeItem): GsdTreeItem[] { /* ... */ }
  getTreeItem(element: GsdTreeItem): vscode.TreeItem { /* ... */ }
}
```

### Pattern 3: Disposables-as-Array in `activate`

**What:** Every resource (watcher, command, status bar item, provider) is pushed into `context.subscriptions`. VS Code calls `dispose()` on all of them at shutdown — no manual cleanup needed.
**When to use:** Every registration in `activate`.
**Trade-offs:** Zero custom teardown code; the pattern is idiomatic and well-understood.

**Example:**
```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext): void {
  const controller = new StateController(parseRoadmap, parseState);
  const statusBar = new StatusBarController();
  const treeProvider = new GsdTreeDataProvider();

  controller.onStateChanged((state) => {
    statusBar.update(state);
    treeProvider.refresh(state);
  });

  const watcher = new WorkspaceWatcher(() => controller.refresh());

  context.subscriptions.push(
    statusBar,
    vscode.window.registerTreeDataProvider('gsdPanel', treeProvider),
    watcher,
    ...registerCommands(controller),
  );

  controller.refresh(); // initial load
}
```

## Data Flow

### File Change → UI Refresh

```
.planning/ROADMAP.md or STATE.md changes on disk
         │
         ▼
  WorkspaceWatcher.onDidChange fires
  (optionally debounced ~300ms to coalesce rapid saves)
         │
         ▼
  StateController.refresh()
    1. Detect workspace root
    2. Check .planning/ directory exists
    3. Read ROADMAP.md + STATE.md via vscode.workspace.fs
    4. Call parseRoadmap(text) → RoadmapData
    5. Call parseState(text) → StateData
    6. Merge into GsdState
    7. Fire onStateChanged event
         │
         ├──► StatusBarController.update(state)
         │     → statusBarItem.text = `$(milestone) ...`
         │     → statusBarItem.tooltip = new MarkdownString(...)
         │
         └──► GsdTreeDataProvider.refresh(state)
               → _onDidChangeTreeData.fire()
               → VS Code calls getChildren() on next render
```

### Periodic Timer Fallback

```
setInterval (configurable, default 30s)
         │
         ▼
  Same path as above: StateController.refresh()
  Deduplicated naturally — same state → no visible change
```

### No GSD Project State

```
Workspace opens
         │
         ▼
  StateController.refresh()
    → .planning/ directory not found
    → GsdState = { hasProject: false }
         │
         ▼
  StatusBarController.update({ hasProject: false })
    → statusBarItem.text = "$(info) No GSD project"
    → statusBarItem.show()

  GsdTreeDataProvider.refresh({ hasProject: false })
    → getChildren() returns [TreeItem("No GSD project detected")]
```

## Scaling Considerations

This is a local VS Code extension — "scaling" means file size and workspace complexity, not users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Typical `.planning/` files (<10KB) | Synchronous regex parsing is fast enough; no streaming needed |
| Large ROADMAP.md (>100KB, unlikely) | Consider parsing only first N phases; return partial data |
| Many rapid file saves (e.g. git checkout) | Add 300ms debounce in WorkspaceWatcher before triggering refresh |
| Multiple `.planning/` folders (future) | StateController abstracted to accept workspace root; currently out of scope |

### Scaling Priorities

1. **First concern:** File-watch events fire on every save — debounce in `WorkspaceWatcher` prevents parser thrashing.
2. **Second concern:** Parser called synchronously on the extension host thread — keep parser O(lines), avoid regex catastrophic backtracking.

## Anti-Patterns

### Anti-Pattern 1: Importing `vscode` in Parsers

**What people do:** Import `vscode.Uri` or `vscode.workspace.fs` directly inside the parser module to read files.
**Why it's wrong:** Makes parsers untestable without a full VS Code runtime; parsers become integration tests instead of unit tests.
**Do this instead:** Pass file content as a `string` argument. File reading lives in `StateController`; parsing lives in `parsers/`.

### Anti-Pattern 2: Refreshing UI Directly from the Watcher

**What people do:** `watcher.onDidChange(() => statusBar.update(...))` — watcher calls UI directly.
**Why it's wrong:** Watcher now depends on UI modules; multiple UI components each need a watcher callback; logic gets scattered.
**Do this instead:** Watcher calls `StateController.refresh()` only. `StateController` owns broadcasting to all UI via `onStateChanged`.

### Anti-Pattern 3: Not Disposing the FileSystemWatcher

**What people do:** Create watcher in `activate`, forget to push it to `context.subscriptions`.
**Why it's wrong:** Watcher accumulates across window reloads/dev-mode restarts; leaks OS file handles.
**Do this instead:** Every watcher, interval, status bar item, and command registration gets pushed to `context.subscriptions`.

### Anti-Pattern 4: Putting Logic in `extension.ts`

**What people do:** Parse files, update UI, and register watchers all inside the `activate` function body.
**Why it's wrong:** `activate` becomes a God function; untestable; impossible to reason about.
**Do this instead:** `activate` is a wiring file only — it instantiates modules and connects their interfaces. All logic lives in dedicated modules.

### Anti-Pattern 5: Using `setInterval` Without Cleanup

**What people do:** Call `setInterval` in `activate` without storing the handle.
**Why it's wrong:** Timer runs forever after extension deactivates.
**Do this instead:** Wrap `setInterval`/`clearInterval` in a `Disposable` and push to `context.subscriptions`.

```typescript
// Disposable timer pattern
const handle = setInterval(() => controller.refresh(), intervalMs);
context.subscriptions.push({ dispose: () => clearInterval(handle) });
```

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `WorkspaceWatcher` → `StateController` | Direct callback `() => void` | Watcher calls only `refresh()` |
| `StateController` → UI modules | `onStateChanged: Event<GsdState>` | Pub/sub; UI modules subscribe at activation |
| `StateController` → Parsers | Direct function call | Passes file content string; receives typed data |
| `commands.ts` → `StateController` | Direct method call | Commands call `controller.refresh()` or open documents |
| `extension.ts` → All modules | Instantiation + subscription | Owns lifetime; pushes all disposables |

### VS Code API Touch Points

| API | Used By | Notes |
|-----|---------|-------|
| `vscode.window.createStatusBarItem` | `StatusBarController` | Create once; update `.text` and `.tooltip` on change |
| `vscode.window.registerTreeDataProvider` | `extension.ts` | Returns `Disposable`; push to subscriptions |
| `vscode.workspace.createFileSystemWatcher` | `WorkspaceWatcher` | Use `RelativePattern` scoped to workspace root |
| `vscode.workspace.fs.readFile` | `StateController` | Async; returns `Uint8Array` — decode with `TextDecoder` |
| `vscode.commands.registerCommand` | `commands.ts` | Each registration returns `Disposable` |
| `vscode.workspace.openTextDocument` | `commands.ts` | Used to implement open ROADMAP.md / STATE.md commands |

## Suggested Build Order

Build bottom-up to maximize testable surface area at each step:

1. **Domain types** (`parsers/types.ts`) — Define `GsdState`, `RoadmapData`, `StateData` interfaces. No code, just types. Shapes everything else.

2. **Parsers** (`roadmap-parser.ts`, `state-parser.ts`) — Pure string-in, typed-data-out functions. Write unit tests immediately — no VS Code needed.

3. **StateController** (`stateController.ts`) — Wire parsers together; read files via `vscode.workspace.fs`; expose `onStateChanged` event. Test with mocked `vscode.workspace.fs`.

4. **StatusBarController** (`ui/statusBarController.ts`) — Thin wrapper; `update(state)` drives `.text` and `.tooltip`. Manual smoke test in the Extension Development Host.

5. **GsdTreeDataProvider** (`ui/treeDataProvider.ts`) — Implement `getChildren` / `getTreeItem`; call `refresh(state)` from `StateController` subscription. Smoke test in Extension Development Host.

6. **WorkspaceWatcher** (`watcher/workspaceWatcher.ts`) — Create `FileSystemWatcher` + periodic timer; call `controller.refresh()` on change. Add debounce here.

7. **Commands** (`commands.ts`) — Register `gsd.refresh`, `gsd.openRoadmap`, `gsd.openState`. Simplest module; register last.

8. **`extension.ts` wiring** — Instantiate modules 1–7; connect callbacks; push disposables. Integration test in Extension Development Host.

## Sources

- [Tree View API — code.visualstudio.com](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Extension Anatomy — code.visualstudio.com](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Testing VS Code Extensions with TypeScript — ISE Developer Blog](https://devblogs.microsoft.com/ise/testing-vscode-extensions-with-typescript/)
- [Mocking vscode API when unit testing — vscode-extension-samples issue #218](https://github.com/microsoft/vscode-extension-samples/issues/218)
- [FileSystemWatcher API — vscodeapi.com](https://www.vscodeapi.com/interfaces/vscode.filesystemwatcher)
- [vscode-extension-samples tree-view-sample — GitHub](https://github.com/microsoft/vscode-extension-samples/blob/main/tree-view-sample/USAGE.md)

---
*Architecture research for: VS Code GSD Status Extension*
*Researched: 2026-05-20*
