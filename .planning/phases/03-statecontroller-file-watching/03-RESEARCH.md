# Phase 3: StateController + File Watching - Research

**Researched:** 2026-05-21
**Domain:** VS Code Extension API — FileSystemWatcher, EventEmitter, Disposable lifecycle
**Confidence:** HIGH

## Summary

Phase 3 builds the reactive core of the extension: a `StateController` class that owns the parsed `GsdState`, re-parses both planning files on demand, and fires a typed change event consumed by the status bar. It wires a `FileSystemWatcher` (debounced at 300ms) plus a 30-second periodic fallback timer, replacing the Phase 1 `parseLite` inline hack.

The VS Code APIs needed here are stable and well-documented directly in the installed `@types/vscode` package — no third-party libraries are required. `vscode.EventEmitter<T>` provides `event`, `fire()`, and `dispose()` out of the box. `vscode.workspace.createFileSystemWatcher` with a `RelativePattern` handles both in-workspace watching and graceful suspension/resumption when `.planning/` does not yet exist. The brace glob pattern `*.{ts,js}` syntax is explicitly documented in `RelativePattern.pattern` — the proposed `.planning/{ROADMAP,STATE}.md` pattern follows the same syntax.

All StateController internals (file I/O, debounce, timer) are pure Node.js and have zero `vscode` imports, making them directly unit-testable with Mocha without the Extension Development Host. Only the `StateController` constructor and the watcher callbacks touch `vscode.*`, and those integration points are tested inside the EDH.

**Primary recommendation:** Build `StateController` as a class that extends nothing but holds private `vscode.EventEmitter<GsdState>`, creates a single `FileSystemWatcher`, and manages a `setInterval`-based `Disposable` — all pushed to `context.subscriptions` from `extension.ts`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**StateController Architecture**
- StateController lives in a new module `src/state/controller.ts`, keeping parsers and UI surfaces separate.
- State is a single `GsdState` object with a discriminated `kind: 'ok' | 'no-project' | 'error'` plus the parsed roadmap/state data.
- Change notification uses `vscode.EventEmitter<GsdState>` exposed as a public `onStateChanged` event.
- StateController is UI-agnostic — it does NOT own the StatusBarItem. `extension.ts` subscribes to `onStateChanged` and updates the status bar.

**File Watching**
- Debounce is a hand-rolled `setTimeout`-based util in `src/state/debounce.ts`.
- Debounce delay is 300ms (per WAT-02).
- A single `FileSystemWatcher` uses `vscode.RelativePattern(folder, '.planning/{ROADMAP,STATE}.md')` (brace glob) — never a `path.join` string.
- `.planning/` created after VS Code is open is handled by the same watcher's `onDidCreate` — no separate directory watcher.

**Errors & Periodic Refresh**
- Parse/IO errors render as a compact `$(error) GSD: Error` status bar text; the "Error parsing GSD files" detail goes in the tooltip.
- The periodic refresh `setInterval` is wrapped in a `Disposable` (interval cleared on dispose) and pushed to `context.subscriptions`.
- Refresh interval is a hardcoded 30s constant for this phase; Phase 4 wires the `gsd.refreshIntervalSeconds` configuration.
- The timer always runs; `refresh()` short-circuits to the `no-project` state when there is no workspace folder.

### Claude's Discretion
All other implementation choices (file naming beyond the above, internal helper structure, test layout) are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WSP-02 | `StateController` owns the current `GsdState`, calls parsers on refresh, fires `onStateChanged` consumed by all UI surfaces | `vscode.EventEmitter<GsdState>` — `event`, `fire()`, `dispose()` verified in `@types/vscode` |
| WSP-03 | `StateController.refresh()` reads both ROADMAP.md and STATE.md atomically (one logical refresh, one event emission) | `node:fs/promises` parallel read with `Promise.all`, single `_emitter.fire()` call after both settle |
| WSP-04 | Parse / I/O errors are surfaced as an "Error parsing GSD files" status (not a thrown exception) | `GsdState` discriminated union with `kind: 'error'`; `try/catch` inside `refresh()` sets error state and fires |
| WAT-01 | `FileSystemWatcher` uses `vscode.RelativePattern(workspaceFolder, '.planning/{ROADMAP,STATE}.md')` | Brace-glob `*.{ts,js}` documented in `RelativePattern.pattern` field in `@types/vscode` |
| WAT-02 | Watcher callbacks debounced ~300ms so 4–12 OS events per save trigger one refresh | Hand-rolled `setTimeout` debounce in `src/state/debounce.ts`; pattern documented below |
| WAT-03 | Periodic refresh timer runs as a `Disposable` (interval cleared on dispose); default 30s | `{ dispose: () => clearInterval(id) }` pushed to `context.subscriptions` |
| WAT-04 | Watcher fires when `.planning/` is created after VS Code is already open | VS Code suspends watcher when path missing; resumes via polling (5s) or recursive watcher reuse when path appears — `onDidCreate` fires for newly created files matching the glob |
| STAT-05 | Status bar text updates ≤500ms after a debounced file-change event under normal load | 300ms debounce + synchronous file read + synchronous parser = well under 500ms on local disk |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GSD state ownership | StateController (service) | — | Single source of truth; fires events; no UI coupling |
| File I/O | StateController (Node.js fs) | — | `node:fs/promises` — pure Node, no vscode import needed |
| File watching | VS Code Extension Host | StateController (wires subscriptions) | `createFileSystemWatcher` runs outside the editor process; StateController registers callbacks |
| Debounce coalescing | `src/state/debounce.ts` (pure util) | — | Zero-dependency setTimeout; easily unit-tested without EDH |
| Periodic timer | StateController | extension.ts (pushes to subscriptions) | setInterval inside controller; dispose wired via context.subscriptions |
| Change notification | `vscode.EventEmitter<GsdState>` | — | VS Code's built-in event primitive; callers subscribe via `onStateChanged` |
| Status bar update | extension.ts | — | Subscriber to onStateChanged; does not belong in StateController |
| Error presentation | extension.ts (reads GsdState.kind) | — | StateController emits error state; UI surface decides how to render it |

---

## Standard Stack

### Core (all already installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vscode` (API) | ^1.95.0 | `EventEmitter`, `FileSystemWatcher`, `RelativePattern`, `Disposable` | Ships with VS Code; accessed via `import * as vscode from 'vscode'` |
| `node:fs/promises` | Node 20 built-in | Async file reads in `refresh()` | Zero-dep; already used in extension.ts |
| `node:path` | Node 20 built-in | Only if needed for path checks — prefer `RelativePattern` over path.join | Already imported in extension.ts |
| TypeScript | ^5.8 | Strict-mode discriminated unions for `GsdState` | Already installed |

No new packages required for this phase. [VERIFIED: @types/vscode index.d.ts in node_modules]

### Supporting (existing parsers — already implemented)

| Module | Location | Purpose |
|--------|----------|---------|
| `parseRoadmap` | `src/parsers/roadmap.ts` | Parses ROADMAP.md text → `RoadmapData` |
| `parseState` | `src/parsers/state.ts` | Parses STATE.md text → `StateData` |
| `RoadmapData`, `StateData` | `src/parsers/types.ts` | Input to `GsdState.ok` branch |

---

## Package Legitimacy Audit

> No new external packages are installed in this phase. All required capabilities come from `vscode` (extension API), Node.js built-ins (`node:fs/promises`), and TypeScript. This section is N/A.

**Packages removed due to slopcheck:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
File on disk changes
        │
        ▼
vscode FileSystemWatcher
  (onDidChange / onDidCreate / onDidDelete)
        │
        ▼
debounce() [300ms setTimeout, cancels pending]
        │
   timer fires
        │
        ▼
StateController.refresh()
  ├── No workspace folder? → fire GsdState { kind: 'no-project' }
  ├── Promise.all([readFile ROADMAP.md, readFile STATE.md])
  │     ├── ENOENT / any IO error → fire GsdState { kind: 'error', message }
  │     └── success → parseRoadmap() + parseState()
  │           ├── parse throws → fire GsdState { kind: 'error', message }
  │           └── success → fire GsdState { kind: 'ok', roadmap, state }
        │
        ▼
vscode.EventEmitter<GsdState>.fire()
        │
        ▼
extension.ts subscriber → update StatusBarItem text
```

Periodic timer (30s setInterval) also calls `StateController.refresh()` on the same path, acting as a fallback for file events that may be missed (e.g., files modified by external tools that bypass VS Code's watcher infrastructure).

### Recommended Project Structure

```
src/
├── parsers/           # (Phase 2 — unchanged)
│   ├── lines.ts
│   ├── roadmap.ts
│   ├── state.ts
│   └── types.ts
├── state/             # Phase 3 — new
│   ├── controller.ts  # StateController class
│   ├── debounce.ts    # Hand-rolled setTimeout debounce util
│   └── types.ts       # GsdState discriminated union
├── test/
│   ├── parsers/       # (Phase 2 — unchanged)
│   └── state/         # Phase 3 — new unit tests (no EDH needed)
│       ├── debounce.test.ts
│       └── controller.test.ts  # pure-logic tests only; watcher tests are integration
└── extension.ts       # Updated: remove parseLite, wire StateController
```

### Pattern 1: GsdState Discriminated Union

**What:** A single `GsdState` type with a `kind` field that TypeScript narrows in switch/if statements.
**When to use:** Whenever the controller fires — callers check `kind` before accessing data fields.

```typescript
// src/state/types.ts
// Source: @types/vscode index.d.ts (discriminated union TypeScript pattern — VERIFIED)
import type { RoadmapData, StateData } from '../parsers/types.js';

export type GsdState =
  | { kind: 'ok'; roadmap: RoadmapData; state: StateData }
  | { kind: 'no-project' }
  | { kind: 'error'; message: string };
```

### Pattern 2: vscode.EventEmitter Usage

**What:** Private emitter + public event surface. Consumers subscribe; controller fires.
**When to use:** Any VS Code extension service that needs to broadcast state changes to multiple consumers.

```typescript
// src/state/controller.ts
// Source: @types/vscode/index.d.ts EventEmitter<T> definition — VERIFIED
import * as vscode from 'vscode';
import type { GsdState } from './types.js';

export class StateController implements vscode.Disposable {
  private readonly _emitter = new vscode.EventEmitter<GsdState>();
  readonly onStateChanged: vscode.Event<GsdState> = this._emitter.event;

  async refresh(): Promise<void> {
    // ... read files, parse, then:
    this._emitter.fire(state);
  }

  dispose(): void {
    this._emitter.dispose();
    // also dispose watcher, clear interval
  }
}
```

### Pattern 3: Hand-Rolled Debounce Util

**What:** A factory that returns a debounced function — each call resets the timer.
**When to use:** Coalescing the 4–12 OS-level file-change events that a single editor save produces.

```typescript
// src/state/debounce.ts
// Source: standard setTimeout pattern — ASSUMED (no authoritative source, but trivially correct)

/**
 * Returns a debounced version of `fn` that delays invocation by `ms` milliseconds.
 * Each call resets the timer. Only the last call within the window executes.
 */
export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn();
    }, ms);
  };
}
```

### Pattern 4: FileSystemWatcher with RelativePattern

**What:** Brace-glob watcher scoped to the workspace folder's `.planning/` subdirectory.
**When to use:** Watching a fixed set of known files in a subdirectory — more precise than `**/*.md`.

```typescript
// Source: @types/vscode/index.d.ts createFileSystemWatcher + RelativePattern — VERIFIED
const pattern = new vscode.RelativePattern(
  workspaceFolder,
  '.planning/{ROADMAP,STATE}.md'
);
const watcher = vscode.workspace.createFileSystemWatcher(pattern);
const debouncedRefresh = debounce(() => void this.refresh(), 300);

watcher.onDidChange(debouncedRefresh);
watcher.onDidCreate(debouncedRefresh);
watcher.onDidDelete(debouncedRefresh);
```

### Pattern 5: setInterval as Disposable

**What:** Wrap `setInterval` return value in a `Disposable` object so VS Code's subscription system auto-clears the timer on deactivate.
**When to use:** Any long-lived timer that must stop when the extension is deactivated.

```typescript
// Source: VS Code Disposable pattern — VERIFIED (@types/vscode index.d.ts)
const intervalId = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
context.subscriptions.push({ dispose: () => clearInterval(intervalId) });
```

### Pattern 6: Atomic Dual-File Refresh

**What:** Read both files concurrently with `Promise.all`, then emit exactly one event.
**When to use:** When two files must be consistent with each other (roadmap + state always fired together).

```typescript
// Source: Node.js built-in Promise.all — VERIFIED
const [roadmapText, stateText] = await Promise.all([
  fs.readFile(roadmapPath, 'utf8'),
  fs.readFile(statePath, 'utf8'),
]);
const roadmap = parseRoadmap(roadmapText);
const state = parseState(stateText);
this._emitter.fire({ kind: 'ok', roadmap, state });
```

### Pattern 7: Error-as-State (no-throw)

**What:** Catch all I/O and parse errors inside `refresh()` and emit `GsdState { kind: 'error' }` instead of throwing.
**When to use:** Any async operation called from a fire-and-forget context (watcher callback, timer) where a thrown promise would become an unhandled rejection.

```typescript
// Source: existing extension.ts IN-04 pattern — VERIFIED (codebase)
async refresh(): Promise<void> {
  try {
    // ... read + parse
  } catch (err) {
    this._emitter.fire({
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
```

### Anti-Patterns to Avoid

- **Using `path.join` for the watcher pattern:** `path.join('.planning', 'ROADMAP.md')` produces OS-specific backslashes on Windows; `RelativePattern` accepts forward-slash glob strings and handles platform normalization internally. [VERIFIED: @types/vscode]
- **Watching with `**/*.md`:** Too broad — fires for any markdown file anywhere in the workspace. The brace-glob pattern `.planning/{ROADMAP,STATE}.md` is precise and non-recursive.
- **Emitting two separate events (one per file):** Subscribers would see two rapid state updates, causing two status bar repaints. Always read both files and emit once.
- **Throwing from watcher callbacks:** Fire-and-forget async callbacks that throw create unhandled rejections. Always `void refresh()` and let `refresh()` catch internally.
- **Calling `dispose()` on the emitter before all subscribers have unsubscribed:** The `EventEmitter.dispose()` call clears all listeners. The correct sequence is: dispose watcher → dispose timer → dispose emitter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File system event watching | Custom `fs.watch` loop | `vscode.workspace.createFileSystemWatcher` | VS Code's watcher runs outside the editor process, hooks into the same infrastructure as the editor's own file tracking, and respects `files.watcherExclude` |
| Event bus / pub-sub | Custom observer array | `vscode.EventEmitter<T>` | Built-in to VS Code API; handles listener failure isolation (`fire()` catches per-listener errors), returns `Disposable` on subscribe |
| Glob matching | Custom regex for file paths | `RelativePattern` + VS Code watcher | Platform normalization (Windows backslash), workspace-relative resolution built in |

**Key insight:** The VS Code extension API already provides the exact reactive primitives needed (EventEmitter, FileSystemWatcher, Disposable) — the only custom code in this phase is the domain-specific orchestration (GsdState type, refresh logic, debounce timing).

---

## Common Pitfalls

### Pitfall 1: Watcher Not Firing Without Wildcards

**What goes wrong:** A watcher created with an exact filename (e.g., `'ROADMAP.md'` without any glob) may not fire on some VS Code versions.
**Why it happens:** VS Code's file watching implementation has a known issue where literal filenames without wildcards fail to match on certain builds. [CITED: github.com/microsoft/vscode/issues/164925]
**How to avoid:** Always use a glob pattern. The brace pattern `.planning/{ROADMAP,STATE}.md` uses `{...}` which qualifies as a glob and avoids this issue.
**Warning signs:** No events firing in a test workspace even after file changes.

### Pitfall 2: Events Multiply on Windows (4–12 per save)

**What goes wrong:** A single Ctrl+S in VS Code triggers 4–12 `onDidChange` events in rapid succession (atomic write: temp create → rename → attribute flush → buffer flush).
**Why it happens:** VS Code's atomic save path creates a temp file, renames it over the original, which the OS translates into multiple inotify/ReadDirectoryChangesW events. [CITED: VS Code File Watcher Internals wiki]
**How to avoid:** The 300ms debounce in `src/state/debounce.ts` coalesces all events within the window into a single `refresh()` call.
**Warning signs:** Status bar flickering or multiple rapid refreshes on a single save.

### Pitfall 3: Watcher Logs Error When `.planning/` Does Not Exist

**What goes wrong:** VS Code logs `"failed to stat a resource for file watching"` (ENOENT) when the watcher is created before `.planning/` exists.
**Why it happens:** The watcher infrastructure tries to stat the base path immediately. The error is cosmetic — the watcher installs a polling fallback (5-second interval) and resumes properly once the path is created. [CITED: github.com/microsoft/vscode/issues/165025]
**How to avoid:** Accept this as expected behavior. Do NOT create a separate directory watcher. The same `onDidCreate` event fires when `.planning/ROADMAP.md` appears. The error surfaces in the extension host log, not to the user.
**Warning signs:** Seeing ENOENT in the Extension Host output channel at startup — this is benign.

### Pitfall 4: Disposing the Emitter Before the Watcher

**What goes wrong:** If `_emitter.dispose()` is called first (clearing all listeners), then the watcher callback fires one last time during cleanup and calls `_emitter.fire()` on a disposed emitter — this is a no-op per the API but can mask bugs.
**Why it happens:** Dispose order is not guaranteed unless explicitly sequenced.
**How to avoid:** Dispose in order: (1) watcher (stops new events), (2) timer (stops new refresh calls), (3) emitter (clears listeners). Implement in `StateController.dispose()`.
**Warning signs:** Stray events after `deactivate()`.

### Pitfall 5: `lifecycle.disposed` Guard Still Needed in extension.ts

**What goes wrong:** The current `extension.ts` has a `lifecycle.disposed` guard to prevent touching a disposed `StatusBarItem`. After Phase 3, the `onStateChanged` subscriber in `extension.ts` also needs this guard.
**Why it happens:** The `onStateChanged` event subscription returns a `Disposable` that is pushed to `context.subscriptions` — VS Code disposes it when the extension deactivates. But there is a window between deactivation start and disposal completion where a timer-triggered refresh may fire.
**How to avoid:** Keep the existing `lifecycle.disposed` guard and check it at the top of the `onStateChanged` callback before touching `item.text`.
**Warning signs:** "Cannot set property 'text' of disposed StatusBarItem" in the extension host log.

---

## Code Examples

### Complete StateController skeleton

```typescript
// src/state/controller.ts
// Sources: @types/vscode EventEmitter, FileSystemWatcher, RelativePattern — VERIFIED
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseRoadmap } from '../parsers/roadmap.js';
import { parseState } from '../parsers/state.js';
import { debounce } from './debounce.js';
import type { GsdState } from './types.js';

const DEBOUNCE_MS = 300;
const REFRESH_INTERVAL_MS = 30_000;

export class StateController implements vscode.Disposable {
  private readonly _emitter = new vscode.EventEmitter<GsdState>();
  readonly onStateChanged: vscode.Event<GsdState> = this._emitter.event;

  private readonly _watcher: vscode.FileSystemWatcher | undefined;
  private readonly _timerDisposable: vscode.Disposable;

  constructor(private readonly _folder: vscode.WorkspaceFolder | undefined) {
    if (_folder) {
      const pattern = new vscode.RelativePattern(_folder, '.planning/{ROADMAP,STATE}.md');
      this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const debouncedRefresh = debounce(() => void this.refresh(), DEBOUNCE_MS);
      this._watcher.onDidChange(debouncedRefresh);
      this._watcher.onDidCreate(debouncedRefresh);
      this._watcher.onDidDelete(debouncedRefresh);
    }
    const id = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
    this._timerDisposable = { dispose: () => clearInterval(id) };
  }

  async refresh(): Promise<void> {
    const folder = this._folder;
    if (!folder) {
      this._emitter.fire({ kind: 'no-project' });
      return;
    }
    try {
      const base = path.join(folder.uri.fsPath, '.planning');
      const [roadmapText, stateText] = await Promise.all([
        fs.readFile(path.join(base, 'ROADMAP.md'), 'utf8'),
        fs.readFile(path.join(base, 'STATE.md'), 'utf8'),
      ]);
      const roadmap = parseRoadmap(roadmapText);
      const state = parseState(stateText);
      this._emitter.fire({ kind: 'ok', roadmap, state });
    } catch (err) {
      // ENOENT → no-project; other errors → error state
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this._emitter.fire({ kind: 'no-project' });
      } else {
        this._emitter.fire({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  dispose(): void {
    this._watcher?.dispose();
    this._timerDisposable.dispose();
    this._emitter.dispose();
  }
}
```

### extension.ts wiring (replaces parseLite)

```typescript
// src/extension.ts (updated section inside activate())
// Source: existing extension.ts pattern + StateController above — VERIFIED (codebase)
const folder = vscode.workspace.workspaceFolders?.[0];
const controller = new StateController(folder);
context.subscriptions.push(controller);

context.subscriptions.push(
  controller.onStateChanged(state => {
    if (lifecycle.disposed) return;
    switch (state.kind) {
      case 'ok': {
        const milestone = state.roadmap.milestoneLabel ?? state.roadmap.projectName ?? 'GSD';
        const active = state.roadmap.phases.find(p => !p.done);
        const phase = active ? `Phase ${active.number}: ${active.name}` : 'All phases done';
        item.text = `$(pulse) ${milestone} › ${phase}`;
        break;
      }
      case 'no-project':
        item.text = 'GSD: No project';
        break;
      case 'error':
        item.text = '$(error) GSD: Error';
        break;
    }
  })
);

void controller.refresh();
```

### Debounce unit test pattern (no EDH needed)

```typescript
// src/test/state/debounce.test.ts
// Source: Mocha + Node.js assert — VERIFIED (existing test pattern in codebase)
import { strict as assert } from 'node:assert';
import { debounce } from '../../state/debounce.js';

describe('debounce', () => {
  it('delays execution by ms', done => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 50);
    fn(); fn(); fn();
    setTimeout(() => {
      assert.equal(calls, 1);
      done();
    }, 100);
  });

  it('resets the timer on each call', done => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 80);
    fn();
    setTimeout(fn, 40);   // reset at 40ms
    setTimeout(fn, 80);   // reset at 80ms → fires at 160ms
    setTimeout(() => {
      assert.equal(calls, 0, 'should not have fired at 100ms');
    }, 100);
    setTimeout(() => {
      assert.equal(calls, 1, 'should have fired exactly once');
      done();
    }, 200);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `fs.watch` loops in extensions | `vscode.workspace.createFileSystemWatcher` | VS Code API v1.0 | Runs outside editor process; respects file exclusions |
| `chokidar` for file watching in extensions | `createFileSystemWatcher` | Ongoing migration (e.g., vscode-cmake-tools #2967) | Eliminates CPU spikes on macOS M1 when fsevents unavailable |
| Polling-only refresh | Watcher + periodic fallback | — | Watcher gives <500ms response; fallback covers edge cases |

**Deprecated/outdated:**
- `chokidar`: Do not use in VS Code extensions. Fights VS Code's native watcher. [CITED: CLAUDE.md, vscode-cmake-tools issue #2967]
- `RelativePattern.base` (string): Deprecated in favor of `RelativePattern.baseUri`. Constructor still accepts `WorkspaceFolder` directly — use that.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The brace glob `.planning/{ROADMAP,STATE}.md` works as a watcher pattern (fires for both files) in VS Code stable on Windows | WAT-01 pitfall, Pattern 4 | If brace expansion is not supported, watcher needs two separate patterns or `**/*.md` fallback; mitigated by Pitfall 1 workaround |
| A2 | `onDidCreate` fires for `.planning/ROADMAP.md` when `.planning/` is created from scratch while VS Code is open (WAT-04) | Pitfall 3 | If polling fallback (5s) does not bridge the gap, a separate `vscode.workspace.onDidChangeWorkspaceFolders` listener would be needed |
| A3 | The hand-rolled debounce pattern (Pattern 3) is correct for this use case — no edge cases with VS Code's event loop | Pattern 3 | Debounce could swallow rapid rename-on-save if timer is too short; 300ms is the specified value per CONTEXT.md |

---

## Open Questions

1. **Does `.planning/{ROADMAP,STATE}.md` brace-glob fire for both files on Windows?**
   - What we know: `RelativePattern.pattern` doc example shows `*.{ts,js}` — same brace syntax [VERIFIED: @types/vscode]. The File Watcher Internals wiki does not explicitly cover brace-glob expansion behavior.
   - What's unclear: Whether VS Code's watcher backend expands brace globs or passes them to the OS watcher verbatim (Windows ReadDirectoryChangesW does not understand brace syntax).
   - Recommendation: Plan for a two-watcher fallback (`ROADMAP.md` + `STATE.md` individually with `?` or `*` wildcards) if integration tests show the brace glob missing events on Windows. Use a single flag constant so the switch is one line.

2. **Should `refresh()` distinguish ENOENT on ROADMAP.md vs STATE.md?**
   - What we know: CONTEXT.md says `refresh()` reads both atomically; ENOENT likely means `.planning/` or one file is absent.
   - What's unclear: Whether a missing STATE.md (but present ROADMAP.md) should be `no-project` or `ok` with partial data.
   - Recommendation: Treat ENOENT for either file as `no-project` (consistent with WSP-01 which keys off ROADMAP.md presence). This matches Phase 1 behavior.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node:fs/promises` | ✓ | Bundled with VS Code (Node 20) | — |
| TypeScript | compilation | ✓ | ^5.8 (in devDependencies) | — |
| mocha | test runner | ✓ | ^11.7.5 (in devDependencies) | — |
| `@types/vscode` | type checking | ✓ | ^1.95.0 (in devDependencies) | — |
| `@vscode/test-cli` | EDH integration tests | ✓ | ^0.0.12 (in devDependencies) | — |

No missing dependencies. All required tools are already installed.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mocha ^11.7.5 |
| Config file | None (package.json `test` script drives it directly) |
| Quick run command | `npm run compile && mocha "out/test/state/**/*.test.js"` |
| Full suite command | `npm run compile && mocha "out/test/**/**/*.test.js"` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WSP-02 | StateController fires `onStateChanged` on refresh | unit (no EDH) | `mocha "out/test/state/controller.test.js"` | ❌ Wave 0 |
| WSP-03 | `refresh()` reads both files and emits one event | unit (no EDH) | `mocha "out/test/state/controller.test.js"` | ❌ Wave 0 |
| WSP-04 | IO/parse errors emit `kind: 'error'` not throw | unit (no EDH) | `mocha "out/test/state/controller.test.js"` | ❌ Wave 0 |
| WAT-01 | Watcher uses RelativePattern (code review check) | integration (EDH) | manual / code inspection | ❌ Wave 0 |
| WAT-02 | Debounce coalesces rapid calls to one invocation | unit (no EDH) | `mocha "out/test/state/debounce.test.js"` | ❌ Wave 0 |
| WAT-03 | Timer Disposable clears interval on dispose | unit (no EDH) | `mocha "out/test/state/controller.test.js"` | ❌ Wave 0 |
| WAT-04 | Watcher picks up newly-created `.planning/` (OS behavior — not easily automatable) | manual | start VS Code in empty dir, run `mkdir .planning && cp ...` | N/A |
| STAT-05 | Status bar updates ≤500ms after file change | manual timing check | stopwatch in Extension Development Host | N/A |

**Unit-testable without EDH (key insight):** `StateController` internals — file reading, parsing, event firing — use only `node:fs/promises` and the `parseRoadmap`/`parseState` functions. Tests can stub `node:fs/promises.readFile` using a simple wrapper or pass mock file content. The `vscode.EventEmitter` dependency means the controller DOES import `vscode`, which is the only reason full unit tests without EDH are complicated.

**Recommended workaround:** Extract a `_readFiles(base: string)` method that returns `{ roadmapText, stateText }` — stub that in tests. The emitter logic then runs against stubs without needing VS Code. Alternatively, accept that `controller.test.ts` runs inside the EDH (where `vscode` is available).

### Sampling Rate

- **Per task commit:** `npm run compile && mocha "out/test/state/debounce.test.js"`
- **Per wave merge:** `npm run compile && mocha "out/test/**/**/*.test.js"` (all 31 parser tests + new state tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/state/debounce.test.ts` — covers WAT-02 (debounce coalescing)
- [ ] `src/test/state/controller.test.ts` — covers WSP-02, WSP-03, WSP-04, WAT-03
- [ ] `src/state/types.ts` — `GsdState` discriminated union (not a test file, but must exist before tests compile)
- [ ] `src/state/debounce.ts` — implementation (Wave 0 creates stub; Wave 1 fills it)
- [ ] `src/state/controller.ts` — implementation (Wave 0 creates stub)

---

## Security Domain

> `security_enforcement` not explicitly set to `false` in config — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Extension is read-only, local files, no auth |
| V3 Session Management | no | No sessions; VS Code extension lifetime |
| V4 Access Control | no | Extension reads only files in workspace; no privilege escalation |
| V5 Input Validation | yes (low risk) | `parseRoadmap` / `parseState` already handle malformed input without throwing (PARS-03 verified in Phase 2) |
| V6 Cryptography | no | No secrets, no encryption |

### Known Threat Patterns for VS Code Extension + File Parsing Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed ROADMAP.md causing ReDoS | Tampering | Phase 2 PARS-05 stress test already verified; all parser regexes are linear |
| Path traversal via workspace folder | Tampering | `RelativePattern` is workspace-scoped; extension only reads `.planning/ROADMAP.md` and `.planning/STATE.md` — no user-provided paths |
| Watcher callback invoked after disposal | Tampering/DoS | `lifecycle.disposed` guard in extension.ts subscriber; `StateController.dispose()` disposes watcher before emitter |

**Assessment:** The security surface for this phase is minimal. The extension reads two fixed local files with no network calls, no code execution, and no user input. The only risk is malformed file content, which is already mitigated by the existing Phase 2 parser hardening.

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@types/vscode/index.d.ts` — `EventEmitter<T>`, `FileSystemWatcher`, `RelativePattern`, `createFileSystemWatcher` — all type definitions read directly from installed package [VERIFIED: @types/vscode]
- `src/extension.ts` — existing `lifecycle.disposed` guard, fire-and-forget pattern, `context.subscriptions` usage [VERIFIED: codebase]
- `src/parsers/types.ts`, `src/parsers/roadmap.ts`, `src/parsers/state.ts` — parser API surface consumed by StateController [VERIFIED: codebase]
- `.planning/phases/03-statecontroller-file-watching/03-CONTEXT.md` — locked implementation decisions [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

- [VS Code File Watcher Internals wiki](https://github.com/microsoft/vscode/wiki/File-Watcher-Internals) — suspend/resume on non-existent paths, polling fallback (5s), September 2024 event correlation status
- [VS Code issue #165025](https://github.com/microsoft/vscode/issues/165025) — ENOENT logged but watcher works after directory creation
- [VS Code issue #164925](https://github.com/microsoft/vscode/issues/164925) — exact filenames without wildcards may not fire; brace glob avoids this

### Tertiary (LOW confidence)

- [VS Code issue #35171](https://github.com/microsoft/vscode/issues/35171) — 2017 RelativePattern bug (marked LOW because it pre-dates significant file watcher rewrites)
- [File Watcher Internals / event count per save](https://medium.com/@impactarchitecture/file-watchers-lie-debounce-throttle-and-coalescing-in-build-loops-8d91cb29f712) — "4–12 events per save" estimate

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new packages; all APIs verified from installed `@types/vscode`
- Architecture: HIGH — all patterns derived from existing codebase conventions + type definitions
- FileSystemWatcher semantics: MEDIUM — type definitions confirmed; brace-glob on Windows is ASSUMED (A1)
- Pitfalls: MEDIUM — sourced from tracked VS Code issues; some are historical

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (VS Code Extension API is stable; check release notes if VS Code ships a major update)
