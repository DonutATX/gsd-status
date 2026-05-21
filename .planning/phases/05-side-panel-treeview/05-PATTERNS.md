# Phase 5: Side Panel TreeView - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 7 (4 new, 3 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/tree/items.ts` | model/types | transform | `src/state/types.ts` | role-match (pure types, zero vscode imports) |
| `src/tree/provider.ts` | provider | event-driven | `src/state/controller.ts` | role-match (EventEmitter + GsdState consumer) |
| `src/parsers/types.ts` | model/types | transform | `src/parsers/types.ts` (self — additive change) | exact |
| `src/parsers/state.ts` | service | transform | `src/parsers/state.ts` (self — additive change) | exact |
| `src/extension.ts` | config/wiring | request-response | `src/extension.ts` (self — add tree registration) | exact |
| `src/test/setup/vscode-stub.ts` | utility/test | — | `src/test/setup/vscode-stub.ts` (self — add stubs) | exact |
| `src/test/tree/provider.test.ts` | test | event-driven | `src/test/state/controller.test.ts` + `src/test/extension.test.ts` | role-match |
| `resources/gsd-icon.svg` | config/asset | — | (none — new static asset) | no analog |

---

## Pattern Assignments

### `src/tree/items.ts` (model/types, transform)

**Analog:** `src/state/types.ts`

The tree node union follows exactly the same pattern as `GsdState`: a TypeScript discriminated union of plain data objects, zero `vscode` imports, pure TypeScript types only. This keeps the nodes testable under bare Mocha without any VS Code stub overhead.

**Type union pattern** (`src/state/types.ts` lines 17–20):
```typescript
export type GsdState =
  | { kind: 'ok'; roadmap: RoadmapData; state: StateData }
  | { kind: 'no-project' }
  | { kind: 'error'; message: string };
```

**Apply as** (`src/tree/items.ts` — new file):
```typescript
/**
 * GsdTreeItem — discriminated union for all tree node types.
 * Zero vscode imports: these are plain data objects. TreeItem instances
 * are built only inside provider.ts getTreeItem(). This keeps items.ts
 * free of VS Code API coupling and testable under bare Mocha.
 */
import type { RoadmapPhase, StateEntry } from '../parsers/types.js';

export type GsdTreeItem =
  | { kind: 'section';    label: string; id: string }
  | { kind: 'phase';      phase: RoadmapPhase; isActive: boolean }
  | { kind: 'goal';       text: string; phaseId: string }
  | { kind: 'criterion';  text: string; phaseId: string; index: number }
  | { kind: 'activity';   entry: StateEntry; index: number }
  | { kind: 'placeholder'; label: string; id: string };
```

**Imports pattern** (`src/parsers/types.ts` lines 1–6):
```typescript
/**
 * Pure types — zero vscode imports.
 */
```

---

### `src/tree/provider.ts` (provider, event-driven)

**Analog:** `src/state/controller.ts`

The provider mirrors `StateController`'s EventEmitter pattern: it holds a `private readonly _emitter = new vscode.EventEmitter<...>()` and exposes `readonly onDidChangeTreeData = this._emitter.event`. It also subscribes to `StateController.onStateChanged` in the same way `extension.ts` does for the status bar.

**EventEmitter declaration pattern** (`src/state/controller.ts` lines 36–37):
```typescript
private readonly _emitter = new vscode.EventEmitter<GsdState>();
readonly onStateChanged: vscode.Event<GsdState> = this._emitter.event;
```

**Apply as** (`src/tree/provider.ts`):
```typescript
private readonly _emitter = new vscode.EventEmitter<GsdTreeItem | undefined | null | void>();
readonly onDidChangeTreeData = this._emitter.event;
```

**Firing the emitter** (`src/state/controller.ts` line 116):
```typescript
this._emitter.fire({ kind: 'ok', roadmap, state });
```

**Apply as** (fire full-tree refresh per PANL-07):
```typescript
this._emitter.fire(undefined); // undefined = re-query entire tree
```

**State change subscription pattern** (`src/extension.ts` lines 52–74):
```typescript
context.subscriptions.push(
  controller.onStateChanged(state => {
    if (lifecycle.disposed) return;
    switch (state.kind) {
      case 'ok': { /* ... */ break; }
      case 'no-project': /* ... */ break;
      case 'error': /* ... */ break;
    }
  })
);
```

**Apply as** (in `extension.ts` after tree registration):
```typescript
context.subscriptions.push(
  controller.onStateChanged(state => {
    void vscode.commands.executeCommand(
      'setContext', 'gsd.hasProject', state.kind === 'ok',
    );
    provider.update(state);
  }),
);
```

**Imports pattern** (`src/state/controller.ts` lines 13–19):
```typescript
import * as vscode from 'vscode';
import { parseRoadmap } from '../parsers/roadmap.js';
import { parseState } from '../parsers/state.js';
import type { GsdState } from './types.js';
```

**Apply as** (`src/tree/provider.ts`):
```typescript
import * as vscode from 'vscode';
import type { GsdState } from '../state/types.js';
import type { GsdTreeItem } from './items.js';
```

Note: `.js` extension on all relative imports is required by the Node16 module resolution used in this project (see `tsconfig.json`). This is established convention across every source file.

**dispose() pattern** (`src/state/controller.ts` lines 151–156):
```typescript
dispose(): void {
  this._disposed = true;
  this._watcher?.dispose();
  this._timerDisposable.dispose();
  this._emitter.dispose();
}
```

**Apply as** (implement `vscode.Disposable`):
```typescript
dispose(): void {
  this._emitter.dispose();
}
```

---

### `src/parsers/types.ts` (modified — additive)

**Analog:** `src/parsers/types.ts` (self)

Add `recentEntries: StateEntry[]` to `StateData`. The existing `lastEntry` field is kept unchanged (CONTEXT.md locked decision).

**Current `StateData`** (`src/parsers/types.ts` lines 33–41):
```typescript
export interface StateData {
  milestone?: string;
  milestoneName?: string;
  phaseNumber?: string;
  phaseName?: string;
  lastEntry?: StateEntry;
  lastUpdated?: string;
  status?: string;
}
```

**Apply as** (additive change — one line added):
```typescript
export interface StateData {
  milestone?: string;
  milestoneName?: string;
  phaseNumber?: string;
  phaseName?: string;
  lastEntry?: StateEntry;
  lastUpdated?: string;
  status?: string;
  recentEntries?: StateEntry[];   // NEW — PANL-04
}
```

---

### `src/parsers/state.ts` (modified — additive)

**Analog:** `src/parsers/state.ts` (self)

Extend the existing body scan to collect all `Last activity:` lines into an array rather than stopping at the first. The `buildEntry` helper and `LAST_ACT` regex are reused unchanged.

**IMPORTANT:** The canonical fixture (`canonical-state.md`) has only one `Last activity:` line in the body. The parser should collect all body `Last activity:` lines AND also consider falling back to frontmatter `last_activity` for `recentEntries[0]` when the body has none — matching the existing `lastEntry` fallback logic. See Pitfall 7 in RESEARCH.md: read the fixture before finalizing the regex. The `LAST_ACT` regex (`/^Last activity:\s+(.+?)\s*$/`) targets the exact format found in the canonical fixture (`Last activity: 2026-05-20 — Completed 01-02-PLAN.md`).

**Existing body scan pattern** (`src/parsers/state.ts` lines 48–60):
```typescript
let bodyLastActivity: string | undefined;
for (const line of lines) {
  const p = POSITION.exec(line);
  if (p && data.phaseNumber === undefined) {
    data.phaseNumber = p[1];
    data.phaseName = p[2];
    continue;
  }
  const la = LAST_ACT.exec(line);
  if (la && bodyLastActivity === undefined) {
    bodyLastActivity = la[1];
  }
}
```

**Apply as** (collect all matches, preserve `lastEntry` behavior):
```typescript
const bodyEntries: StateEntry[] = [];
for (const line of lines) {
  const p = POSITION.exec(line);
  if (p && data.phaseNumber === undefined) {
    data.phaseNumber = p[1];
    data.phaseName = p[2];
    continue;
  }
  const la = LAST_ACT.exec(line);
  if (la) {
    bodyEntries.push(buildEntry(la[1]));
  }
}

if (bodyEntries.length > 0) {
  data.lastEntry = bodyEntries[0];       // preserve existing behavior
  data.recentEntries = bodyEntries;      // NEW — PANL-04
} else {
  const fmLastActivity = fm.get('last_activity');
  if (fmLastActivity !== undefined) {
    const stripped = stripQuotes(fmLastActivity) ?? fmLastActivity;
    data.lastEntry = buildEntry(stripped);
    data.recentEntries = [data.lastEntry]; // NEW — fallback mirrors lastEntry
  }
}
```

---

### `src/extension.ts` (modified — add tree registration)

**Analog:** `src/extension.ts` (self)

The tree registration follows the exact same disposable-push pattern as command registration and the status bar item. New lines slot in between the existing command registrations and the `void controller.refresh()` call at the end of `activate()`.

**Existing disposable push pattern** (`src/extension.ts` lines 44–48):
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('gsd.refresh', () => { void controller.refresh(); }),
  vscode.commands.registerCommand('gsd.openRoadmap', () => { void openFile('ROADMAP.md'); }),
  vscode.commands.registerCommand('gsd.openState', () => { void openFile('STATE.md'); }),
);
```

**Apply as** (add after existing command registration):
```typescript
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

context.subscriptions.push(
  controller.onStateChanged(state => {
    void vscode.commands.executeCommand(
      'setContext', 'gsd.hasProject', state.kind === 'ok',
    );
    provider.update(state);
  }),
);
```

**Existing config read pattern** (`src/extension.ts` lines 81–83):
```typescript
const initialInterval = vscode.workspace.getConfiguration('gsd', folder?.uri)
  .get<number>('refreshIntervalSeconds', 30);
```

**Apply as** (read `recentActivityCount` in provider or pass to update):
```typescript
const count = vscode.workspace.getConfiguration('gsd', folder?.uri)
  .get<number>('recentActivityCount', 5);
```

**Placement rule:** The tree `onStateChanged` subscription must be registered BEFORE `void controller.refresh()` (line 103) so the initial refresh fires `setContext` and `provider.update()` on the very first event — preventing the welcome-view flash described in RESEARCH.md Pitfall 2.

---

### `src/test/setup/vscode-stub.ts` (modified — add tree stubs)

**Analog:** `src/test/setup/vscode-stub.ts` (self)

New stubs follow the exact same class/object patterns as the existing `EventEmitter`, `FileSystemWatcher`, and `MarkdownString` stubs. Add to the `module.exports` block at the bottom of the file.

**Existing class stub pattern** (`src/test/setup/vscode-stub.ts` lines 14–38):
```typescript
class EventEmitter<T> {
  private _listeners: Array<(e: T) => void> = [];

  get event(): (listener: (e: T) => void) => { dispose(): void } {
    return (listener: (e: T) => void) => {
      this._listeners.push(listener);
      return { dispose: () => { const idx = this._listeners.indexOf(listener); if (idx !== -1) this._listeners.splice(idx, 1); } };
    };
  }

  fire(data: T): void { for (const l of this._listeners) { l(data); } }
  dispose(): void { this._listeners = []; }
}
```

**Apply as** (new classes to add before `module.exports`):
```typescript
class TreeItem {
  id?: string;
  label?: string;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  collapsibleState?: number;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;
  constructor(labelOrUri: string, collapsibleState?: number) {
    this.label = labelOrUri;
    this.collapsibleState = collapsibleState ?? 0;
  }
}

class ThemeIcon {
  constructor(public readonly id: string) {}
}

const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
```

**Existing window stub pattern** (`src/test/setup/vscode-stub.ts` lines 83–93):
```typescript
window: {
  createStatusBarItem: () => ({ text: '', tooltip: undefined as unknown, command: undefined as string | undefined, show: () => undefined, dispose: () => undefined }),
  showTextDocument: async (_doc: unknown): Promise<void> => undefined,
  showInformationMessage: (_msg: string): void => undefined,
},
```

**Apply as** (add to `window` object in `module.exports`):
```typescript
createTreeView: (_id: string, _opts: unknown): { dispose(): void } => ({ dispose: () => undefined }),
registerTreeDataProvider: (_id: string, _p: unknown): { dispose(): void } => ({ dispose: () => undefined }),
```

**Apply as** (add to `commands` object in `module.exports`):
```typescript
executeCommand: async (_id: string, ..._args: unknown[]): Promise<unknown> => undefined,
```

---

### `src/test/tree/provider.test.ts` (new test file)

**Analog:** `src/test/extension.test.ts` + `src/test/state/controller.test.ts`

Test structure: Mocha `describe`/`it` blocks, `before()` for setup, `strict as assert` for assertions, vscode stub accessed via `require('vscode')`.

**Test file header pattern** (`src/test/extension.test.ts` lines 1–15):
```typescript
import { strict as assert } from 'node:assert';

// vscode is provided globally via the .mocharc.cjs require hook (vscode-stub.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode') as typeof import('vscode');
```

**Fake context helper pattern** (`src/test/extension.test.ts` lines 28–32):
```typescript
function fakeContext(): { subscriptions: { dispose(): void }[] } {
  (vscode.workspace as { workspaceFolders: undefined }).workspaceFolders = undefined;
  return { subscriptions: [] };
}
```

**Apply as** (provider test setup):
```typescript
import { strict as assert } from 'node:assert';
import { GsdTreeProvider } from '../../tree/provider.js';
import type { GsdState } from '../../state/types.js';

describe('GsdTreeProvider — getChildren (PANL-02, PANL-03, PANL-04)', () => {
  let provider: GsdTreeProvider;

  before(() => {
    provider = new GsdTreeProvider();
  });

  // Test: getChildren(undefined) with ok state returns [section, ...phases]
  // Test: phase node for active phase has isActive === true
  // Test: getChildren(phaseNode) returns goal + criteria children
  // Test: getChildren(sectionNode) returns up to N activity entries
});
```

**Spy pattern** (`src/test/extension.test.ts` lines 43–54):
```typescript
function spyRegisterCommand(map: CommandMap): () => void {
  const original = (vscode.commands as Record<string, unknown>).registerCommand;
  (vscode.commands as Record<string, unknown>).registerCommand = (id: string, cb: () => void) => {
    map.set(id, cb);
    return { dispose: () => undefined };
  };
  return () => { (vscode.commands as Record<string, unknown>).registerCommand = original; };
}
```

**Apply as** (spy on `executeCommand` to verify `setContext` calls):
```typescript
function spyExecuteCommand(): [Array<[string, ...unknown[]]>, () => void] {
  const calls: Array<[string, ...unknown[]]> = [];
  const original = (vscode.commands as Record<string, unknown>).executeCommand;
  (vscode.commands as Record<string, unknown>).executeCommand = async (id: string, ...args: unknown[]) => {
    calls.push([id, ...args]);
  };
  return [calls, () => { (vscode.commands as Record<string, unknown>).executeCommand = original; }];
}
```

---

## Shared Patterns

### EventEmitter (event-driven state propagation)
**Source:** `src/state/controller.ts` lines 36–37
**Apply to:** `src/tree/provider.ts`
```typescript
private readonly _emitter = new vscode.EventEmitter<GsdTreeItem | undefined | null | void>();
readonly onDidChangeTreeData = this._emitter.event;
```

### Disposable push to context.subscriptions
**Source:** `src/extension.ts` lines 10–11, 44–48
**Apply to:** `src/extension.ts` (tree additions)
```typescript
context.subscriptions.push(treeView);
context.subscriptions.push(vscode.commands.registerCommand('gsd.refreshTree', ...));
context.subscriptions.push(controller.onStateChanged(...));
```
All tree-related disposables must be pushed to `context.subscriptions` so VS Code disposes them when the extension deactivates.

### Zero vscode imports in pure modules
**Source:** `src/parsers/types.ts` line 1 header comment, `src/state/types.ts` line 1 header comment
**Apply to:** `src/tree/items.ts`
No `import * as vscode` in items.ts. Only import from `../parsers/types.js`. `TreeItem` construction happens exclusively in `provider.ts getTreeItem()`.

### Node16 `.js` extension on relative imports
**Source:** Every source file in the project (e.g., `src/state/controller.ts` lines 16–19)
**Apply to:** All new files in `src/tree/`
```typescript
import type { GsdTreeItem } from './items.js';    // .js on .ts source file — Node16 required
import type { GsdState } from '../state/types.js';
```

### Switch on discriminated union
**Source:** `src/extension.ts` lines 54–73
**Apply to:** `src/tree/provider.ts` getChildren + getTreeItem
```typescript
switch (state.kind) {
  case 'ok':       /* build phase + recent-activity nodes */ break;
  case 'no-project': /* return [] — viewsWelcome handles display */ break;
  case 'error':    /* return [placeholder error node] */ break;
}
```

### Config read with folder scope
**Source:** `src/extension.ts` lines 81–83
**Apply to:** `src/tree/provider.ts` or `src/extension.ts` (read `recentActivityCount`)
```typescript
const count = vscode.workspace.getConfiguration('gsd', folder?.uri)
  .get<number>('recentActivityCount', 5);
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `resources/gsd-icon.svg` | config/asset | — | No SVG assets exist in the project yet; use the minimal SVG template from RESEARCH.md Code Examples section |

---

## Analog Search Scope

- `src/state/` — EventEmitter, disposable, GsdState discriminated union
- `src/parsers/` — pure types, additive parser extension, zero vscode import pattern
- `src/extension.ts` — command registration, subscription push, onStateChanged wiring
- `src/test/setup/vscode-stub.ts` — stub class pattern for new API stubs
- `src/test/extension.test.ts` — Mocha test structure, spy helpers, fake context

**Files scanned:** 10
**Pattern extraction date:** 2026-05-21
