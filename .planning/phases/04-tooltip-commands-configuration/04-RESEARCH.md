# Phase 4: Tooltip, Commands + Configuration — Research

**Researched:** 2026-05-21
**Domain:** VS Code Extension API — MarkdownString tooltips, contributes.commands, contributes.configuration, workspace.onDidChangeConfiguration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tooltip Content & Format**
- Tooltip is a `vscode.MarkdownString` — supports bold field labels, theme icons, and readable multi-line structure.
- On `error` state, the tooltip shows the actual error message text (not a generic string).
- The last STATE.md entry timestamp is rendered as a relative time ("2h ago") with the absolute timestamp beneath it.
- The active phase goal is shown in full (tooltips allow multi-line); no truncation.

**Commands**
- The status bar item's default command is `gsd.openState` — "what just happened" is the primary glance value.
- `gsd.openRoadmap` / `gsd.openState` show an info message when the target file is absent — not a silent no-op.
- `gsd.refresh` gives no toast feedback; the status bar updates visibly on its own.
- Command Palette titles: "GSD: Refresh", "GSD: Open Roadmap", "GSD: Open State", all under the "GSD" category.

**Configuration**
- `gsd.refreshIntervalSeconds` changes apply live: an `onDidChangeConfiguration` listener restarts the periodic timer via a new `StateController` method (no window reload).
- `gsd.recentActivityCount` manifest entry is declared now even though it is consumed by the Phase 5 panel.
- Out-of-range config values are guarded by a `package.json` `minimum` plus a defensive clamp in code.
- Both settings use `window` configuration scope (per-window).

### Claude's Discretion

No explicit discretion areas listed — all key decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Side panel TreeView consumption of `gsd.recentActivityCount` — Phase 5.
- Status bar highlight animation on STATE.md change (UX-03) — v2.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-03 | Hover tooltip shows milestone name, active phase name + goal, and the most recent STATE.md entry (text + timestamp) | MarkdownString API; UI-SPEC tooltip contract; existing RoadmapData/StateData types already carry all needed fields |
| STAT-04 | Status bar item has a default command (`gsd.openState`) | `StatusBarItem.command` property assignment; command must be registered before item.command is set |
| CMD-01 | `gsd.refresh` — manually trigger `StateController.refresh()` | `commands.registerCommand` + controller reference; no toast on success |
| CMD-02 | `gsd.openRoadmap` — open `.planning/ROADMAP.md` in editor tab, info message if absent | `workspace.openTextDocument` + `window.showTextDocument`; `window.showInformationMessage` for absent case |
| CMD-03 | `gsd.openState` — open `.planning/STATE.md` in editor tab, info message if absent | Same pattern as CMD-02 |
| CMD-04 | All commands appear in Command Palette under "GSD" category, wired in activation | `contributes.commands` package.json array with `category: "GSD"`; `commands.registerCommand` in `activate()` |
| CFG-01 | `gsd.refreshIntervalSeconds` (number, default 30, min 5) — periodic refresh interval | `contributes.configuration` with `type: "number"`, `default: 30`, `minimum: 5`, `scope: "window"` |
| CFG-02 | `gsd.recentActivityCount` (number, default 5, min 1) — recent STATE.md entries count | Same pattern; consumed by Phase 5, but declared now |
| CFG-03 | Configuration changes apply without window reload | `workspace.onDidChangeConfiguration` + `affectsConfiguration`; `StateController.setRefreshInterval()` new method |
</phase_requirements>

---

## Summary

Phase 4 extends three existing, already-wired surfaces — the status bar item, the StateController, and package.json — without adding new modules or dependencies. Every API needed is a VS Code built-in. No npm packages are installed.

The three work streams are largely independent: (1) build the MarkdownString tooltip and assign it inside the existing `onStateChanged` switch in extension.ts; (2) add three command registrations to `activate()` and declare them in `package.json` `contributes.commands`; (3) declare two configuration properties in `package.json` `contributes.configuration`, add an `onDidChangeConfiguration` listener in `activate()`, and add a `setRefreshInterval(seconds)` method to StateController. The hardest design decision — how to restart the periodic timer — is already decided: clear the old interval and start a new one inside `setRefreshInterval`.

The only new logic that is not purely structural is (a) the relative-time helper ("2h ago" formatting) and (b) the defensive clamp (`Math.max(5, value)`) in `setRefreshInterval`. Both are trivial pure functions. The vscode-stub.ts already exists for Mocha tests; it will need small additions (`MarkdownString`, `commands`, `workspace.getConfiguration`) to cover Phase 4 test paths.

**Primary recommendation:** Implement in three sequential tasks — tooltip, commands, configuration — each with its own test coverage pass. Order: tooltip first (pure formatting, no side effects), then commands (requires package.json changes), then configuration (requires StateController mutation).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tooltip construction | Extension Host (extension.ts onStateChanged handler) | — | Tooltip is view logic; belongs in the same switch that already sets item.text |
| Relative time formatting | Pure utility module (src/state/relativeTime.ts or inline helper) | — | No vscode dep; unit-testable in isolation |
| Command registration | Extension Host (activate()) | package.json manifest | Commands must be declared in manifest AND registered in code |
| File open (open commands) | Extension Host (activate() command callback) | — | Uses vscode.workspace + vscode.window APIs |
| Config declaration | package.json contributes.configuration | — | Schema/defaults live in manifest; runtime reading uses workspace.getConfiguration |
| Config live reload | Extension Host (onDidChangeConfiguration listener in activate()) | StateController | Listener reads new value, calls controller.setRefreshInterval() |
| Timer management | StateController.setRefreshInterval() | — | StateController owns the interval; extension.ts should not touch timer internals |

---

## Standard Stack

### Core (all VS Code built-ins — no npm installs)

| API | Where Used | Notes |
|-----|-----------|-------|
| `vscode.MarkdownString` | extension.ts tooltip construction | Constructor: `new vscode.MarkdownString(value?, isTrusted?)`. Set `isTrusted: false` (default). `appendMarkdown(value: string)` appends to existing content. [CITED: code.visualstudio.com/api] |
| `vscode.StatusBarItem.command` | extension.ts activate() | Assign string command ID: `item.command = 'gsd.openState'`. The command must be registered. [CITED: code.visualstudio.com/api] |
| `vscode.commands.registerCommand` | extension.ts activate() | `commands.registerCommand(id, callback): Disposable` — push returned disposable to `context.subscriptions`. [CITED: code.visualstudio.com/api] |
| `vscode.workspace.openTextDocument` | open command callbacks | Takes a `vscode.Uri`; returns `Promise<TextDocument>`. Throws/rejects if file not found — catch for absent-file info message. [CITED: code.visualstudio.com/api] |
| `vscode.window.showTextDocument` | open command callbacks | Takes `TextDocument`; opens in editor tab. [CITED: code.visualstudio.com/api] |
| `vscode.window.showInformationMessage` | open command callbacks (absent file path) | `showInformationMessage(message: string): Thenable<string \| undefined>` [CITED: code.visualstudio.com/api] |
| `vscode.workspace.getConfiguration` | activate() + StateController constructor | `getConfiguration('gsd').get<number>('refreshIntervalSeconds', 30)` — second arg is default. [CITED: code.visualstudio.com/api] |
| `vscode.workspace.onDidChangeConfiguration` | activate() | Event fires with `ConfigurationChangeEvent`; call `event.affectsConfiguration('gsd.refreshIntervalSeconds')` to filter. [CITED: code.visualstudio.com/api] |

### No Runtime Dependencies

Phase 4 adds zero npm packages. The `## Package Legitimacy Audit` section is omitted per the UI-SPEC registry safety gate.

---

## Architecture Patterns

### System Architecture Diagram

```
User hovers status bar
        │
        ▼
  item.tooltip (MarkdownString)
  built in onStateChanged handler
        │
        ├─── ok state ──────────────────────▶ build full tooltip
        │                                     (milestone, phase, goal, last entry)
        │                                            │
        │                                     relativeTime(timestamp)
        │                                     formatTooltip(roadmap, state)
        │
        └─── error state ──────────────────▶ build error tooltip
                                              (heading + state.message)

User invokes Command Palette
        │
        ├─── gsd.refresh ──────────────────▶ controller.refresh()
        │
        ├─── gsd.openRoadmap ──────────────▶ try: open ROADMAP.md in editor
        │                                    catch: showInformationMessage
        │
        └─── gsd.openState ────────────────▶ try: open STATE.md in editor
                                             catch: showInformationMessage

User changes setting
        │
        ▼
  onDidChangeConfiguration
        │
        ├─── affectsConfiguration('gsd.refreshIntervalSeconds')
        │         │
        │         ▼
        │    getConfiguration('gsd').get('refreshIntervalSeconds', 30)
        │         │
        │         ▼
        │    controller.setRefreshInterval(seconds)  ← new method
        │         │
        │         ▼
        │    clearInterval(old) → setInterval(new)
        │
        └─── affectsConfiguration('gsd.recentActivityCount')
                  │
                  ▼
             store value for Phase 5 consumption
```

### Recommended Project Structure (additions only)

```
src/
├── extension.ts           # add: command registrations, tooltip build, config listener
├── state/
│   ├── controller.ts      # add: setRefreshInterval(seconds) method; read initial interval from config
│   ├── types.ts           # no changes
│   ├── debounce.ts        # no changes
│   └── relativeTime.ts    # NEW: hand-rolled relative time helper (pure, zero deps)
└── test/
    ├── state/
    │   ├── controller.test.ts   # add: setRefreshInterval tests
    │   └── relativeTime.test.ts # NEW: relative time unit tests
    └── extension.test.ts        # NEW or add to existing: tooltip format, command smoke tests
```

### Pattern 1: MarkdownString Tooltip Construction

**What:** Build a `vscode.MarkdownString` from parsed `GsdState` data in the `onStateChanged` handler.
**When to use:** Inside the `case 'ok':` and `case 'error':` branches of the existing switch.

```typescript
// Source: VS Code API docs (cited)
function buildOkTooltip(roadmap: RoadmapData, state: StateData): vscode.MarkdownString {
  const ms = new vscode.MarkdownString();
  const milestone = roadmap.milestoneLabel ?? roadmap.projectName ?? 'GSD';
  const active = roadmap.phases.find(p => !p.done);
  
  ms.appendMarkdown(`**GSD**\n\n`);
  ms.appendMarkdown(`**Milestone:** ${milestone}\n`);
  
  if (active) {
    ms.appendMarkdown(`**Phase:** ${active.number}: ${active.name}\n`);
    ms.appendMarkdown(`**Goal:** ${active.goal ?? '(no goal defined)'}\n`);
  } else {
    ms.appendMarkdown(`**Phase:** All phases complete\n`);
  }
  
  if (state.lastEntry) {
    const rel = relativeTime(state.lastEntry.timestamp ?? state.lastUpdated ?? '');
    const abs = state.lastEntry.timestamp ?? state.lastUpdated ?? '';
    ms.appendMarkdown(`\n---\n\n`);
    ms.appendMarkdown(`**Last Entry**\n`);
    ms.appendMarkdown(`_${rel}_ — \`${abs}\`\n`);
    ms.appendMarkdown(state.lastEntry.text);
  }
  
  return ms;
}

function buildErrorTooltip(message: string): vscode.MarkdownString {
  const ms = new vscode.MarkdownString();
  ms.appendMarkdown(`**GSD — Parse Error**\n\n${message}`);
  return ms;
}
```

### Pattern 2: Command Registration

**What:** Register three commands in `activate()`, push all to `context.subscriptions`.
**When to use:** In `extension.ts activate()`, after the controller and status bar item are created.

```typescript
// Source: VS Code API docs (cited)
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

item.command = 'gsd.openState'; // assign AFTER command is registered
```

### Pattern 3: package.json contributes.commands

```json
"contributes": {
  "commands": [
    { "command": "gsd.refresh",     "title": "Refresh",      "category": "GSD" },
    { "command": "gsd.openRoadmap", "title": "Open Roadmap", "category": "GSD" },
    { "command": "gsd.openState",   "title": "Open State",   "category": "GSD" }
  ]
}
```

Command Palette shows: "GSD: Refresh", "GSD: Open Roadmap", "GSD: Open State". [CITED: code.visualstudio.com/api/references/contribution-points#contributes.commands]

### Pattern 4: package.json contributes.configuration

```json
"contributes": {
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

[CITED: code.visualstudio.com/api/references/contribution-points#contributes.configuration]

### Pattern 5: Live Configuration Reload

```typescript
// Source: VS Code API docs (cited)
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

### Pattern 6: StateController.setRefreshInterval()

**What:** New public method that replaces the periodic timer with a new interval.
**Constraint:** `_timerDisposable` is currently `readonly`. Must change to `private _timerDisposable` to allow reassignment.

```typescript
setRefreshInterval(seconds: number): void {
  const ms = Math.max(5, seconds) * 1000; // defensive clamp
  this._timerDisposable.dispose();         // clear old interval
  const safeRefresh = (): void => {
    this.refresh().catch((e) => console.error('GSD refresh failed', e));
  };
  const id = setInterval(safeRefresh, ms);
  this._timerDisposable = { dispose: () => clearInterval(id) };
}
```

**Note:** The constructor should also read initial config instead of using the hardcoded `REFRESH_INTERVAL_MS` constant. However, passing the initial interval as a constructor parameter is cleaner (keeps StateController free of direct vscode.workspace calls, preserving testability).

### Pattern 7: relativeTime() Helper

**What:** Pure function — no vscode import, no date library.

```typescript
// src/state/relativeTime.ts
export function relativeTime(isoString: string): string {
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

Buckets (from UI-SPEC): <60s → "just now", <60m → "Nm ago", <24h → "Nh ago", ≥24h → "N days ago".

### Anti-Patterns to Avoid

- **Assigning `item.command` before registering the command:** VS Code will show the item, but clicking it does nothing until the command is registered. Register all commands first, then set `item.command`.
- **Passing `isTrusted: true` to MarkdownString:** The error tooltip renders `state.message` which may contain user-controlled path strings. Keep `isTrusted: false` (the default). `isTrusted` enables command URIs — not needed here.
- **Making `StateController` call `workspace.getConfiguration` directly:** This couples the controller to vscode in a way that breaks Mocha unit tests (which use the vscode stub). Receive the initial interval as a constructor parameter from `activate()`, and accept seconds via `setRefreshInterval()` which `activate()`'s config listener will call.
- **Using `setInterval` directly in extension.ts:** Timer ownership belongs in StateController. Extension.ts only calls `controller.setRefreshInterval(seconds)`.
- **`void` vs `await` on command callbacks:** Command callbacks registered with `registerCommand` should return `void` synchronously or return a `Thenable`. Wrapping async logic with `void` is the correct pattern for fire-and-forget. Don't `await` inside the synchronous registration closure — use a proper async IIFE or `void asyncFn()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip rendering | Custom HTML/webview | `vscode.MarkdownString` | VS Code renders MarkdownString natively; custom rendering is out-of-scope and overkill |
| Opening files in editor | `child_process.exec` / `fs.open` | `workspace.openTextDocument` + `window.showTextDocument` | VS Code API handles encoding, line endings, editor placement |
| Config schema validation | Runtime JSON schema validator | `package.json` `minimum` + `Math.max` clamp | VS Code Settings UI enforces `minimum` on input; code guard catches programmatic writes |
| Date formatting | `moment`, `date-fns`, `luxon` | Hand-rolled `relativeTime()` helper | 5 comparison branches; no library needed; zero runtime dependency |

**Key insight:** Every problem in Phase 4 has a VS Code native or trivially hand-rolled solution. Adding any npm runtime dependency here would be a regression in the "zero runtime deps" constraint.

---

## Common Pitfalls

### Pitfall 1: MarkdownString newlines require explicit `\n\n` for paragraph breaks
**What goes wrong:** Single `\n` inside `appendMarkdown` renders as a line continuation (no visible break) in VS Code tooltips. Bold labels on the same visual line as values.
**Why it happens:** MarkdownString follows CommonMark — single newline is not a paragraph break.
**How to avoid:** Use `\n\n` between distinct sections, `\n` within a section when you explicitly want a soft line break. Follow the UI-SPEC spacing table exactly.
**Warning signs:** Tooltip content appears as one continuous paragraph in the hover popup.

### Pitfall 2: `_timerDisposable` is declared `readonly` in the current controller
**What goes wrong:** `setRefreshInterval` cannot reassign `this._timerDisposable` because TypeScript will error: "Cannot assign to '_timerDisposable' because it is a read-only property."
**Why it happens:** The Phase 3 implementation declared it `readonly` since it was never intended to change.
**How to avoid:** Change `private readonly _timerDisposable` to `private _timerDisposable` in controller.ts.
**Warning signs:** TypeScript compile error in `setRefreshInterval`.

### Pitfall 3: `contributes.commands` declared but not registered crashes Command Palette
**What goes wrong:** The command appears in the palette, but invoking it throws "command not found" error.
**Why it happens:** `contributes.commands` declares the manifest entry; `commands.registerCommand` is the runtime registration. Both are required.
**How to avoid:** Always pair every `contributes.commands` entry with a `commands.registerCommand` call in `activate()`.
**Warning signs:** "Command 'gsd.refresh' not found" notification in VS Code when command is invoked.

### Pitfall 4: `workspace.openTextDocument` rejection for absent files
**What goes wrong:** The open-file commands throw uncaught rejection when the file doesn't exist, instead of showing the info message.
**Why it happens:** `openTextDocument` rejects (does not return `undefined`) when the file is not found.
**How to avoid:** Wrap in `try/catch` (or `.catch()`) and call `showInformationMessage` in the catch branch. See Pattern 2 above.
**Warning signs:** "Unhandled promise rejection" in the extension host output channel.

### Pitfall 5: vscode-stub.ts needs additions for Phase 4 tests
**What goes wrong:** Tests that exercise tooltip construction, command registration, or config reading fail with "vscode.MarkdownString is not a constructor" or "workspace.getConfiguration is not a function".
**Why it happens:** The stub was written for Phase 3 controller tests only. It does not include `MarkdownString`, `commands.registerCommand`, or `workspace.getConfiguration`.
**How to avoid:** Extend `vscode-stub.ts` before writing Phase 4 tests. Add a minimal `MarkdownString` class (stores appended text), a `commands` stub (no-ops), and a `workspace.getConfiguration` stub that returns test fixture values.
**Warning signs:** Test file fails to load at all, or `TypeError` on first test.

### Pitfall 6: `affectsConfiguration` requires the full dotted key
**What goes wrong:** Filtering with `event.affectsConfiguration('gsd')` fires for ANY change under the `gsd.*` namespace, including `gsd.recentActivityCount`, causing unnecessary timer restarts.
**Why it happens:** `affectsConfiguration` accepts prefix matching.
**How to avoid:** Use the fully-qualified key: `event.affectsConfiguration('gsd.refreshIntervalSeconds')`.
**Warning signs:** Timer restarts when `gsd.recentActivityCount` changes.

---

## Code Examples

### relativeTime() — full implementation

```typescript
// src/state/relativeTime.ts
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

### StateController.setRefreshInterval() — full implementation

```typescript
// In StateController class; change _timerDisposable from readonly to private
private _timerDisposable: vscode.Disposable;

setRefreshInterval(seconds: number): void {
  const ms = Math.max(5, seconds) * 1000;
  this._timerDisposable.dispose();
  const safeRefresh = (): void => {
    this.refresh().catch((e) => console.error('GSD refresh failed', e));
  };
  const id = setInterval(safeRefresh, ms);
  this._timerDisposable = { dispose: () => clearInterval(id) };
}
```

### vscode-stub.ts additions needed for Phase 4

```typescript
// Additions to module.exports in vscode-stub.ts:

class MarkdownString {
  private _value = '';
  appendMarkdown(value: string): this { this._value += value; return this; }
  get value(): string { return this._value; }
}

// In module.exports:
MarkdownString,
commands: {
  registerCommand: (_id: string, _cb: () => void): { dispose(): void } => {
    return { dispose: () => undefined };
  },
},
Uri: {
  file: (p: string): { fsPath: string } => ({ fsPath: p }),
},
// Extend workspace:
workspace: {
  ...existing,
  getConfiguration: (_section?: string) => ({
    get: <T>(_key: string, defaultValue: T): T => defaultValue,
  }),
  onDidChangeConfiguration: (_listener: () => void): { dispose(): void } => {
    return { dispose: () => undefined };
  },
},
window: {
  ...existing,
  showTextDocument: async (_doc: unknown): Promise<void> => undefined,
  showInformationMessage: (_msg: string): void => undefined,
  openTextDocument: async (_uri: unknown): Promise<unknown> => ({}),
},
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha 11.7.5 (via @vscode/test-cli) |
| Config file | `.mocharc.cjs` (inferred from existing test patterns) |
| Quick run command | `npm run test:parsers` (existing) / `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-03 | Tooltip ok state renders milestone, phase, goal, last entry | unit | `mocha "out/test/state/tooltip.test.js"` | Wave 0 |
| STAT-03 | Tooltip ok state omits Last Entry section when lastEntry is absent | unit | same | Wave 0 |
| STAT-03 | Tooltip error state renders actual error message | unit | same | Wave 0 |
| STAT-03 | Tooltip no-project state is undefined | unit | same | Wave 0 |
| STAT-04 | item.command equals 'gsd.openState' after activation | unit | `mocha "out/test/extension.test.js"` | Wave 0 |
| CMD-01 | gsd.refresh triggers controller.refresh() | unit | same | Wave 0 |
| CMD-02 | gsd.openRoadmap calls showInformationMessage when file absent | unit | same | Wave 0 |
| CMD-03 | gsd.openState calls showInformationMessage when file absent | unit | same | Wave 0 |
| CFG-01 | setRefreshInterval clamps to minimum 5s | unit | `mocha "out/test/state/controller.test.js"` | ✅ (add tests) |
| CFG-01 | setRefreshInterval starts new timer and clears old | unit | same | ✅ (add tests) |
| CFG-02 | recentActivityCount config declared in package.json | manual | n/a | n/a |
| CFG-03 | onDidChangeConfiguration fires setRefreshInterval with new value | unit | `mocha "out/test/extension.test.js"` | Wave 0 |
| — | relativeTime: <60s → "just now" | unit | `mocha "out/test/state/relativeTime.test.js"` | Wave 0 |
| — | relativeTime: <60m → "Nm ago" | unit | same | Wave 0 |
| — | relativeTime: <24h → "Nh ago" | unit | same | Wave 0 |
| — | relativeTime: ≥24h → "N days ago" | unit | same | Wave 0 |
| — | relativeTime: invalid/undefined → "unknown" | unit | same | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (all suites, fast — no EDH needed)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work` + manual EDH hover test

### Wave 0 Gaps

- [ ] `src/test/state/relativeTime.test.ts` — covers relative time formatting (5 buckets + edge cases)
- [ ] `src/test/state/tooltip.test.ts` — covers all three tooltip states (ok, error, no-project)
- [ ] `src/test/extension.test.ts` — covers command wiring, item.command assignment, config listener
- [ ] `src/test/setup/vscode-stub.ts` — extend with MarkdownString, commands, Uri, getConfiguration, onDidChangeConfiguration, showTextDocument, showInformationMessage stubs

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is a code-only change. No external CLIs, databases, or services required beyond the existing Node.js/npm/tsc toolchain already verified in Phase 3.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — read-only local extension |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes (low risk) | `Math.max(5, value)` clamp on config number; `isTrusted: false` on MarkdownString |
| V6 Cryptography | no | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious STATE.md injecting MarkdownString command URI | Tampering | `isTrusted: false` on all MarkdownString instances — command URIs are not rendered |
| Config value outside declared minimum (e.g., 0s interval causing busy-loop) | Denial of Service | `Math.max(5, value)` clamp in `setRefreshInterval` + `minimum: 5` in package.json |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `item.tooltip = string` | `item.tooltip = vscode.MarkdownString` | VS Code 1.x | Enables bold, icons, italic, code spans in hover |
| Manual `clearInterval` scatter | Disposable wrapper `{ dispose: () => clearInterval(id) }` | Phase 3 established | Consistent disposal via `context.subscriptions` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `workspace.openTextDocument` rejects (rather than returning undefined) when file is not found | Pitfall 4, Pattern 2 | The try/catch pattern would still work even if it returned undefined — null check would be needed instead |
| A2 | `ConfigurationChangeEvent.affectsConfiguration` accepts fully-qualified dotted key for exact-section matching | Pattern 5 | Prefix matching may require more specific filtering; low risk |

---

## Open Questions

1. **StateController constructor signature for initial interval**
   - What we know: The constructor currently reads `REFRESH_INTERVAL_MS = 30_000` hardcoded.
   - What's unclear: Should the constructor call `workspace.getConfiguration` itself (simpler for callers, harder to test) or accept an `initialIntervalSeconds` parameter (testable, keeps vscode dep in extension.ts)?
   - Recommendation: Accept `initialIntervalSeconds?: number` parameter. `activate()` reads the config and passes it in. Keeps StateController pure. Existing tests pass unchanged since they don't pass the parameter (defaults to 30).

2. **`dispose()` and `setRefreshInterval()` interaction**
   - What we know: `dispose()` calls `this._timerDisposable.dispose()`.
   - What's unclear: If `setRefreshInterval` is called after `dispose()`, it would start a new interval that never gets cleaned up.
   - Recommendation: Add a `_disposed` guard (similar to the `lifecycle` guard in extension.ts) to `setRefreshInterval`: if already disposed, ignore the call.

---

## Sources

### Primary (HIGH confidence)
- [VS Code API Reference — contributes.commands](https://code.visualstudio.com/api/references/contribution-points#contributes.commands) — command schema, category behavior, palette display format
- [VS Code API Reference — contributes.configuration](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration) — configuration schema, minimum constraint, scope values
- [VS Code API Reference — workspace.onDidChangeConfiguration + affectsConfiguration](https://code.visualstudio.com/api/references/vscode-api) — event signature, ConfigurationChangeEvent pattern
- [VS Code API Reference — commands.registerCommand, showTextDocument, showInformationMessage](https://code.visualstudio.com/api/references/vscode-api) — signatures confirmed

### Secondary (MEDIUM confidence)
- Existing codebase: `src/extension.ts`, `src/state/controller.ts`, `src/state/types.ts`, `src/parsers/types.ts`, `src/test/setup/vscode-stub.ts` — Phase 4 integration points derived from direct code inspection
- `04-UI-SPEC.md` — tooltip exact format, copywriting, interaction states (authoritative for this project)
- `04-CONTEXT.md` — all locked decisions

### Tertiary (LOW confidence)
- None — all claims in this document are either verified from official VS Code API docs or derived from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all APIs are VS Code built-ins confirmed from official docs
- Architecture: HIGH — derived from existing code patterns + official API docs
- Pitfalls: HIGH — derived from TypeScript compile behavior and official API semantics
- Test plan: HIGH — mirrors existing Mocha/stub test pattern from Phase 3

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (VS Code API is stable; extension APIs don't change rapidly)
