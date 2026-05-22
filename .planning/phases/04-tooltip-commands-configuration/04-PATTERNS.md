# Phase 4: Tooltip, Commands + Configuration - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/extension.ts` | controller | request-response | `src/extension.ts` (self) | exact — modify in place |
| `src/state/controller.ts` | service | event-driven | `src/state/controller.ts` (self) | exact — add method |
| `src/state/relativeTime.ts` | utility | transform | `src/state/debounce.ts` | role-match (pure utility, zero deps) |
| `src/test/state/relativeTime.test.ts` | test | transform | `src/test/state/controller.test.ts` | role-match (Mocha unit test) |
| `src/test/state/tooltip.test.ts` | test | request-response | `src/test/state/controller.test.ts` | role-match (Mocha unit test) |
| `src/test/setup/vscode-stub.ts` | config | — | `src/test/setup/vscode-stub.ts` (self) | exact — extend in place |

---

## Pattern Assignments

### `src/extension.ts` — add tooltip, commands, config listener (controller, request-response)

**Analog:** `src/extension.ts` (existing file, modify in place)

**Imports pattern** (lines 1-3):
```typescript
import * as vscode from 'vscode';
import * as path from 'node:path';
import { StateController } from './state/controller.js';
```
Note: `path` must be added — not currently imported. Use `node:path` prefix to match the `node:fs/promises` style in `controller.ts`.

**Lifecycle guard pattern** (lines 12-13) — already present, apply same pattern for config listener:
```typescript
const lifecycle = { disposed: false };
context.subscriptions.push({ dispose: () => { lifecycle.disposed = true; } });
```

**Core onStateChanged switch pattern** (lines 22-43) — tooltip slots into existing cases:
```typescript
context.subscriptions.push(
  controller.onStateChanged(state => {
    if (lifecycle.disposed) return;
    switch (state.kind) {
      case 'ok': {
        const milestone = state.roadmap.milestoneLabel ?? state.roadmap.projectName ?? 'GSD';
        const active = state.roadmap.phases.find(p => !p.done);
        const phase = active ? `Phase ${active.number}: ${active.name}` : 'All phases done';
        item.text = `$(pulse) ${milestone} › ${phase}`;
        item.tooltip = undefined;   // <-- replace with buildOkTooltip(state.roadmap, state.state)
        break;
      }
      case 'no-project':
        item.text = 'GSD: No project';
        item.tooltip = undefined;
        break;
      case 'error':
        item.text = '$(error) GSD: Error';
        item.tooltip = 'Error parsing GSD files';  // <-- replace with buildErrorTooltip(state.message)
        break;
    }
  })
);
```

**Command registration pattern** — add after controller is created, before `controller.refresh()`:
```typescript
// Register all commands BEFORE setting item.command (anti-pattern: assign command before register)
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
const planningBase = workspaceFolder
  ? path.join(workspaceFolder.uri.fsPath, '.planning')
  : undefined;

async function openFile(filename: string): Promise<void> {
  if (!planningBase) {
    vscode.window.showInformationMessage(`GSD: ${filename} not found in .planning/`);
    return;
  }
  const uri = vscode.Uri.file(path.join(planningBase, filename));
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  } catch {
    vscode.window.showInformationMessage(`GSD: ${filename} not found in .planning/`);
  }
}

context.subscriptions.push(
  vscode.commands.registerCommand('gsd.refresh', () => { void controller.refresh(); }),
  vscode.commands.registerCommand('gsd.openRoadmap', () => { void openFile('ROADMAP.md'); }),
  vscode.commands.registerCommand('gsd.openState', () => { void openFile('STATE.md'); }),
);
item.command = 'gsd.openState'; // assign AFTER commands are registered
```

**Config listener pattern** — follows same `context.subscriptions.push` disposal convention (lines 21, 9):
```typescript
context.subscriptions.push(
  vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('gsd.refreshIntervalSeconds')) {
      const seconds = vscode.workspace.getConfiguration('gsd')
        .get<number>('refreshIntervalSeconds', 30);
      controller.setRefreshInterval(seconds);
    }
    // gsd.recentActivityCount: Phase 5 will consume; no live action needed in Phase 4
  })
);
```

---

### `src/state/controller.ts` — add `setRefreshInterval()` (service, event-driven)

**Analog:** `src/state/controller.ts` (existing file, modify in place)

**Field mutability change** (line 42) — `readonly` must be dropped to allow reassignment:
```typescript
// BEFORE (line 42):
private readonly _timerDisposable: vscode.Disposable;

// AFTER:
private _timerDisposable: vscode.Disposable;
```

**Constructor signature extension** (lines 51-54) — accept optional initial interval to keep controller free of direct `workspace.getConfiguration` calls (preserves testability; existing tests pass `undefined` implicitly):
```typescript
constructor(
  folder: vscode.WorkspaceFolder | { uri: { fsPath: string } } | undefined,
  readFiles?: (base: string) => Promise<{ roadmapText: string; stateText: string }>,
  initialIntervalSeconds?: number,   // <-- new optional param; defaults to 30
) {
```

**Timer construction pattern** (lines 61-78) — extract `safeRefresh` to reuse in `setRefreshInterval`:
```typescript
const safeRefresh = (): void => {
  this.refresh().catch((e) => console.error('GSD refresh failed', e));
};
// ... watcher setup unchanged ...
const intervalMs = Math.max(5, initialIntervalSeconds ?? 30) * 1000;
const id = setInterval(safeRefresh, intervalMs);
this._timerDisposable = { dispose: () => clearInterval(id) };
```

**New public method** — add before `dispose()`:
```typescript
setRefreshInterval(seconds: number): void {
  const ms = Math.max(5, seconds) * 1000; // defensive clamp; minimum 5s
  this._timerDisposable.dispose();         // clear old interval
  const safeRefresh = (): void => {
    this.refresh().catch((e) => console.error('GSD refresh failed', e));
  };
  const id = setInterval(safeRefresh, ms);
  this._timerDisposable = { dispose: () => clearInterval(id) };
}
```

**Existing dispose() pattern** (lines 128-132) — no changes; `_timerDisposable.dispose()` already calls `clearInterval`:
```typescript
dispose(): void {
  this._watcher?.dispose();
  this._timerDisposable.dispose();
  this._emitter.dispose();
}
```

---

### `src/state/relativeTime.ts` — NEW pure utility (utility, transform)

**Analog:** `src/state/debounce.ts` — pure utility, zero imports, single exported function

**File header pattern** (lines 1-8 of debounce.ts):
```typescript
/**
 * Pure relative-time helper — zero imports.
 *
 * Formats an ISO timestamp string as a human-readable relative time string
 * (e.g. "2h ago"). Used by the status bar tooltip to surface last-entry age.
 */
```

**Export pattern** (line 17 of debounce.ts) — named export, no default:
```typescript
export function relativeTime(isoString: string | undefined): string {
```

**Full implementation** (no analog — hand-rolled):
```typescript
export function relativeTime(isoString: string | undefined): string {
  if (!isoString) return 'unknown';
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'unknown';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}
```

---

### `src/test/state/relativeTime.test.ts` — NEW unit test (test, transform)

**Analog:** `src/test/state/controller.test.ts` — Mocha unit test, no vscode APIs needed

**Imports pattern** (lines 1-3 of controller.test.ts):
```typescript
import { strict as assert } from 'node:assert';
import { relativeTime } from '../../state/relativeTime.js';
```
Note: No vscode stub needed — `relativeTime` has zero vscode dependency.

**describe/it structure pattern** (lines 31-44 of controller.test.ts):
```typescript
describe('relativeTime — <60s bucket', () => {
  it('returns "just now" for a timestamp 30 seconds ago', () => {
    const ts = new Date(Date.now() - 30_000).toISOString();
    assert.equal(relativeTime(ts), 'just now');
  });
});
```

**Edge case pattern** (lines 64-82 of controller.test.ts) — test invalid / boundary inputs:
```typescript
describe('relativeTime — edge cases', () => {
  it('returns "unknown" for undefined', () => {
    assert.equal(relativeTime(undefined), 'unknown');
  });
  it('returns "unknown" for empty string', () => {
    assert.equal(relativeTime(''), 'unknown');
  });
  it('returns "unknown" for non-parseable string', () => {
    assert.equal(relativeTime('not-a-date'), 'unknown');
  });
});
```

---

### `src/test/state/tooltip.test.ts` — NEW unit test (test, request-response)

**Analog:** `src/test/state/controller.test.ts` — Mocha unit test structure

**Imports pattern** — requires vscode-stub for MarkdownString:
```typescript
import { strict as assert } from 'node:assert';
// vscode is injected via .mocharc.cjs require hook (vscode-stub.ts)
// import * as vscode from 'vscode'; is NOT needed in test files — stub is global
```
Note: The tooltip builder function will be imported from `extension.ts` if extracted, or tested indirectly via the stub.

**Test fixture pattern** (lines 6-19 of controller.test.ts) — minimal valid parsed data:
```typescript
import type { RoadmapData } from '../../parsers/types.js';
import type { StateData } from '../../parsers/types.js';

const MINIMAL_ROADMAP: RoadmapData = {
  projectName: 'Test Project',
  milestoneLabel: 'v1.0',
  phases: [
    { number: '1', name: 'Setup', goal: 'Initial setup', done: false,
      headerLine: 1, endLine: 10 }
  ],
};

const MINIMAL_STATE: StateData = {
  lastEntry: { text: 'Completed scaffolding', timestamp: '2026-05-21T10:00:00Z', raw: '' },
};
```

---

### `src/test/setup/vscode-stub.ts` — extend with Phase 4 stubs (config, —)

**Analog:** `src/test/setup/vscode-stub.ts` (existing file, extend in place)

**Existing class pattern** (lines 14-38) — copy the EventEmitter class style for MarkdownString:
```typescript
// Add before module.exports:
class MarkdownString {
  private _value = '';
  appendMarkdown(value: string): this { this._value += value; return this; }
  get value(): string { return this._value; }
}
```

**Existing module.exports pattern** (lines 56-73) — add new entries following the same structure:
```typescript
module.exports = {
  // ... existing entries unchanged ...
  EventEmitter,
  RelativePattern,
  MarkdownString,          // <-- ADD
  workspace: {
    createFileSystemWatcher: (_pattern: RelativePattern) => new FileSystemWatcher(),
    workspaceFolders: undefined,
    getConfiguration: (_section?: string) => ({    // <-- ADD
      get: <T>(_key: string, defaultValue: T): T => defaultValue,
    }),
    onDidChangeConfiguration: (_listener: () => void): { dispose(): void } => {  // <-- ADD
      return { dispose: () => undefined };
    },
    openTextDocument: async (_uri: unknown): Promise<unknown> => ({}),  // <-- ADD
  },
  window: {
    createStatusBarItem: () => ({
      text: '',
      tooltip: undefined as vscode.MarkdownString | string | undefined,
      command: undefined as string | undefined,
      show: () => undefined,
      dispose: () => undefined,
    }),
    showTextDocument: async (_doc: unknown): Promise<void> => undefined,     // <-- ADD
    showInformationMessage: (_msg: string): void => undefined,               // <-- ADD
  },
  commands: {                                      // <-- ADD
    registerCommand: (_id: string, _cb: () => void): { dispose(): void } => {
      return { dispose: () => undefined };
    },
  },
  Uri: {                                           // <-- ADD
    file: (p: string): { fsPath: string } => ({ fsPath: p }),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  Disposable: { from: (..._d: Array<{ dispose(): void }>) => ({ dispose: () => undefined }) },
};
```

---

## Shared Patterns

### Disposable Registration
**Source:** `src/extension.ts` lines 9, 19, 21, 44 / `src/state/controller.ts` lines 128-132
**Apply to:** All new `context.subscriptions.push(...)` calls in `extension.ts`
```typescript
// Every resource that needs cleanup is pushed to context.subscriptions:
context.subscriptions.push(item);           // StatusBarItem
context.subscriptions.push(controller);     // StateController (implements Disposable)
context.subscriptions.push(someListener);   // Event subscriptions
// commands.registerCommand returns a Disposable — push it too:
context.subscriptions.push(
  vscode.commands.registerCommand('gsd.refresh', () => { void controller.refresh(); }),
);
```

### `void` on async fire-and-forget
**Source:** `src/extension.ts` line 45
**Apply to:** All command callbacks that call async functions
```typescript
void controller.refresh();           // fire-and-forget — no await in sync callback
void openFile('ROADMAP.md');         // same pattern
```

### `.js` Extension on Relative Imports
**Source:** `src/extension.ts` line 2, `src/state/controller.ts` line 16-19
**Apply to:** All new import statements
```typescript
import { relativeTime } from '../state/relativeTime.js';  // .js required (Node16 module)
import { StateController } from './state/controller.js';
```

### `private readonly` vs `private` field declaration
**Source:** `src/state/controller.ts` lines 36-42
**Apply to:** `_timerDisposable` mutation in Phase 4
```typescript
// Fields that never change after construction use readonly (existing pattern):
private readonly _emitter = new vscode.EventEmitter<GsdState>();
private readonly _folder: ...;
// _timerDisposable must DROP readonly so setRefreshInterval can reassign:
private _timerDisposable: vscode.Disposable;
```

### Error Catch + Info Message
**Source:** Research Pattern 2 / Pitfall 4
**Apply to:** `gsd.openRoadmap` and `gsd.openState` command callbacks
```typescript
try {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
} catch {
  vscode.window.showInformationMessage(`GSD: ${filename} not found in .planning/`);
}
```

---

## package.json — contributes additions

**Source:** Research Patterns 3 & 4 (no existing codebase analog — package.json has no commands/config yet)
**Apply to:** `package.json` `contributes` section

```json
"contributes": {
  "commands": [
    { "command": "gsd.refresh",     "title": "Refresh",      "category": "GSD" },
    { "command": "gsd.openRoadmap", "title": "Open Roadmap", "category": "GSD" },
    { "command": "gsd.openState",   "title": "Open State",   "category": "GSD" }
  ],
  "configuration": {
    "title": "GSD Status",
    "properties": {
      "gsd.refreshIntervalSeconds": {
        "type": "number",
        "default": 30,
        "minimum": 5,
        "description": "Interval in seconds between automatic GSD file refreshes.",
        "scope": "window"
      },
      "gsd.recentActivityCount": {
        "type": "number",
        "default": 5,
        "minimum": 1,
        "description": "Number of recent STATE.md entries to surface in the GSD side panel.",
        "scope": "window"
      }
    }
  }
}
```

---

## No Analog Found

All files have either a direct self-analog (modify in place) or a strong role-match analog. No files lack a codebase reference.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `src/state/relativeTime.ts` | utility | transform | No existing time-formatting utility; `debounce.ts` provides the pure-function module skeleton |

---

## Key Anti-Patterns (from RESEARCH.md — copy these warnings into plan actions)

1. **Do not assign `item.command` before registering the command** — register all three commands first, then `item.command = 'gsd.openState'`.
2. **Do not use `isTrusted: true` on MarkdownString** — `state.message` may contain user-controlled path strings.
3. **Use fully-qualified key in `affectsConfiguration`** — `'gsd.refreshIntervalSeconds'` not `'gsd'`.
4. **Do not keep `_timerDisposable` as `readonly`** — TypeScript will error on `setRefreshInterval` reassignment.
5. **Extend `vscode-stub.ts` before writing Phase 4 tests** — MarkdownString, commands, Uri, getConfiguration, onDidChangeConfiguration, showTextDocument, showInformationMessage all missing from current stub.

---

## Metadata

**Analog search scope:** `src/` (all .ts files)
**Files scanned:** 15
**Pattern extraction date:** 2026-05-21
