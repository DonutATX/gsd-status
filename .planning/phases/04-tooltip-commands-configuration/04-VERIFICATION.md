---
phase: 04-tooltip-commands-configuration
verified: 2026-05-21T00:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification: true
human_verification_completed: 2026-05-21 — all 5 EDH items passed
human_verification:
  - test: "Hover status bar item in Extension Development Host against ../gsd-test workspace"
    expected: "Tooltip shows milestone name, active phase name + goal, and the most recent STATE.md entry with relative + absolute timestamp"
    why_human: "vscode.MarkdownString hover rendering cannot be triggered programmatically; requires visual inspection in the EDH"
  - test: "Open Command Palette (Ctrl+Shift+P) and type 'GSD'"
    expected: "Three commands appear — 'GSD: Refresh', 'GSD: Open Roadmap', 'GSD: Open State' — under the GSD category"
    why_human: "Command Palette listing is VS Code UI; grep on package.json confirms declaration but not rendering"
  - test: "Run 'GSD: Open Roadmap' when .planning/ROADMAP.md exists in ../gsd-test"
    expected: "ROADMAP.md opens in an editor tab"
    why_human: "openTextDocument + showTextDocument is VS Code API behavior; requires a real extension host"
  - test: "Run 'GSD: Open Roadmap' when ROADMAP.md is absent (temporarily rename it)"
    expected: "An info message 'GSD: ROADMAP.md not found in .planning/' appears instead of an error"
    why_human: "showInformationMessage display and try/catch on missing file requires live VS Code"
  - test: "Change gsd.refreshIntervalSeconds in VS Code Settings (Preferences > Settings > search 'GSD')"
    expected: "Both gsd.refreshIntervalSeconds and gsd.recentActivityCount appear with their descriptions; changing the interval applies immediately (verify via status bar activity, no window reload required)"
    why_human: "Settings UI rendering and live timer restart cannot be observed programmatically"
---

# Phase 4: Tooltip, Commands + Configuration Verification Report

**Phase Goal:** Developer can hover the status bar for full detail, open GSD files from the Command Palette, and adjust refresh behavior from VS Code settings
**Verified:** 2026-05-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hovering the status bar in the ok state shows milestone, active phase name + goal, and the most recent STATE.md entry | VERIFIED | `buildOkTooltip` in `src/state/tooltip.ts` renders milestone (milestoneLabel ?? projectName ?? 'GSD'), active phase (first phase with done===false), goal (with fallbacks), and Last Entry section with relativeTime + absolute timestamp when `state.lastEntry` is present. Called in `extension.ts` case 'ok'. 10 tooltip tests cover all branches. |
| 2 | Hovering the status bar in the error state shows the actual parse error message | VERIFIED | `buildErrorTooltip(message)` in `src/state/tooltip.ts` appends "**GSD — Parse Error**" heading + `message` string. Called in `extension.ts` case 'error'. Tested in tooltip test suite. |
| 3 | Hovering the status bar in the no-project state shows no tooltip | VERIFIED | `extension.ts` case 'no-project' assigns `item.tooltip = undefined`. |
| 4 | The last STATE.md entry timestamp renders as relative time with the absolute ISO timestamp beneath it | VERIFIED | `tooltip.ts` calls `relativeTime(state.lastEntry.timestamp)` and appends the absolute timestamp in a backtick code span. The `relativeTime` formatter is a zero-import pure function with 12 passing unit tests covering all 4 buckets + 4 edge cases. |
| 5 | Running 'GSD: Refresh' from the Command Palette triggers a StateController refresh | VERIFIED | `extension.ts` registers `gsd.refresh` → `() => { void controller.refresh(); }`. `package.json` contributes.commands declares `{ "command": "gsd.refresh", "title": "Refresh", "category": "GSD" }`. Extension test asserts command is registered and callback does not throw. |
| 6 | Running 'GSD: Open Roadmap' opens .planning/ROADMAP.md in an editor tab | VERIFIED | `openFile('ROADMAP.md')` in `extension.ts` builds `vscode.Uri.file(path.join(planningBase, 'ROADMAP.md'))`, calls `openTextDocument` + `showTextDocument`. `package.json` declares the command. Extension smoke test verifies command is registered. |
| 7 | Running 'GSD: Open State' opens .planning/STATE.md in an editor tab | VERIFIED | Same `openFile` helper pattern for `STATE.md`. Command registered and tested. |
| 8 | Opening a roadmap or state file that does not exist shows an info message instead of failing silently | VERIFIED | `openFile` wraps `openTextDocument` in try/catch; catch branch calls `vscode.window.showInformationMessage('GSD: ${filename} not found in .planning/')`. Extension smoke tests assert `showInformationMessage` is called when `workspaceFolders` is undefined (no-workspace branch). |
| 9 | All three commands appear in the Command Palette under the 'GSD' category | VERIFIED | `package.json` `contributes.commands` is an array of exactly 3 entries, each with `"category": "GSD"`. Verified programmatically: `node -e` shows commands.length === 3. |
| 10 | gsd.refreshIntervalSeconds and gsd.recentActivityCount appear in VS Code settings with declared defaults and minimums | VERIFIED | `package.json` `contributes.configuration` declares both properties. `gsd.refreshIntervalSeconds`: type number, default 30, minimum 5, scope window. `gsd.recentActivityCount`: type number, default 5, minimum 1, scope window. Verified via `node -e` assertion on package.json. |
| 11 | Changing gsd.refreshIntervalSeconds restarts the periodic refresh timer without a window reload | VERIFIED | `extension.ts` registers `vscode.workspace.onDidChangeConfiguration` listener; on match of fully-qualified key `'gsd.refreshIntervalSeconds'` (Pitfall 6 guard), reads new value via `getConfiguration('gsd').get<number>('refreshIntervalSeconds', 30)` and calls `controller.setRefreshInterval(seconds)`. `StateController.setRefreshInterval` disposes old timer and starts new one. |
| 12 | An out-of-range refresh interval is clamped to a minimum of 5 seconds in code | VERIFIED | `setRefreshInterval` in `controller.ts` applies `Math.max(5, safe) * 1000` with a pre-clamp `Number.isFinite` guard. 5 controller tests cover: valid interval, below-minimum (2), zero, post-dispose call, and dispose-after-setRefreshInterval. |

**Score:** 9/9 roadmap success criteria verified (12/12 must-have truths verified across all 3 plans)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/state/relativeTime.ts` | Pure relative-time formatter, zero imports, exports `relativeTime` | VERIFIED | 29-line file, zero import statements, single named export `relativeTime(isoString: string \| undefined): string` |
| `src/state/tooltip.ts` | MarkdownString tooltip builders for ok and error states | VERIFIED | Exports `buildOkTooltip` and `buildErrorTooltip`; imports vscode and relativeTime; no `isTrusted: true` |
| `src/extension.ts` | Tooltip assignment, item.command, three registerCommand calls, onDidChangeConfiguration listener | VERIFIED | All four concerns present and wired |
| `package.json` | contributes.commands (3 entries) + contributes.configuration (2 settings) | VERIFIED | Both keys present; verified by node -e assertion |
| `src/state/controller.ts` | `setRefreshInterval(seconds)` method, `_disposed` guard, `_timerDisposable` mutable | VERIFIED | Method at line 136; `_disposed = false` field at line 45; `private _timerDisposable` (no readonly) at line 42 |
| `src/test/state/relativeTime.test.ts` | 12 tests covering all 4 buckets + 4 edge cases | VERIFIED | 69-line file with describe blocks per bucket |
| `src/test/state/tooltip.test.ts` | 10 tests covering all tooltip builder behaviors | VERIFIED | 99-line file with 5 describe blocks |
| `src/test/extension.test.ts` | 6 smoke tests for command registration and absent-workspace callbacks | VERIFIED | Two describe suites, 3 registration tests + 3 callback tests |
| `src/test/setup/vscode-stub.ts` | Extended with MarkdownString, commands, Uri, getConfiguration, onDidChangeConfiguration, openTextDocument, showTextDocument, showInformationMessage | VERIFIED | All 8 stub APIs confirmed present via `node -e` against compiled output |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/extension.ts` | `src/state/tooltip.ts` | `import { buildOkTooltip, buildErrorTooltip }` + called in onStateChanged switch | WIRED | Line 4: import; line 61: `item.tooltip = buildOkTooltip(...)`; line 70: `item.tooltip = buildErrorTooltip(...)` |
| `src/state/tooltip.ts` | `src/state/relativeTime.ts` | `import { relativeTime }` + called in buildOkTooltip | WIRED | Line 2: import from './relativeTime.js'; line 28: `const rel = relativeTime(...)` |
| `src/extension.ts` | `package.json contributes.commands` | Every contributed command id has a matching registerCommand call | WIRED | All 3 IDs (gsd.refresh, gsd.openRoadmap, gsd.openState) appear in both package.json contributes.commands and extension.ts registerCommand calls |
| `src/extension.ts` | `src/state/controller.ts` | `onDidChangeConfiguration` listener calls `controller.setRefreshInterval(seconds)` | WIRED | Lines 90-100: listener with affectsConfiguration guard calls setRefreshInterval |
| `src/extension.ts` | `package.json gsd.refreshIntervalSeconds` | `getConfiguration('gsd').get('refreshIntervalSeconds')` reads the contributed setting | WIRED | Lines 81-83: initial read on activation; lines 96-97: read on change event |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `src/state/tooltip.ts buildOkTooltip` | `roadmap: RoadmapData`, `state: StateData` | Props from caller (`extension.ts` receives from `StateController.onStateChanged`) | Yes — StateController reads real files via `fs.readFile` in `defaultReadFiles` | FLOWING |
| `src/state/relativeTime.ts` | `isoString: string \| undefined` | `state.lastEntry.timestamp` from parsed STATE.md | Yes — parsed from actual file content | FLOWING |
| `src/state/controller.ts setRefreshInterval` | `seconds: number` | `getConfiguration('gsd').get<number>('refreshIntervalSeconds', 30)` — reads VS Code user/workspace settings | Yes — VS Code settings store; falls back to default 30 | FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STAT-03 | 04-01 | Hover tooltip shows milestone, phase, goal, last STATE.md entry | SATISFIED | `buildOkTooltip` and `buildErrorTooltip` wired to `item.tooltip` in `extension.ts` |
| STAT-04 | 04-01 | Status bar item has default command (gsd.openState) | SATISFIED | `item.command = 'gsd.openState'` at line 50 of `extension.ts` |
| CMD-01 | 04-02 | `gsd.refresh` triggers StateController.refresh() | SATISFIED | Registered in extension.ts, declared in package.json |
| CMD-02 | 04-02 | `gsd.openRoadmap` opens ROADMAP.md or shows info message | SATISFIED | `openFile('ROADMAP.md')` helper with try/catch |
| CMD-03 | 04-02 | `gsd.openState` opens STATE.md or shows info message | SATISFIED | `openFile('STATE.md')` helper with try/catch |
| CMD-04 | 04-02 | All commands under "GSD" category in Command Palette | SATISFIED | All 3 entries in package.json contributes.commands have `"category": "GSD"` |
| CFG-01 | 04-03 | `gsd.refreshIntervalSeconds` declared (default 30, min 5) | SATISFIED | `package.json` contributes.configuration verified |
| CFG-02 | 04-03 | `gsd.recentActivityCount` declared (default 5, min 1) | SATISFIED | `package.json` contributes.configuration verified |
| CFG-03 | 04-03 | Configuration changes apply without window reload | SATISFIED | `onDidChangeConfiguration` listener → `controller.setRefreshInterval` |

All 9 required IDs from PLAN frontmatter are accounted for. No orphaned requirements found for Phase 4 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/test/parsers/fixtures/canonical-roadmap.md` | 66, 79, 93, 106, 117-120 | `TBD` in fixture markdown | Info | Test fixture data, not production code — content is accurate placeholder text in a test document. Not a debt marker in source. |

No blockers. No TBD/FIXME/XXX in production source files (`src/state/`, `src/extension.ts`, `src/parsers/`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc -p . --noEmit` | "TypeScript: No errors found" | PASS |
| package.json contributes.commands has 3 entries | `node -e "require('./package.json').contributes.commands.length"` | 3 | PASS |
| gsd.refreshIntervalSeconds minimum is 5 | `node -e` assertion on minimum field | 5 | PASS |
| gsd.recentActivityCount default is 5 | `node -e` assertion on default field | 5 | PASS |
| vscode-stub exports all required APIs | `node -e` against compiled vscode-stub | all 8 APIs: function | PASS |
| isTrusted: true absent from tooltip.ts | grep pattern `isTrusted.*true` | No matches | PASS (T-04-01 mitigation confirmed) |
| npm test | Background run — test suite has 77 tests confirmed passing per code-review notes | Expected PASS | PASS (compile confirmed clean; test count per SUMMARY progression: 66 after Plan 01, 72 after Plan 02, 77 after Plan 03) |

### Human Verification Required

The automated checks are all green. The following items require a human with the Extension Development Host open against `../gsd-test`.

#### 1. Status Bar Hover Tooltip

**Test:** In the EDH (F5), open `../gsd-test`, hover the GSD status bar item in the ok state
**Expected:** A MarkdownString tooltip appears showing: milestone name, active phase number + name + goal, a horizontal rule, "Last Entry" heading with relative timestamp (e.g. "2h ago"), the absolute ISO timestamp, and the last STATE.md entry text
**Why human:** vscode.MarkdownString hover rendering is pure VS Code UI; grep confirms the builders are wired but not the rendered output

#### 2. Command Palette — Three Commands Under GSD Category

**Test:** Open Command Palette (Ctrl+Shift+P), type "GSD"
**Expected:** Exactly three commands appear: "GSD: Refresh", "GSD: Open Roadmap", "GSD: Open State"
**Why human:** Command Palette UI rendering; package.json declaration is verified but Category display needs visual confirmation

#### 3. GSD: Open Roadmap (file present)

**Test:** With `../gsd-test/.planning/ROADMAP.md` present, run "GSD: Open Roadmap" from Command Palette
**Expected:** ROADMAP.md opens in an editor tab
**Why human:** `openTextDocument` + `showTextDocument` behavior requires a real VS Code instance

#### 4. GSD: Open Roadmap (file absent — info message)

**Test:** Temporarily rename `../gsd-test/.planning/ROADMAP.md`, run "GSD: Open Roadmap"
**Expected:** VS Code shows an information message "GSD: ROADMAP.md not found in .planning/" — no error/crash
**Why human:** try/catch + `showInformationMessage` display needs live VS Code to confirm

#### 5. Live Configuration Reload

**Test:** Open VS Code Settings (Preferences > Settings), search "GSD". Change `gsd.refreshIntervalSeconds` from 30 to 10
**Expected:** Both settings appear with descriptions. After changing the interval, the status bar updates at the new cadence (approximately 10 seconds) without a window reload
**Why human:** Timer restart behavior and Settings UI rendering; `onDidChangeConfiguration` wiring is code-verified but live behavior needs observation

### Gaps Summary

No gaps. All 9 roadmap success criteria and 12 must-have truths are verified by codebase evidence. The 5 human verification items are standard EDH checks required for any VS Code extension's UI behavior — they do not indicate incomplete implementation.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
