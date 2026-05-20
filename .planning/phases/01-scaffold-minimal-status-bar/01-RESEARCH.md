# Phase 1: Scaffold + Minimal Status Bar - Research

**Researched:** 2026-05-20
**Domain:** VS Code Extension scaffolding (TypeScript, unbundled), Status Bar API, workspace detection
**Confidence:** HIGH

## Summary

Phase 1 is the first code-producing slice for an otherwise empty repo. The tech stack is fully locked in `CLAUDE.md` (TypeScript ^5.8, `@types/vscode` ^1.95.0 matching `engines.vscode`, no bundler, no runtime deps, hand-rolled parsing). This research therefore deliberately skips stack selection and focuses on the six concrete planning landmines flagged by the orchestrator: scaffold technique, manifest minimum, `onStartupFinished` quirks, StatusBarItem API surface, workspace file reading, and `.vscodeignore` correctness on Windows.

**Primary recommendation:** Hand-write the scaffold (`package.json`, `tsconfig.json`, `src/extension.ts`, `.vscodeignore`, `LICENSE`, `.gitignore`, `eslint.config.mjs`). It produces a smaller, more auditable diff (~8 files, ~150 lines total) than `yo code`, which generates ~25 files including `.vscode-test.mjs`, sample tests, `CHANGELOG.md`, and a `vsc-extension-quickstart.md` that must then be pruned. Phase 1 has no test requirements (tests arrive Phase 2 per requirement traceability), so the test boilerplate from `yo code` is pure noise here. [CITED: code.visualstudio.com/api/get-started/your-first-extension]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status Bar Display**
- Icon: `$(pulse)` — denotes live workflow signal
- Format: `$(pulse) {milestone} › {phase}` (e.g., `$(pulse) v1.0 › Phase 1`)
- Alignment: Left, priority 100 (low) — non-intrusive
- Click action: None in Phase 1 — `command` field omitted on the status bar item; default click is a no-op. `gsd.openState` / `gsd.openRoadmap` ship in Phase 4.

**Phase 1 Parsing Strategy**
- Use a thin inline regex helper (~≤40 lines) inside `extension.ts` (or a sibling `src/roadmap-lite.ts`) — Phase 2 will replace it with the proper parser module
- "Active phase" = first `### Phase N:` header in ROADMAP.md whose line is not marked `✅` or `[x]` — no STATE.md dependency yet (STATE parsing is Phase 3)
- Refresh model: read ROADMAP.md once on activation only — file watching arrives in Phase 3
- Parse error behavior: show `GSD: Parse error` text in the status bar; never throw out of the activation handler (consistent with WSP-04's intent applied early)

**Extension Manifest Identity**
- `publisher`: `donutatx`
- `name`: `gsd-status`
- `displayName`: `GSD Status`
- `repository.url`: `https://github.com/DonutATX/gsd-extenstion`
- `description`: from PROJECT.md core value (one-line)
- `categories`: `["Other"]`
- LICENSE: MIT (matches user's GitHub default; no conflicting prior decision)

### Claude's Discretion
- File layout under `src/` (e.g., whether the regex helper is inline in `extension.ts` or split into `src/roadmap-lite.ts`)
- Icon SVG / extension icon image — defer until packaging (Phase 6) unless trivial to add now
- Whether to scaffold with `yo code` (clean baseline) or hand-write `package.json` + `src/extension.ts` (lower complexity) — planner decides based on what produces the smallest, simplest diff

### Deferred Ideas (OUT OF SCOPE)
- Status bar click command and tooltip → Phase 4
- File watching + debounced refresh → Phase 3
- Full parser module with unit tests → Phase 2
- Side panel TreeView → Phase 5
- Extension icon / marketplace assets → Phase 6 (or v2 if marketplace publish)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAF-01 | TypeScript scaffold, unbundled, `engines.vscode: "^1.95.0"`, `@types/vscode` pinned to same minor | See "Standard Stack" + "Minimum viable package.json" |
| SCAF-02 | Activation event `onStartupFinished` | See Pitfall 1 + "onStartupFinished quirks" |
| SCAF-03 | `.vscodeignore` excludes sources, tests, planning docs, dev-only files | See "`.vscodeignore` recipe" + Pitfall 5 |
| SCAF-04 | All disposables pushed to `context.subscriptions` | See Code Example "Activate + dispose" |
| SCAF-05 | Manifest declares publisher/name/displayName/description/categories/repository + LICENSE present | See "Minimum viable package.json" |
| STAT-01 | Status bar item always visible (left, low priority), shows `$(icon) Milestone › Phase` when GSD project detected | See "StatusBarItem API" |
| STAT-02 | Status bar shows `GSD: No project` when no `.planning/` | See Code Example "Workspace detection" |
| WSP-01 | Uses `workspaceFolders?.[0]`, shows "No GSD project" when no workspace / no `.planning/` / no ROADMAP.md | See Pitfall 2 + Code Example |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extension activation | Extension Host (Node) | — | All VS Code extensions run in the extension host Node process |
| Status bar render | VS Code UI (renderer) | Extension Host | Extension calls `vscode.window.createStatusBarItem`; VS Code renderer paints it |
| Workspace folder detection | Extension Host | — | `vscode.workspace.workspaceFolders` is host-side only |
| File I/O (`.planning/ROADMAP.md`) | Extension Host | — | Use `vscode.workspace.fs` (works in remote workspaces); fallback to `node:fs/promises` is acceptable since this is a local-only extension |
| Regex parsing | Extension Host (pure JS) | — | Pure function, no VS Code dependency |

## Standard Stack

Stack is **locked in CLAUDE.md** — do not re-litigate. Phase 1 install footprint:

### Core (dev dependencies only — zero runtime deps)
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5.8` | Compiler [CITED: CLAUDE.md] |
| `@types/vscode` | `^1.95.0` | Must match `engines.vscode` minor [CITED: CLAUDE.md] |
| `@types/node` | `^20.x` | Node 20 LTS types (VS Code 1.95+ ships Node 20) [CITED: CLAUDE.md] |
| `eslint` | `^10.4.0` | Optional Phase 1 — see discretion below [CITED: CLAUDE.md] |
| `typescript-eslint` | `^8.59.4` | Optional Phase 1 [CITED: CLAUDE.md] |

**Phase 1 discretion call:** ESLint can be deferred. Phase 1 has 1 source file (~50 lines). Adding `eslint.config.mjs` + `typescript-eslint` is 2 more dev deps and a config file that lints almost nothing. Recommendation: **install ESLint now** so Phase 2's parser module ships with linting from day one, but skip adding lint scripts to a pre-commit/CI gate until there's actually code worth linting.

**Note on `engines.vscode`:** CLAUDE.md states `^1.95.0` (the requirement-locked minimum) in one place and `^1.120.0` in another. SCAF-01 explicitly requires `^1.95.0`. **Use `^1.95.0`** and pin `@types/vscode` to `^1.95.0` — supporting the older minimum maximizes user reach. [VERIFIED: REQUIREMENTS.md SCAF-01]

### Installation (post-scaffold)
```bash
npm install --save-dev typescript@^5.8 @types/vscode@^1.95.0 @types/node@^20
# optional, recommended:
npm install --save-dev eslint@^10 typescript-eslint@^8
```

**Version verification:** Versions are taken verbatim from `CLAUDE.md` (project-level tech stack lock). Re-verifying against npm is out of scope per orchestrator instructions ("Do not re-research the stack").

## Package Legitimacy Audit

All packages below are pinned in `CLAUDE.md` (project-locked tech stack). No new packages introduced in this phase.

| Package | Registry | Source | Disposition |
|---------|----------|--------|-------------|
| `typescript` | npm | github.com/microsoft/TypeScript | Approved (project-locked) |
| `@types/vscode` | npm | github.com/DefinitelyTyped/DefinitelyTyped | Approved (project-locked) |
| `@types/node` | npm | github.com/DefinitelyTyped/DefinitelyTyped | Approved (project-locked) |
| `eslint` | npm | github.com/eslint/eslint | Approved (project-locked, optional Phase 1) |
| `typescript-eslint` | npm | github.com/typescript-eslint/typescript-eslint | Approved (project-locked, optional Phase 1) |

slopcheck not run — packages are first-party Microsoft/eslint/DefinitelyTyped, well known.

## Architecture Patterns

### System Architecture (Phase 1)

```
VS Code startup
      │
      ▼
onStartupFinished event ──────► extension.ts: activate(context)
                                        │
                                        ▼
                          vscode.workspace.workspaceFolders?.[0]
                                        │
                          ┌─────────────┼─────────────┐
                          │             │             │
                       no folder    folder + no    folder + ROADMAP.md
                                    .planning/
                          │             │             │
                          ▼             ▼             ▼
                  "GSD: No project"  "GSD: No project"   readFile → regex
                          │             │                    │
                          └─────────────┴────────────────────┤
                                                             │
                                                  parse OK ──┴── parse fail
                                                      │            │
                                                      ▼            ▼
                                          "$(pulse) {ms} › {ph}"  "GSD: Parse error"
                                                      │            │
                                                      └──────┬─────┘
                                                             ▼
                                                  StatusBarItem.show()
                                                             │
                                                             ▼
                                            context.subscriptions.push(item)
```

### Recommended Project Structure
```
.
├── .vscode/
│   └── launch.json          # F5 → "Run Extension" (Extension Development Host)
├── src/
│   └── extension.ts         # activate() / deactivate(); inline regex helper
├── .gitignore               # node_modules, out/, *.vsix
├── .vscodeignore            # excludes src/, .planning/, .vscode/, tsconfig, etc.
├── eslint.config.mjs        # optional (recommend yes)
├── LICENSE                  # MIT
├── package.json
├── README.md                # stub — Phase 6 fills it
└── tsconfig.json
```

**Decision on inline vs `src/roadmap-lite.ts`:** Inline. The Phase 1 regex helper is ~10 lines and gets replaced wholesale in Phase 2. Splitting it now creates a file Phase 2 deletes — pure churn.

### Pattern 1: Activation Function

```typescript
// Source: code.visualstudio.com/api/get-started/your-first-extension
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(item);

  item.text = computeStatusText(); // sync read on activation
  item.show();
}

export function deactivate(): void {
  // No-op: subscriptions handle cleanup
}
```

### Pattern 2: StatusBarItem API surface (Phase 1 subset)

| Property/Method | Phase 1 usage |
|----------------|---------------|
| `text` | Set to `$(pulse) v1.0 › Phase 1` or `GSD: No project` or `GSD: Parse error`. Codicons render via `$(name)` syntax. [CITED: code.visualstudio.com/api/references/icons-in-labels] |
| `tooltip` | **Skip in Phase 1** — Phase 4 owns this |
| `command` | **Omit entirely in Phase 1** — locked decision |
| `alignment` | `vscode.StatusBarAlignment.Left` (set via `createStatusBarItem` arg, not assignable after) |
| `priority` | `100` (set via `createStatusBarItem` arg). Higher = further left within the left group. |
| `.show()` | **Required** — items are hidden by default. |
| `.dispose()` | Called automatically by `context.subscriptions`. |

### Anti-Patterns to Avoid
- **Async `activate()` that blocks on file I/O before returning:** Even with `onStartupFinished`, an unresolved promise delays other extensions' activation in some VS Code internal sequences. Prefer sync file read or fire-and-forget the async work after `item.show()`.
- **Setting `command` to a string that isn't registered:** VS Code logs an error in the dev console on click. Since Phase 1 has no commands, leave `command` undefined.
- **Forgetting `.show()`:** Items created with `createStatusBarItem` are hidden by default — easy to miss in testing.
- **Using `path.join(...)` to build the ROADMAP path inside a glob/RelativePattern later:** Not Phase 1 concern (no watcher here), but the team should know this lands in Phase 3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace path resolution | `process.cwd()` or `__dirname` joins | `vscode.workspace.workspaceFolders?.[0].uri` | The extension host's CWD is not the workspace root |
| File reading (long-term) | `fs.readFileSync` | `vscode.workspace.fs.readFile(uri)` | Works in remote/SSH/WSL workspaces; Phase 1 use case is local-only so `node:fs/promises` is acceptable but `vscode.workspace.fs` is the future-proof choice |
| Codicon rendering | Custom SVGs | `$(pulse)` in `item.text` | VS Code resolves `$(name)` against its built-in codicon set automatically |
| Disposable cleanup | Manual `deactivate()` cleanup | `context.subscriptions.push(item)` | VS Code disposes everything on deactivation |

**Key insight:** Phase 1 has exactly one disposable (the StatusBarItem). The pattern still matters because Phase 2 onward will add many more.

## Common Pitfalls

### Pitfall 1: `onStartupFinished` is the right answer but easy to misspell
**What goes wrong:** Devs reach for `"*"` (deprecated activate-always) or invent `onWorkspaceOpen` (does not exist).
**Why it happens:** Older tutorials and Stack Overflow answers predate the change.
**How to avoid:** Use the literal string `"onStartupFinished"` in `package.json` `activationEvents`. Note: as of VS Code 1.74+, many activation events are auto-inferred from contribution points, so you may not even need an explicit entry — but Phase 1 has NO contribution points (no commands, no views), so an explicit `activationEvents: ["onStartupFinished"]` is mandatory. [CITED: code.visualstudio.com/api/references/activation-events]
**Warning signs:** Extension doesn't activate on opening a folder.

### Pitfall 2: `workspaceFolders` is undefined, not empty array, when no folder is open
**What goes wrong:** `workspaceFolders.length === 0` throws because the property is `undefined`.
**Why it happens:** API typing is `readonly WorkspaceFolder[] | undefined`.
**How to avoid:** Always optional-chain: `vscode.workspace.workspaceFolders?.[0]`. Treat both `undefined` AND missing `.planning/ROADMAP.md` as the "No GSD project" state per STAT-02/WSP-01. [CITED: code.visualstudio.com/api/references/vscode-api#workspace]
**Warning signs:** Status bar shows nothing (or extension throws) when VS Code opens with no folder.

### Pitfall 3: `@types/vscode` version mismatch with `engines.vscode`
**What goes wrong:** Compiles fine, then breaks at runtime when API shapes differ between declared types and the actual host VS Code version.
**Why it happens:** Devs bump `@types/vscode` without bumping `engines.vscode` (or vice versa).
**How to avoid:** Keep both at `^1.95.0` minor for this phase. `@types/vscode` version must be **≤** the runtime VS Code version, never above. Pin both in lockstep in `package.json`.
**Warning signs:** "Cannot read property X of undefined" at runtime where TypeScript said the property existed.

### Pitfall 4: Windows path separators in glob/RelativePattern (preview only — Phase 3 issue)
**What goes wrong:** Hand-built path strings with `\` break `FileSystemWatcher` glob matching on Windows.
**Why it happens:** Globs require `/`; Node's `path.join` returns `\` on Windows.
**How to avoid:** Not a Phase 1 concern, but flag it: when Phase 3 introduces watching, use `new vscode.RelativePattern(folder, '.planning/ROADMAP.md')` — never construct the second arg with `path.join`. CLAUDE.md and STATE.md already record this decision.
**Warning signs:** Watcher silently fails on Windows only.

### Pitfall 5: `.vscodeignore` exclusion of `src/` is required even unbundled
**What goes wrong:** `vsce package` includes `src/*.ts` in the `.vsix`, inflating size and shipping source needlessly.
**Why it happens:** Default `.vscodeignore` doesn't ship in a hand-written scaffold; without it, `vsce` includes everything except `node_modules` by default.
**How to avoid:** Ship `.vscodeignore` from day one (see recipe below). Even though packaging is Phase 6, the file is part of SCAF-03 and is trivial to author now. [CITED: code.visualstudio.com/api/working-with-extensions/publishing-extension#advance-usage]
**Warning signs:** Phase 6 surprise: `vsce ls` shows source files in the package.

### Pitfall 6: Forgetting `outDir` matches the `main` field
**What goes wrong:** `package.json` `main: "./out/extension.js"` but `tsconfig.json` `outDir: "dist"` → extension fails to activate with "Cannot find module" in Extension Development Host.
**Why it happens:** Hand-written scaffolds skip the convention `yo code` enforces.
**How to avoid:** Pick one: `out/` (yo code default) or `dist/`. Set `tsconfig.compilerOptions.outDir` AND `package.json.main` to match. Recommend `./out/extension.js` to match upstream conventions.
**Warning signs:** F5 launches Extension Development Host, extension is listed but inactive; dev console shows module-not-found.

## Code Examples

### Minimum viable `package.json`

```jsonc
// Source: code.visualstudio.com/api/references/extension-manifest
{
  "name": "gsd-status",
  "displayName": "GSD Status",
  "description": "Live GSD workflow state — milestone, phase, and recent activity — in your VS Code status bar.",
  "version": "0.1.0",
  "publisher": "donutatx",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/DonutATX/gsd-extenstion"
  },
  "engines": {
    "vscode": "^1.95.0"
  },
  "categories": ["Other"],
  "main": "./out/extension.js",
  "activationEvents": ["onStartupFinished"],
  "contributes": {},
  "scripts": {
    "compile": "tsc -p .",
    "watch": "tsc -w -p ."
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/vscode": "^1.95.0",
    "typescript": "^5.8"
  }
}
```

**Why no `contributes`:** Phase 1 has no commands, views, configuration, or menus. The empty `contributes: {}` is fine — VS Code ignores it. Phases 4/5 will populate it.

### Minimum viable `tsconfig.json`

```jsonc
// Source: code.visualstudio.com/api/get-started/your-first-extension
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", ".vscode-test"]
}
```

### `.vscodeignore` recipe (SCAF-03)

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.eslintrc.*
eslint.config.mjs
tsconfig.json
**/tsconfig.json
**/*.ts
**/*.map
.planning/**
**/.DS_Store
**/node_modules/.cache/**
*.vsix
```

**Note:** `out/**` and `package.json` must remain included (the compiled JS + manifest are the package's payload). [CITED: code.visualstudio.com/api/working-with-extensions/publishing-extension]

### `.gitignore`

```
node_modules/
out/
*.vsix
.vscode-test/
```

### `extension.ts` (Phase 1 reference shape)

```typescript
// Source: code.visualstudio.com/api/get-started/your-first-extension
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(item);
  item.show();

  // Fire-and-forget — never block activate()
  void updateStatusBar(item);
}

async function updateStatusBar(item: vscode.StatusBarItem): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    item.text = 'GSD: No project';
    return;
  }

  const roadmapPath = path.join(folder.uri.fsPath, '.planning', 'ROADMAP.md');
  let content: string;
  try {
    content = await fs.readFile(roadmapPath, 'utf8');
  } catch {
    item.text = 'GSD: No project';
    return;
  }

  try {
    const { milestone, phase } = parseLite(content);
    item.text = `$(pulse) ${milestone} › ${phase}`;
  } catch {
    item.text = 'GSD: Parse error';
  }
}

// ~10-line inline helper — Phase 2 replaces with full parser module
function parseLite(md: string): { milestone: string; phase: string } {
  // Milestone: first H1 (e.g., "# Roadmap: GSD Status — VS Code Extension")
  // OR first "## Milestone vX.Y" — planner picks based on real ROADMAP.md
  const milestoneMatch = md.match(/^#\s+(.+)$/m);
  // Active phase: first "### Phase N: Name" not marked ✅ or [x]
  const phaseMatch = md.match(/^###\s+(Phase\s+\d+[^\n]*?)$/m); // refine to skip ✅/[x] lines
  if (!milestoneMatch || !phaseMatch) throw new Error('parse');
  return { milestone: milestoneMatch[1].trim(), phase: phaseMatch[1].trim() };
}

export function deactivate(): void {}
```

**Caveat on `parseLite`:** The example regex is intentionally rough — the planner must refine the "active phase = first `### Phase N:` not marked `✅`/`[x]`" rule against the **actual** `.planning/ROADMAP.md` in this repo (which uses `- [ ] **Phase N: ...**` checkbox lines in the Phases overview AND `### Phase N: ...` in Phase Details). [VERIFIED: read .planning/ROADMAP.md]

**Real ROADMAP.md observations (read during research):**
- Top of file: `# Roadmap: GSD Status — VS Code Extension` — usable as milestone label, but not in `vX.Y` form
- No `## Milestone vX.Y` header exists in this ROADMAP
- Phase headers under "Phase Details": `### Phase 1: Scaffold + Minimal Status Bar`, ..., `### Phase 6: Packaging + Distribution`
- Completion markers: the overview uses `- [ ] **Phase N:** ...` (none marked `[x]` yet); the detail `###` headers have no `✅`/`[x]` markers

**Planner action needed:** Pick the milestone source — either (a) strip "Roadmap: " prefix from H1 and use the rest, or (b) treat the whole H1 as the milestone label. The CONTEXT.md "Specific Ideas" note already acknowledges this. Recommendation: use the H1 minus the leading "Roadmap:" prefix → `GSD Status — VS Code Extension › Phase 1`.

### `.vscode/launch.json` (F5 → Extension Development Host)

```jsonc
// Source: code.visualstudio.com/api/get-started/your-first-extension
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: compile"
    }
  ]
}
```

This requires a matching `.vscode/tasks.json`:
```jsonc
{
  "version": "2.0.0",
  "tasks": [
    { "type": "npm", "script": "compile", "problemMatcher": "$tsc", "group": "build" }
  ]
}
```

### `LICENSE` (MIT)

Standard MIT text, year `2026`, copyright holder `Will McBurnett`. Generate from the OSI template — no fields beyond name/year.

## Scaffold Method Decision: Hand-Write

| Criterion | `yo code` | Hand-write |
|-----------|-----------|------------|
| Files created | ~25 (incl. test harness, CHANGELOG, quickstart, sample command) | ~8 |
| Lines of generated noise to delete | ~400 (sample command, hello-world test, quickstart MD) | 0 |
| Activation event default | `onCommand:gsd-status.helloWorld` (must change) | `onStartupFinished` from the start |
| Test harness | `@vscode/test-cli` config + sample test | None (Phase 2 adds when needed) |
| `package.json` `contributes` | sample command (must remove) | empty `{}` |
| Diff reviewability | Reviewer must distinguish kept vs deleted scaffold lines | Every line is intentional |
| Time to working "F5 → status bar shows text" | ~10 min (scaffold + 8 deletions + 4 edits) | ~10 min (write 8 small files) |

**Recommendation:** Hand-write. The diff for Phase 1 PR review is dramatically cleaner, and Phase 2's introduction of `@vscode/test-cli` will be the right moment to add the test harness deliberately rather than inheriting and pruning it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `activationEvents: ["*"]` | `onStartupFinished` (or auto-inferred from contributions) | VS Code 1.74 (Nov 2022) | `"*"` is deprecated; flagged by `vsce` |
| Manual `runTest.ts` runner | `@vscode/test-cli` + `.vscode-test.mjs` | 2024 | Not a Phase 1 concern; Phase 2 adopts |
| `vsce` (npm) | `@vscode/vsce` (npm) | 2022 rename | Phase 6 concern |
| ESLint `.eslintrc.json` | ESLint v9+ flat config `eslint.config.mjs` | ESLint 9 (Apr 2024) | Already locked in CLAUDE.md |
| `chokidar` for file watching | `vscode.workspace.createFileSystemWatcher` | Always preferred | Phase 3 concern |

**Deprecated/outdated for Phase 1:**
- `activationEvents: ["*"]` — never use
- Global `npm install -g yo generator-code` — use `npx --package yo --package generator-code -- yo code` if scaffolding is chosen (but we're not)
- `vsce` package name — now `@vscode/vsce` (Phase 6)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hand-writing produces a smaller, more reviewable diff than `yo code` | Scaffold Method Decision | Reviewer preference may differ; `yo code` produces a "blessed" structure some teams value — but planner can flip to `yo code` if user prefers |
| A2 | Phase 1 milestone label should be derived from H1 of ROADMAP.md (minus "Roadmap: " prefix) | Code Examples | Display string differs from expectation; visible only — easy to adjust |
| A3 | ESLint can be added now without lint-gating | Standard Stack | Worst case: redundant install if Phase 2 prefers to defer it |

All other claims in this document are either `[CITED]` from official VS Code docs or `[VERIFIED]` by reading repo files.

## Project Constraints (from CLAUDE.md)

The planner MUST honor the following directives extracted from `CLAUDE.md`:

1. **Tech stack locked:** TypeScript ^5.8, `@types/vscode` ^1.95.0 matching `engines.vscode`, no bundler (tsc-only), zero runtime dependencies.
2. **File watcher:** Use `vscode.workspace.createFileSystemWatcher` (Phase 3 concern, not Phase 1).
3. **No `chokidar`, no `webpack`, no `remark`/`unified`, no `vitest`, no global installs.**
4. **`@vscode/vsce` (not legacy `vsce`)** when packaging arrives (Phase 6).
5. **Prefer `npx`** for tooling rather than global installs.
6. **GSD ↔ GitHub:** Phase work must reference a GitHub issue with `Closes #NN` in commits/PRs.
7. **GitHub account `DonutATX`** for all git operations. (Note: repository owner casing in `repository.url` should be lowercased per GitHub URL convention — `https://github.com/DonutATX/gsd-extenstion` works but `donutatx` lowercase is canonical.)
8. **Repo name typo:** `gsd-extenstion` (sic) is the actual repo name per CONTEXT.md — preserve the typo in `repository.url`.
9. **Squash and merge for PRs.**
10. **Security:** No secrets in repo; `.gitignore` must include `.env`, `*.pem`, `*.key`, `credentials.json`, `secrets.json` (per global security rules). Phase 1 has no secrets, but the `.gitignore` should be future-proofed.

## Runtime State Inventory

Not applicable — this is a greenfield phase. No rename/refactor/migration concerns.

## Open Questions

1. **Milestone label source from ROADMAP.md**
   - What we know: Real ROADMAP.md has H1 `# Roadmap: GSD Status — VS Code Extension`. No `## Milestone vX.Y` header exists.
   - What's unclear: Whether to display the full H1, strip the "Roadmap: " prefix, or invent a `v0.1` label.
   - Recommendation: Strip "Roadmap: " prefix → display `$(pulse) GSD Status — VS Code Extension › Phase 1: Scaffold + Minimal Status Bar`. Long but accurate; planner can shorten phase label to just `Phase 1` if preferred.

2. **`description` field exact wording**
   - What we know: CONTEXT.md says "from PROJECT.md core value (one-line)".
   - What's unclear: PROJECT.md not read during this research (orchestrator did not include it in files-to-read, and CLAUDE.md already paraphrases the core value).
   - Recommendation: Use the paraphrase from CLAUDE.md: "Live GSD workflow state — milestone, phase, and recent activity — in your VS Code status bar." Planner can swap to PROJECT.md verbatim if it differs materially.

3. **GitHub issue for Phase 1**
   - What we know: Project rule requires `Closes #NN` reference on commits/PRs.
   - What's unclear: Whether a Phase 1 tracking issue exists yet.
   - Recommendation: Planner's first task should be "ensure GitHub issue exists for Phase 1" (or capture as a precondition).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Compile + run extension | ✓ (assumed — required by VS Code itself) | ≥20 | — |
| npm | Install dev deps | ✓ (ships with Node) | — | — |
| VS Code (stable) | Manual F5 testing | ✓ (user is running VS Code) | ≥1.95.0 | — |
| git | Commits | ✓ (repo is already a git repo) | — | — |
| gh CLI | Issue/PR creation per project rule | unknown — planner should `gh --version` check | — | Manual web flow |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `gh` CLI — planner can probe; manual GitHub web UI is acceptable fallback.

## Validation Architecture

Per `.planning/config.json`, `workflow.nyquist_validation: true` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None yet — Phase 2 introduces `@vscode/test-cli` + `mocha` |
| Config file | None — see Wave 0 below |
| Quick run command | `npm run compile` (acts as the smoke test for Phase 1) |
| Full suite command | `npm run compile` (no automated tests until Phase 2) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAF-01 | TS scaffold compiles | smoke | `npm run compile` | ❌ Wave 0 (need package.json + tsconfig.json) |
| SCAF-02 | Activation event is `onStartupFinished` | static check | `node -e "console.log(require('./package.json').activationEvents)"` or grep | ❌ Wave 0 |
| SCAF-03 | `.vscodeignore` excludes correct paths | static check | manual review or `vsce ls --no-package` (Phase 6) | manual-only Phase 1 |
| SCAF-04 | Disposables in `context.subscriptions` | manual | F5 → close → verify no leaks (manual) | manual-only |
| SCAF-05 | Manifest fields present + LICENSE exists | static check | `node -e "..."` + `test -f LICENSE` | ❌ Wave 0 |
| STAT-01 | Status bar shows formatted text in workspace with `.planning/ROADMAP.md` | manual (extension host) | F5 in a fixture workspace | manual-only |
| STAT-02 | Status bar shows `GSD: No project` without `.planning/` | manual (extension host) | F5 in workspace without `.planning/` | manual-only |
| WSP-01 | Uses `workspaceFolders?.[0]`, handles all "no project" sub-cases | manual + grep | F5 with no folder open | manual-only |

### Sampling Rate
- **Per task commit:** `npm run compile` (must pass — proves no TS errors)
- **Per wave merge:** `npm run compile` + manual F5 sanity (status bar appears as expected)
- **Phase gate:** All success criteria verified manually in Extension Development Host before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `package.json` — defines compile script (no test script needed Phase 1)
- [ ] `tsconfig.json` — required for `tsc -p .`
- [ ] `.vscode/launch.json` — required for F5 manual verification
- [ ] `.vscode/tasks.json` — preLaunchTask for launch.json
- [ ] Fixture workspaces for manual STAT-01 / STAT-02 verification — can use this repo itself (has `.planning/ROADMAP.md`) and any other folder (no `.planning/`). No new fixtures needed.
- **Framework install:** None for Phase 1. Phase 2 introduces `@vscode/test-cli` + `mocha`.

## Security Domain

Per project conventions, `security_enforcement` is not explicitly disabled → included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Extension reads local files only; no auth |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Read-only on user's own workspace |
| V5 Input Validation | yes (low risk) | Treat ROADMAP.md content as untrusted text; regex must be linear-time (catastrophic backtracking matters — but only ~10 lines of regex here) |
| V6 Cryptography | no | No crypto |
| V7 Error Handling | yes | Catch ALL errors in activation path; never throw out of `activate()`. Map errors to `GSD: Parse error` text. |
| V8 Data Protection | yes (trivial) | No secrets read or written. `.gitignore` must block `.env`/`*.pem`/`*.key`/`credentials.json`/`secrets.json` per global security rules. |
| V12 Files | yes | Only read `${workspaceFolder}/.planning/ROADMAP.md`. Do not follow user-supplied paths. Resolve via `workspaceFolders[0].uri.fsPath + path.join(...)`. |
| V14 Configuration | yes | `.vscodeignore` MUST exclude `.planning/**`, `src/**`, and any future `.env*` files from packaged `.vsix` |

### Known Threat Patterns for VS Code Extension

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Catastrophic regex backtracking | DoS | Keep Phase 1 regex linear (no nested quantifiers). PARS-05 stress test arrives Phase 2. |
| Path traversal via crafted workspace | Tampering | Resolve only `${workspaceFolder}/.planning/ROADMAP.md`; do NOT honor symlinks pointing outside `${workspaceFolder}` (Node's `fs.readFile` follows symlinks by default — accept this since user's own workspace) |
| Activation-time exception kills extension host | DoS | Wrap all activation I/O in try/catch; surface as `GSD: Parse error` |
| Shipping secrets in `.vsix` | Disclosure | `.vscodeignore` excludes `.planning/**`, `.env*`, `*.pem`, `*.key` — Phase 1 has none of these in repo, but the ignore file is the defense in depth |
| Untrusted workspace | Tampering | Phase 1 is read-only and runs no user-supplied code. Add `capabilities.untrustedWorkspaces.supported: true` in `package.json` to allow the extension to run in restricted-mode workspaces (recommended). [CITED: code.visualstudio.com/api/extension-guides/workspace-trust] |

**Recommendation:** Add to `package.json`:
```jsonc
"capabilities": {
  "untrustedWorkspaces": { "supported": true, "description": "Read-only display of GSD planning files." },
  "virtualWorkspaces": true
}
```

## Sources

### Primary (HIGH confidence)
- VS Code Extension API — Your First Extension: scaffolding, `activate()`, launch.json, tsconfig — https://code.visualstudio.com/api/get-started/your-first-extension
- VS Code Extension API — Extension Manifest: required `package.json` fields — https://code.visualstudio.com/api/references/extension-manifest
- VS Code Extension API — Activation Events: `onStartupFinished`, deprecation of `"*"`, auto-inference — https://code.visualstudio.com/api/references/activation-events
- VS Code Extension API — Workspace API: `workspaceFolders` typing, `vscode.workspace.fs` — https://code.visualstudio.com/api/references/vscode-api#workspace
- VS Code Extension API — Status Bar UI guidelines: alignment, priority, codicon syntax — https://code.visualstudio.com/api/references/icons-in-labels
- VS Code Extension API — Publishing: `.vscodeignore` rules — https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- VS Code Extension API — Workspace Trust capability — https://code.visualstudio.com/api/extension-guides/workspace-trust
- Project `CLAUDE.md` — full locked stack already verified [VERIFIED: read in this session]
- Project `.planning/ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `CONTEXT.md` — phase scope and requirements [VERIFIED: read in this session]

### Secondary (MEDIUM confidence)
- None — Phase 1 research was entirely against locked project docs + first-party VS Code API docs.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked verbatim in CLAUDE.md
- Architecture (activation flow, status bar wiring): HIGH — first-party VS Code docs
- Pitfalls: HIGH — well-known and documented; Pitfall 6 from observed common mistake pattern
- Scaffold method recommendation: MEDIUM — A1 in Assumptions Log; planner may flip to `yo code`

**Research date:** 2026-05-20
**Valid until:** 2026-06-19 (30 days; Phase 1 stack is stable)
