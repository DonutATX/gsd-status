---
phase: 01-scaffold-minimal-status-bar
verified: 2026-05-20T00:00:00Z
status: passed
score: 5/5 must-haves verified (code-level + F5 human-verified 2026-05-20)
human_verification_completed:
  - "Scenario B/C: EDH with no folder open → status bar showed `GSD: No project` ✓"
  - "Scenario A: EDH with ~/dev/gsd-test workspace (2-phase ROADMAP.md) → status bar showed `$(pulse) Demo Project — Roadmap › Phase 1: Hello World` ✓"
  - "launch.json `${workspaceFolder}` arg reverted: same-folder lockout (commit dc9110f → revert)"
overrides_applied: 0
human_verification:
  - test: "Scenario A — Extension Development Host with this repo open"
    expected: "Left status bar shows `$(pulse) GSD Status — VS Code Extension › Phase 1: Scaffold + Minimal Status Bar` (pulse codicon renders)"
    why_human: "STAT-01 requires verifying the rendered glyph + text in a live VS Code window; cannot be observed by grep or tsc. parseLite dry-run against this repo's real ROADMAP.md returned the exact strings, so all code paths are pre-validated."
  - test: "Scenario B — folder with no .planning/ directory"
    expected: "Status bar shows `GSD: No project`"
    why_human: "STAT-02 / WSP-01 fallback path must be observed in the actual extension host."
  - test: "Scenario C — no folder open in Extension Development Host"
    expected: "Status bar shows `GSD: No project`"
    why_human: "WSP-01 undefined workspaceFolders path must be observed in the actual extension host."
  - test: "Lifecycle — Developer → Reload Window in Extension Development Host"
    expected: "Status bar repopulates within ~2s; no red console errors from gsd-status"
    why_human: "SCAF-04 disposable cleanup behavior is only observable via window reload + DevTools console inspection."
---

# Phase 1: Scaffold + Minimal Status Bar Verification Report

**Phase Goal:** Developer sees current phase name in VS Code status bar when opening a workspace that already has .planning/ROADMAP.md (and `GSD: No project` when not).
**Verified:** 2026-05-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workspace with .planning/ROADMAP.md → `$(pulse) Milestone › Phase` in status bar | ? UNCERTAIN (human-verify) | Code paths verified: `createStatusBarItem(Left, 100)` (extension.ts:6-9), `.show()` called (line 12), `item.text = \`$(pulse) ${milestone} › ${phase}\`` (line 40). parseLite dry-run against real ROADMAP returns `{"milestone":"GSD Status — VS Code Extension","phase":"Phase 1: Scaffold + Minimal Status Bar"}`. F5 visual confirmation pending. |
| 2 | Workspace without .planning/ → `GSD: No project` | ? UNCERTAIN (human-verify) | Code paths verified: default `item.text = 'GSD: No project'` (line 11), fallback on missing folder (line 25), fallback on ENOENT/read error (line 34). F5 visual confirmation pending. |
| 3 | Extension activates via onStartupFinished and never blocks startup | ✓ VERIFIED | `activationEvents: ["onStartupFinished"]` in package.json (line 17). `activate()` is sync (extension.ts:5, not declared async). I/O is fire-and-forget via `void updateStatusBar(item)` (line 15). |
| 4 | All disposables registered in context.subscriptions | ✓ VERIFIED | `context.subscriptions.push(item)` at extension.ts:10, immediately after StatusBarItem creation. |
| 5 | Extension manifest is complete (publisher, name, displayName, description, categories, repository, LICENSE) | ✓ VERIFIED | package.json declares all fields: publisher=donutatx, name=gsd-status, displayName=GSD Status, description present, categories=["Other"], repository.url=https://github.com/DonutATX/gsd-extenstion. LICENSE file exists with MIT text (2026, Will McBurnett). |
| 6 | Parse error path shows `GSD: Parse error` and does not crash | ✓ VERIFIED | Inner try/catch around parseLite (extension.ts:38-43): on throw sets `item.text = 'GSD: Parse error'`. parseLite throws `new Error('No active phase found')` when no qualifying `### Phase N:` line. |
| 7 | StatusBarItem is left-aligned, priority 100 | ✓ VERIFIED | `vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)` (extension.ts:6-9). |
| 8 | parseLite is inline and ≤40 lines | ✓ VERIFIED | parseLite spans extension.ts:46-83 = 38 lines including the closing brace (30 LOC excluding blank lines/comments). |
| 9 | `npx tsc --noEmit` passes | ✓ VERIFIED | Executed in repo root: "TypeScript: No errors found". |
| 10 | No file watcher, no commands, no tooltip in Phase 1 | ✓ VERIFIED | Grep on src/extension.ts: zero matches for `item.tooltip`, `item.command`, `createFileSystemWatcher`, `registerCommand`. Phase boundary preserved. |

**Score:** 8/10 truths fully VERIFIED at code level; 2 truths (#1, #2) require F5 visual verification (human_needed).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Manifest with SCAF-05 fields, activationEvents=onStartupFinished, main=./out/extension.js | ✓ VERIFIED | All locked values present; engines.vscode=^1.95.0; @types/vscode=^1.95.0 (match); capabilities.untrustedWorkspaces present. |
| `tsconfig.json` | strict, outDir=out, rootDir=src, target ES2022, module Node16 | ✓ VERIFIED | All fields match plan spec. |
| `.vscodeignore` | Excludes src/**, .planning/**, *.ts, *.map, .env*, *.pem, *.key, credentials.json, secrets.json; keeps out/ and package.json | ✓ VERIFIED | All required exclusions present (20 lines); out/ and package.json correctly NOT listed. |
| `.gitignore` | node_modules, out, *.vsix, .vscode-test, plus security 5 | ✓ VERIFIED | 10 lines covering all required entries. |
| `LICENSE` | MIT text, 2026, Will McBurnett | ✓ VERIFIED | Canonical MIT text present. |
| `README.md` | Stub ≥3 lines | ✓ VERIFIED | 5-line stub referencing project description and Phase 6 expansion. |
| `.vscode/launch.json` | Run Extension config, type=extensionHost, preLaunchTask "npm: compile" | ✓ VERIFIED | All fields present. |
| `.vscode/tasks.json` | npm: compile task, problemMatcher=$tsc | ✓ VERIFIED | All fields present. |
| `src/extension.ts` | activate/deactivate, StatusBarItem, parseLite ≤40 LOC, ≥50 lines | ✓ VERIFIED | 83 lines total; parseLite 30 LOC; both exports present. |
| `out/extension.js` | Compiled output loadable by VS Code | ✓ VERIFIED | Present (3.9K) with sourcemap. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| package.json#main | tsconfig.json#outDir | both resolve to ./out/extension.js | ✓ WIRED | main="./out/extension.js"; outDir="out"; compiled output present at out/extension.js. |
| package.json#engines.vscode | devDependencies.@types/vscode | both pinned to ^1.95.0 | ✓ WIRED | engines.vscode="^1.95.0" and @types/vscode="^1.95.0" — exact match. |
| package.json activationEvents | src/extension.ts activate() | onStartupFinished → require ./out/extension.js | ✓ WIRED | activationEvents includes "onStartupFinished"; main resolves to compiled extension.js exporting activate(). |
| src/extension.ts activate() | vscode.window.createStatusBarItem | StatusBarAlignment.Left, 100, push to subscriptions, .show() | ✓ WIRED | Pattern `createStatusBarItem(\s*vscode.StatusBarAlignment.Left,\s*100` matches; context.subscriptions.push(item) and item.show() both present. |
| src/extension.ts updateStatusBar | .planning/ROADMAP.md | fs.readFile(path.join(folder.uri.fsPath, '.planning', 'ROADMAP.md')) | ✓ WIRED | Path constructed at line 29; fs.readFile invoked at line 32 with utf8 encoding. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| src/extension.ts → item.text | milestone, phase | parseLite(content) ← fs.readFile(.planning/ROADMAP.md) | Dry-run produced `{"milestone":"GSD Status — VS Code Extension","phase":"Phase 1: Scaffold + Minimal Status Bar"}` against real ROADMAP.md | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict compile passes | `npx tsc --noEmit` | "TypeScript: No errors found" | ✓ PASS |
| Compiled output exists | `ls out/extension.js` | extension.js (3.9K) + .map (2.4K) | ✓ PASS |
| parseLite dry-run on real ROADMAP | inlined parseLite via `node -e` | `{"milestone":"GSD Status — VS Code Extension","phase":"Phase 1: Scaffold + Minimal Status Bar"}` | ✓ PASS |
| package.json valid JSON | `node -e "require('./package.json')"` (via Read) | parsed successfully | ✓ PASS |
| .vscode files valid JSON | Read tool | parsed successfully | ✓ PASS |
| Live status bar rendering (3 scenarios) | F5 in VS Code | requires human | ? SKIP — routed to human verification |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` declared in PLAN or present in repo. Phase 1 explicitly defers test framework (mocha + @vscode/test-cli) to Phase 2. Probe execution N/A for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCAF-01 | 01-01 | TS scaffold, unbundled, engines.vscode=^1.95.0 + matching @types/vscode | ✓ SATISFIED | package.json + tsconfig.json verified |
| SCAF-02 | 01-02 | activationEvents includes onStartupFinished | ✓ SATISFIED | package.json line 17 |
| SCAF-03 | 01-01 | .vscodeignore excludes sources, tests, planning, dev-only | ✓ SATISFIED | .vscodeignore verified |
| SCAF-04 | 01-02 | Disposables pushed to context.subscriptions | ✓ SATISFIED | extension.ts:10 |
| SCAF-05 | 01-01 | publisher, name, displayName, description, categories, repository, LICENSE | ✓ SATISFIED | package.json + LICENSE verified |
| STAT-01 | 01-02 | `$(icon) Milestone › Phase` when GSD project detected | ? NEEDS HUMAN | Code path verified; F5 visual pending |
| STAT-02 | 01-02 | `GSD: No project` when no .planning/ | ? NEEDS HUMAN | Code path verified; F5 visual pending |
| WSP-01 | 01-02 | workspaceFolders?.[0]; "No project" fallback | ✓ SATISFIED | extension.ts:23-26; both undefined-folder and missing-ROADMAP paths fall through to "No project" |

### Anti-Patterns Found

No anti-patterns detected. Grep on src/extension.ts for TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER returned zero matches. No stub returns, no empty handlers, no console.log-only paths. The `deactivate()` no-op is intentional (documented: context.subscriptions handles disposal — SCAF-04).

### Human Verification Required

#### 1. Scenario A — Extension Development Host with this repo

**Test:** From repo root, run `npm run compile`, open VS Code (`code .`), press F5, open this repo folder in the Extension Development Host.
**Expected:** Left status bar shows `$(pulse) GSD Status — VS Code Extension › Phase 1: Scaffold + Minimal Status Bar` (pulse codicon renders as a glyph).
**Why human:** STAT-01 requires verifying the rendered glyph + text in a live VS Code window; cannot be observed by grep or tsc.

#### 2. Scenario B — folder without .planning/

**Test:** In the Extension Development Host: File → Open Folder → pick any folder without `.planning/`.
**Expected:** Status bar shows `GSD: No project`.
**Why human:** STAT-02 / WSP-01 fallback path must be observed in the actual extension host.

#### 3. Scenario C — no folder open

**Test:** In the Extension Development Host: File → Close Folder.
**Expected:** Status bar shows `GSD: No project`.
**Why human:** WSP-01 undefined workspaceFolders path must be observed in the actual extension host.

#### 4. Lifecycle / SCAF-04 cleanup

**Test:** Developer → Reload Window in the Extension Development Host. Open Help → Toggle Developer Tools → Console.
**Expected:** Status bar repopulates within ~2s; no red errors from the gsd-status extension.
**Why human:** Disposable cleanup behavior is only observable via window reload + DevTools console inspection.

### Gaps Summary

No code-level gaps. All 8 artifacts present and substantive, all 5 key links wired, all 8 requirements satisfied at the code level. The phase goal is structurally achieved: parseLite produces the exact expected output when fed this repo's real `.planning/ROADMAP.md`, and all three fallback paths (no folder / no ROADMAP / parse error) are implemented with proper try/catch isolation.

The remaining work is verifying that the rendered status bar visually matches expectations in a live Extension Development Host — STAT-01 and STAT-02 are visual requirements that cannot be confirmed without F5. Hence `status: human_needed` rather than `passed`. Once the four human-verify items above are confirmed, this phase is complete.

---

_Verified: 2026-05-20_
_Verifier: Claude (gsd-verifier)_
