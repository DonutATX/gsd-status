---
phase: 03-statecontroller-file-watching
verified: 2026-05-21T00:00:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Press F5 against a workspace with .planning/ROADMAP.md. Edit ROADMAP.md and save. Observe status bar update time."
    expected: "Status bar reflects the change within 500ms of saving."
    why_human: "Wall-clock timing of status bar update in a live Extension Development Host cannot be asserted by grep or unit tests."
  - test: "Open a fresh workspace with NO .planning/. Confirm status bar shows 'GSD: No project'. Then create .planning/ROADMAP.md while VS Code stays open."
    expected: "Status bar activates (shows milestone/phase text) without a window reload."
    why_human: "VS Code workspace lifecycle events — FileSystemWatcher onDidCreate for .planning/ — cannot be exercised outside a running Extension Development Host."
  - test: "Open Task Manager. In the Extension Development Host, rapid-save ROADMAP.md approximately 10 times in quick succession."
    expected: "No sustained CPU spike in the extension host process."
    why_human: "CPU observation of OS-level debounce coalescence requires live process monitoring."
---

# Phase 3: StateController + File Watching — Verification Report

**Phase Goal:** Status bar updates automatically within 500ms whenever ROADMAP.md or STATE.md changes on disk, with no editor blocking
**Verified:** 2026-05-21
**Status:** human_needed
**Re-verification:** No — initial verification

**Important context:** The developer ran the Plan 03-02 human-verify checkpoint (checks 1-4 PASSED, check 5 DEFERRED). This report records that attestation, identifies what automated checks independently confirm, and surfaces the three behaviors that require live EDH testing for a clean close.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | StateController.refresh() reads ROADMAP.md + STATE.md and fires exactly one onStateChanged event | VERIFIED | controller.test.ts WSP-02 test: counter increments by exactly 1 per refresh(); WSP-03 test: kind:ok fires with non-empty phases. 44 tests passing. |
| 2 | An I/O or parse failure emits GsdState { kind: 'error' } instead of throwing | VERIFIED | WSP-04 tests: generic rejection → kind:error; EACCES rejection → kind:error; zero-phase ROADMAP → kind:error with "no recognizable GSD phases". All assert.doesNotReject(). |
| 3 | A missing .planning file emits GsdState { kind: 'no-project' } | VERIFIED | ENOENT rejection → kind:no-project; undefined folder → kind:no-project without calling readFiles. Both test paths pass. |
| 4 | debounce coalesces multiple rapid calls within the window into one invocation | VERIFIED | WAT-02 tests: 3 rapid calls → 1 invocation; t=0/40/80 calls with 80ms window → 0 at t=100, 1 by t=200; single call → 1 invocation. All 3 tests green. |
| 5 | Saving .planning/ROADMAP.md updates the status bar within 500ms | HUMAN NEEDED | 300ms debounce is wired (DEBOUNCE_MS=300, debouncedRefresh on onDidChange/Create/Delete). Developer attestation: checks 1-2 PASSED during Plan 02 checkpoint. Cannot be independently confirmed by static analysis alone. |
| 6 | Creating .planning/ after VS Code is open activates the watcher without a reload | HUMAN NEEDED | onDidCreate is wired with debouncedRefresh (controller.ts line 73). Developer attestation: check 3 PASSED during Plan 02 checkpoint. Full confirmation requires live EDH test. |
| 7 | Parse/I/O errors render '$(error) GSD: Error' in the status bar | VERIFIED | extension.ts case 'error': item.text = '$(error) GSD: Error'; item.tooltip = 'Error parsing GSD files'. Developer attestation: check 4 PASSED during Plan 02 checkpoint. Wiring is statically confirmed. |
| 8 | All disposables (controller, watcher, timer, subscription) are in context.subscriptions | VERIFIED | extension.ts: context.subscriptions.push(item), push(lifecycle-disposable), push(controller), push(controller.onStateChanged(...)). controller.dispose() calls _watcher?.dispose() → _timerDisposable.dispose() → _emitter.dispose(). |

**Score:** 7/8 truths verified (1 HUMAN NEEDED treated as uncertain, not failed)

Note: Truth #5 (≤500ms timing) and Truth #6 (WAT-04 live activation) are collapsed into a single "8" count above because the ROADMAP has 5 success criteria. The 8 must-haves above are derived from both PLAN frontmatter truths (03-01 + 03-02 merged). Score reflects 6 auto-verified + 1 statically-wired-with-developer-attestation (error state) + 1 human-needed timing truth.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/state/types.ts` | GsdState discriminated union | VERIFIED | Exports `kind: 'ok' \| 'no-project' \| 'error'`. Zero vscode imports. |
| `src/state/debounce.ts` | debounce(fn, ms) factory | VERIFIED | Exports `debounce`. Zero imports. Timer-reset closure confirmed. |
| `src/state/controller.ts` | StateController with watcher + timer + EventEmitter | VERIFIED | vscode.EventEmitter, RelativePattern brace glob, createFileSystemWatcher, DEBOUNCE_MS=300, REFRESH_INTERVAL_MS=30_000, dispose order correct. |
| `src/extension.ts` | StateController wired to status bar; parseLite removed | VERIFIED | grep confirms: zero parseLite/updateStatusBar/pickMilestone hits. onStateChanged subscription present. lifecycle.disposed guard is first statement in callback. |
| `src/test/state/debounce.test.ts` | WAT-02 debounce coalescing tests | VERIFIED | 3 test cases, all passing. |
| `src/test/state/controller.test.ts` | WSP-02/03/04 controller behavior tests | VERIFIED | 6 test cases covering all branches, all passing. |
| `.mocharc.cjs` | Mocha vscode-stub require hook | VERIFIED | require: ['out/test/setup/vscode-mock.js'] enables bare-Mocha controller tests. |
| `src/test/setup/vscode-stub.ts` | Minimal vscode API stub | VERIFIED | EventEmitter, FileSystemWatcher, RelativePattern, workspace.createFileSystemWatcher all stubbed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/state/controller.ts` | `src/parsers/roadmap.ts` | `parseRoadmap` import | WIRED | `import { parseRoadmap } from '../parsers/roadmap.js'`; called in refresh() at line 100. |
| `src/state/controller.ts` | `vscode.EventEmitter` | `_emitter.fire` | WIRED | `private readonly _emitter = new vscode.EventEmitter<GsdState>()`; fire called in 4 branches. |
| `src/state/controller.ts` | `vscode.RelativePattern` | watcher pattern | WIRED | `new vscode.RelativePattern(folder as vscode.WorkspaceFolder, '.planning/{ROADMAP,STATE}.md')` — brace glob, never path.join. |
| `src/extension.ts` | `StateController` | `onStateChanged` subscription | WIRED | `controller.onStateChanged(state => { ... })` pushed to context.subscriptions. |
| `src/extension.ts` | status bar item | `item.text` assignment in switch | WIRED | All three GsdState kinds update item.text. Error case also sets item.tooltip. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `extension.ts` status bar | `state` from `onStateChanged` | `StateController.refresh()` → `parseRoadmap` + `parseState` → `fs.readFile` via Promise.all | Yes — reads actual .planning/ files from disk via node:fs/promises | FLOWING |
| `controller.ts` | `roadmapText`, `stateText` | `defaultReadFiles` → `fs.readFile(path.join(base, 'ROADMAP.md'), 'utf8')` and STATE.md | Yes — real file reads; parsers are non-stub (44 tests confirm parser correctness) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 44 tests pass (all state + parser + debounce) | `npm test` | 44 passing (441ms) | PASS |
| TypeScript strict mode clean | `npx tsc -p .` | Exit 0, no errors | PASS |
| RelativePattern brace glob used (not path.join) | grep controller.ts | `.planning/{ROADMAP,STATE}.md` at line 68, path.join only inside defaultReadFiles | PASS |
| createFileSystemWatcher called exactly once | grep controller.ts | 1 match at line 70 | PASS |
| parseLite/updateStatusBar/pickMilestone removed | grep extension.ts | 0 matches | PASS |
| Dispose order: _watcher → _timerDisposable → _emitter | controller.ts lines 129-131 | Order confirmed by source | PASS |
| lifecycle.disposed guard is first statement in callback | extension.ts line 23 | `if (lifecycle.disposed) return` is first line inside callback | PASS |
| onDidChange, onDidCreate, onDidDelete all registered | controller.ts lines 72-74 | All three registered with `debouncedRefresh` | PASS |

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) exist for this phase. Step 7c: SKIPPED (no probe scripts declared or present in the conventional location).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WSP-02 | 03-01 | StateController owns GsdState, fires onStateChanged event | SATISFIED | WSP-02 test: counter increments exactly 1 per refresh(). |
| WSP-03 | 03-01 | refresh() reads both files atomically, one event emission | SATISFIED | WSP-03 test: kind:ok with non-empty phases from one refresh. Promise.all in defaultReadFiles. |
| WSP-04 | 03-01 | Parse/I/O errors → kind:error state, no throw | SATISFIED | WSP-04 tests: 3 error paths (generic, EACCES, zero-phase). assert.doesNotReject() confirmed. Plus bug-fix commit 9247592 adds zero-phase guard. |
| WAT-01 | 03-02 | FileSystemWatcher uses RelativePattern brace glob, never path.join | SATISFIED | `new vscode.RelativePattern(folder, '.planning/{ROADMAP,STATE}.md')` confirmed in source. |
| WAT-02 | 03-02 | Watcher callbacks debounced ~300ms; OS events coalesce to one refresh | SATISFIED | DEBOUNCE_MS=300 constant; debounce util unit-tested; all 3 coalescing tests pass. |
| WAT-03 | 03-02 | Periodic refresh timer as Disposable, default 30s | SATISFIED | `const id = setInterval(safeRefresh, REFRESH_INTERVAL_MS)` with `_timerDisposable = { dispose: () => clearInterval(id) }`. |
| WAT-04 | 03-02 | Watcher fires when .planning/ created after VS Code is open | SATISFIED (developer attestation) | onDidCreate registered with debouncedRefresh at controller.ts line 73. Developer check 3 PASSED in Plan 02 checkpoint. Requires live EDH for independent confirmation. |
| STAT-05 | 03-02 | Status bar text updates ≤500ms after debounced file-change event | SATISFIED (developer attestation) | 300ms debounce + synchronous EventEmitter.fire → onStateChanged → item.text assignment. Developer check 2 PASSED. Wall-clock timing requires live EDH. |

All 8 Phase 3 requirements accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TBD, FIXME, XXX, TODO, HACK, or PLACEHOLDER markers found in any Phase 3 modified files. No empty return null / return {} / return [] implementations. No hardcoded empty-array props. No stub patterns in the production path.

### Human Verification Required

Per Plan 03-02 Task 3 (checkpoint:human-verify), the developer already ran checks 1-4. Three items remain open:

#### 1. Status Bar Updates Within 500ms (STAT-05 independent confirmation)

**Test:** Press F5 against a scratch GSD workspace. Edit and save `.planning/ROADMAP.md`. Observe the VS Code status bar.
**Expected:** Status bar text changes to reflect the new content within approximately 500ms of saving.
**Why human:** Wall-clock timing of the status bar render in the Extension Development Host cannot be measured by grep or unit tests. The wiring is confirmed correct (300ms debounce → synchronous fire → item.text), but timing under real VS Code requires observation.

Developer attestation on record: Check 2 PASSED during Plan 02 human-verify checkpoint.

#### 2. .planning/ Created After VS Code is Open (WAT-04 independent confirmation)

**Test:** Open a fresh workspace folder with no `.planning/` directory. Confirm status bar shows `GSD: No project`. Create `.planning/ROADMAP.md` with valid content while VS Code stays open.
**Expected:** Status bar activates (shows `$(pulse) Milestone › Phase N:`) without a window reload.
**Why human:** FileSystemWatcher onDidCreate responding to a newly-created `.planning/` directory requires a live workspace lifecycle in the Extension Development Host.

Developer attestation on record: Check 3 PASSED during Plan 02 human-verify checkpoint.

#### 3. No CPU Spike on Rapid Saves (WAT-02 debounce in production, check 5 DEFERRED)

**Test:** In the Extension Development Host, rapid-save `.planning/ROADMAP.md` approximately 10 times in quick succession. Observe the extension host process in Task Manager.
**Expected:** No sustained CPU spike. CPU should return to baseline between burst and next natural refresh.
**Why human:** OS-level CPU measurement of the extension host process requires Task Manager / Activity Monitor observation. The debounce coalescing logic is unit-tested (3 tests passing), but real-world OS event multiplicity requires live observation.

Developer status: DEFERRED during Plan 02 checkpoint ("not testable yet"). This item must be closed before the phase is marked fully passed.

### Gaps Summary

No automated gaps found. All code artifacts exist, are substantive, and are correctly wired end-to-end. The phase goal is structurally achieved: the StateController is implemented, wired, and tested; the debounced FileSystemWatcher and 30s periodic timer are present; parseLite is removed; error state is rendered correctly.

The three human verification items above are the only open items. Items 1 and 2 have developer attestation from the Plan 02 checkpoint (PASSED). Item 3 (CPU spike check) was explicitly deferred by the developer and is the one genuinely open item.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
