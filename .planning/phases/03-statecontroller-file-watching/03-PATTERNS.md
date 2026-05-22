# Phase 3: StateController + File Watching - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/state/types.ts` | model | — (pure types) | `src/parsers/types.ts` | exact |
| `src/state/debounce.ts` | utility | event-driven | `src/parsers/lines.ts` | role-match (pure util, zero imports) |
| `src/state/controller.ts` | service | event-driven | `src/extension.ts` | role-match (owns async I/O + vscode APIs) |
| `src/extension.ts` (modified) | config/wiring | request-response | `src/extension.ts` (current) | exact (self-analog; remove parseLite, add subscription) |
| `src/test/state/debounce.test.ts` | test | — | `src/test/parsers/stress.test.ts` | exact (Mocha, node:assert, no fixtures) |
| `src/test/state/controller.test.ts` | test | — | `src/test/parsers/roadmap.test.ts` | role-match (Mocha, node:assert, describe/it structure) |

---

## Pattern Assignments

### `src/state/types.ts` (model, pure types)

**Analog:** `src/parsers/types.ts`

**File header pattern** (lines 1–6):
```typescript
/**
 * Pure types — zero vscode imports.
 *
 * Shared type surface for the ROADMAP.md / STATE.md parsers.
 * Plan 02 (parseRoadmap, parseState) consumes these exports.
 */
```

**Imports pattern** (line 9 of `src/parsers/types.ts`):
```typescript
// No imports — pure type declarations only.
// Copy this same zero-import convention for src/state/types.ts.
import type { RoadmapData, StateData } from '../parsers/types.js';
```

**Core pattern** — discriminated union (no analog in existing code; use RESEARCH.md Pattern 1):
```typescript
export type GsdState =
  | { kind: 'ok'; roadmap: RoadmapData; state: StateData }
  | { kind: 'no-project' }
  | { kind: 'error'; message: string };
```

**Key rule:** `src/parsers/types.ts` has zero vscode imports and zero runtime imports — only interface/type declarations. `src/state/types.ts` must follow the same constraint: one `import type` for `RoadmapData`/`StateData`, nothing else.

---

### `src/state/debounce.ts` (utility, event-driven)

**Analog:** `src/parsers/lines.ts`

**File header pattern** (lines 1–4 of `src/parsers/lines.ts`):
```typescript
/**
 * Pure line / frontmatter helpers — zero vscode imports.
 *
 * Linear regex only (no nested quantifiers). Single-pass scans.
 */
```

**Function documentation pattern** (lines 7–14 of `src/parsers/lines.ts`):
```typescript
/**
 * Split text into lines, normalizing CRLF and LF.
 * `splitLines('a\r\nb\nc')` === `['a', 'b', 'c']`.
 * `splitLines('')` === `['']`.
 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}
```

**Core pattern** — no existing debounce analog; use RESEARCH.md Pattern 3 directly. Copy the JSDoc comment style from `lines.ts`:
```typescript
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

**Key rule:** Zero imports. Same zero-dependency, single-exported-function shape as `splitLines` / `stripQuotes` in `lines.ts`.

---

### `src/state/controller.ts` (service, event-driven)

**Analog:** `src/extension.ts` (current)

**Imports pattern** (lines 1–3 of `src/extension.ts`):
```typescript
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
```
Copy this import block verbatim, then add:
```typescript
import { parseRoadmap } from '../parsers/roadmap.js';
import { parseState } from '../parsers/state.js';
import { debounce } from './debounce.js';
import type { GsdState } from './types.js';
```

**Constants pattern** — place at top of file before the class, following the established project convention of inline constants:
```typescript
const DEBOUNCE_MS = 300;
const REFRESH_INTERVAL_MS = 30_000;
```

**Lifecycle/disposal pattern** (lines 13–14 of `src/extension.ts`):
```typescript
// IN-04: track disposal so a late-resolving callback doesn't touch a disposed resource.
const lifecycle = { disposed: false };
context.subscriptions.push({ dispose: () => { lifecycle.disposed = true; } });
```
StateController uses the same `{ dispose: () => clearInterval(id) }` inline object shape for the timer disposable (line 14 pattern).

**Fire-and-forget async + defensive try/catch pattern** (lines 19 and 33–61 of `src/extension.ts`):
```typescript
// Fire-and-forget — never block activate()
void updateStatusBar(item, lifecycle);

// Inside the async function:
try {
  // ... async work
} catch {
  // Last-resort guard — never let activate()'s fire-and-forget reject.
}
```
`StateController.refresh()` is the direct analog: called with `void this.refresh()` from watcher callbacks, and wraps all I/O + parse logic in a single `try/catch` that emits `kind: 'error'` instead of throwing.

**ENOENT guard pattern** (lines 43–48 of `src/extension.ts`):
```typescript
try {
  content = await fs.readFile(roadmapPath, 'utf8');
} catch {
  if (lifecycle.disposed) return;
  item.text = 'GSD: No project';
  return;
}
```
In `StateController.refresh()` this becomes:
```typescript
const code = (err as NodeJS.ErrnoException).code;
if (code === 'ENOENT') {
  this._emitter.fire({ kind: 'no-project' });
} else {
  this._emitter.fire({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
}
```

**Core class structure** — no existing class analog; follow RESEARCH.md complete skeleton exactly:
```typescript
export class StateController implements vscode.Disposable {
  private readonly _emitter = new vscode.EventEmitter<GsdState>();
  readonly onStateChanged: vscode.Event<GsdState> = this._emitter.event;

  private readonly _watcher: vscode.FileSystemWatcher | undefined;
  private readonly _timerDisposable: vscode.Disposable;

  constructor(private readonly _folder: vscode.WorkspaceFolder | undefined) { ... }
  async refresh(): Promise<void> { ... }
  dispose(): void { ... }
}
```

**Dispose order** (critical — documented in RESEARCH.md Pitfall 4):
```typescript
dispose(): void {
  this._watcher?.dispose();       // 1. stop new events
  this._timerDisposable.dispose(); // 2. stop new refresh calls
  this._emitter.dispose();         // 3. clear listeners last
}
```

---

### `src/extension.ts` (modified — remove parseLite, wire StateController)

**Analog:** `src/extension.ts` (current — self-analog for the parts that stay)

**Parts that stay unchanged** (lines 5–16):
```typescript
export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(item);
  // IN-04: track disposal so a late-resolving callback doesn't touch a disposed item.
  const lifecycle = { disposed: false };
  context.subscriptions.push({ dispose: () => { lifecycle.disposed = true; } });
  item.text = 'GSD: No project';
  item.show();
```

**Parts removed:** Lines 19–120 (`void updateStatusBar(...)`, `updateStatusBar()` function, `parseLite()` function, `pickMilestone()` function).

**Replacement wiring pattern** (after `item.show()`, replaces the fire-and-forget call):
```typescript
  const folder = vscode.workspace.workspaceFolders?.[0];
  const controller = new StateController(folder);
  context.subscriptions.push(controller);

  context.subscriptions.push(
    controller.onStateChanged(state => {
      if (lifecycle.disposed) return;   // IN-04 guard — reuse existing pattern
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
          item.tooltip = 'Error parsing GSD files';
          break;
      }
    })
  );

  void controller.refresh();
}
```

**deactivate()** (line 22–24 of current `extension.ts` — unchanged):
```typescript
export function deactivate(): void {
  // No-op: context.subscriptions disposes the StatusBarItem.
}
```

**New import** to add at top of file:
```typescript
import { StateController } from './state/controller.js';
```
Remove the `import * as fs` and `import * as path` lines if they are no longer needed after parseLite removal.

---

### `src/test/state/debounce.test.ts` (test, unit)

**Analog:** `src/test/parsers/stress.test.ts` (no fixtures, no `readFileSync`, pure logic with timing)

**Imports pattern** (lines 1–2 of `stress.test.ts`):
```typescript
import { strict as assert } from 'node:assert';
import { parseRoadmap } from '../../parsers/roadmap.js';
```
For debounce test:
```typescript
import { strict as assert } from 'node:assert';
import { debounce } from '../../state/debounce.js';
```

**Timed assertion pattern** (lines 6–7 of `stress.test.ts`):
```typescript
const t0 = performance.now();
// ... run operation
const dt = performance.now() - t0;
assert.ok(dt < LIMIT_MS, `parseRoadmap took ${dt.toFixed(2)}ms (limit ${LIMIT_MS}ms)`);
```

**describe/it structure** (lines 8–9 of `stress.test.ts`):
```typescript
describe('PARS-05 — stress / catastrophic backtracking guard', () => {
  it('parseRoadmap completes in <100ms on pathological input', () => {
```
For debounce test, use the `done` callback pattern from RESEARCH.md:
```typescript
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
});
```

**Key rule:** No EDH needed. No `import * as vscode`. Pure Node.js + Mocha only. Same as `stress.test.ts`.

---

### `src/test/state/controller.test.ts` (test, integration or unit-with-stub)

**Analog:** `src/test/parsers/roadmap.test.ts` (describe/it, node:assert, named groups of related assertions)

**Imports pattern** (lines 1–4 of `roadmap.test.ts`):
```typescript
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseRoadmap } from '../../parsers/roadmap.js';
```
For controller test (runs inside EDH where `vscode` is available):
```typescript
import { strict as assert } from 'node:assert';
import { StateController } from '../../state/controller.js';
```

**Test structure pattern** (lines 13–18 of `roadmap.test.ts`):
```typescript
describe('parseRoadmap — canonical', () => {
  const data = parseRoadmap(load('canonical-roadmap.md'));

  it('extracts the project name (strips "Roadmap:" prefix)', () => {
    assert.equal(data.projectName, 'GSD Status — VS Code Extension');
  });
```
For controller tests (one `describe` per requirement ID, matching RESEARCH.md test map):
```typescript
describe('StateController — WSP-02: fires onStateChanged on refresh', () => {
  it('emits exactly one event per refresh() call', done => { ... });
});

describe('StateController — WSP-04: IO errors emit kind:error not throw', () => {
  it('emits { kind: "error" } when readFile throws non-ENOENT', done => { ... });
});
```

**Key rule:** `controller.test.ts` imports `vscode` indirectly via `StateController`. Run inside the EDH (`@vscode/test-cli`), not bare Mocha. See RESEARCH.md "Recommended workaround" for stubbing `_readFiles`.

---

## Shared Patterns

### Fire-and-Forget Async Guard (IN-04)
**Source:** `src/extension.ts` lines 18–19, 32–61
**Apply to:** `src/state/controller.ts` (refresh() called from watcher callbacks and timer)
```typescript
// Caller site — never await, never let rejection surface:
void this.refresh();

// Inside refresh() — all async + parse work wrapped:
async refresh(): Promise<void> {
  try {
    // ... all file I/O and parsing
  } catch (err) {
    this._emitter.fire({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}
```

### Disposal via `context.subscriptions.push`
**Source:** `src/extension.ts` lines 10, 14
**Apply to:** All new disposables in `extension.ts` `activate()` — controller, timer, event subscription
```typescript
context.subscriptions.push(item);                             // StatusBarItem
context.subscriptions.push({ dispose: () => { ... } });      // inline disposable
context.subscriptions.push(controller);                       // StateController (implements Disposable)
context.subscriptions.push(controller.onStateChanged(...));   // event subscription (returns Disposable)
```

### Lifecycle Disposed Guard (IN-04)
**Source:** `src/extension.ts` lines 36, 46, 53
**Apply to:** `extension.ts` `onStateChanged` callback (check before touching `item.text`)
```typescript
if (lifecycle.disposed) return;
```

### Zero-vscode-import Rule for Pure Modules
**Source:** `src/parsers/types.ts`, `src/parsers/lines.ts`, `src/parsers/roadmap.ts`, `src/parsers/state.ts` (all zero vscode imports)
**Apply to:** `src/state/types.ts`, `src/state/debounce.ts`
Rule: If a file does not call any `vscode.*` API at runtime, it must have zero `import * as vscode` or `import { ... } from 'vscode'` lines. Only `src/state/controller.ts` and `src/extension.ts` are permitted vscode imports.

### Node.js `import` Extension Convention
**Source:** `src/parsers/roadmap.ts` line 9, `src/parsers/state.ts` line 9
**Apply to:** All new files
```typescript
import { splitLines } from './lines.js';     // .js extension required (Node16 module resolution)
import type { RoadmapData } from './types.js';
```

### Mocha Test File Conventions
**Source:** `src/test/parsers/roadmap.test.ts` lines 1–4, `src/test/parsers/stress.test.ts` lines 1–2
**Apply to:** `src/test/state/debounce.test.ts`, `src/test/state/controller.test.ts`
```typescript
import { strict as assert } from 'node:assert';   // always strict assert
// Use describe() + it() — no beforeEach wrappers unless shared setup is substantial
// No top-level async — use done callback or return Promise for async tests
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/` (all `.ts` files — 8 files total)
**Files scanned:** 8 source files read in full
**Pattern extraction date:** 2026-05-21
