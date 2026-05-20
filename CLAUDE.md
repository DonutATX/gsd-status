<!-- GSD:project-start source:PROJECT.md -->
## Project

**GSD Status — VS Code Extension**

A VS Code extension that surfaces the live GSD (Get-Shit-Done) workflow state directly inside the editor. It shows the current milestone, active phase, and the most recent GSD step in a status bar item, with a side panel for browsing all phases and recent activity. The extension reads `.planning/ROADMAP.md` and `.planning/STATE.md` so developers running GSD never have to switch terminals or open planning files to know where they are.

**Core Value:** A developer running GSD in a project can glance at VS Code and immediately know: which milestone, which phase, and what just happened — without leaving the editor.

### Constraints

- **Tech stack**: TypeScript + VS Code Extension API (Node.js runtime that ships with VS Code). No bundler-heavy stack unless required.
- **Distribution**: `.vsix` build must work without marketplace publisher account; marketplace publish is opt-in and deferred.
- **Performance**: Status updates must not block the editor; parsing should complete in <100ms for typical `.planning/` files.
- **Compatibility**: VS Code stable, Windows 11 (primary dev environment); should also run on macOS/Linux without OS-specific code.
- **Read-only**: The extension never writes to `.planning/` — it observes only.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | `^5.8` (latest: 5.8.x) | Primary language | VS Code Extension API ships `.d.ts` files; TypeScript catches API misuse at compile time. Strict mode eliminates whole categories of runtime bugs. |
| `@types/vscode` | `^1.120.0` | Type definitions for VS Code Extension API | Must match or be <= your `engines.vscode`. 1.120.0 aligns with VS Code stable (May 2026). |
| Node.js | `>=20.x` (generator-code requires `>=20.5.0`) | Runtime (bundled in VS Code) | VS Code 1.120 ships with Node 20; your extension runs in VS Code's Node runtime, so target Node 20 LTS features. |
### Scaffolding
| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| `generator-code` | `1.11.18` (npm) | Official Microsoft VS Code extension scaffold | Produces a correctly wired `package.json` (activation events, contribution points, `tsconfig.json`, launch configs). Use `npx --package yo --package generator-code -- yo code` — no global install needed. Choose "New Extension (TypeScript)" → "No bundler" for this project. |
### Build
| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| `typescript` (tsc) | `^5.8` | Compilation | For this extension, `tsc` is the right build tool. No bundler is needed because: (a) the extension has zero third-party runtime dependencies — only `vscode` APIs and stdlib; (b) bundlers add complexity the PROJECT.md explicitly warns against; (c) VS Code loads extensions from disk, not a CDN, so startup-time bundle optimization gives no measurable benefit for a ~5-file project. |
| `esbuild` | `^0.28.0` | Optional future bundler | If dependencies grow (e.g., you add markdown-it), esbuild is the correct bundler choice — 10-100x faster than webpack, simpler config. Do NOT add now; defer until you have a measured reason. |
### Testing
| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| `@vscode/test-cli` | `^0.0.12` | VS Code test runner CLI | Microsoft's current recommended test runner (replaces the older manual runner scripts). Wraps Mocha, launches a real VS Code instance for integration tests. |
| `@vscode/test-electron` | `^2.5.2` | Downloads/runs VS Code for tests | Required peer of `@vscode/test-cli`. Downloads a headless VS Code binary; tests run inside the actual extension host. |
| `mocha` | `^11.7.5` | Test framework (used by test-cli) | `@vscode/test-cli` exclusively wraps Mocha. No additional test framework needed. Vitest does NOT run inside VS Code's extension host — it would only suit pure-unit tests without any `vscode.*` API calls. |
### Linting
| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| `eslint` | `^10.4.0` | Linter | ESLint v9+ ships flat config as the default. Use `eslint.config.mjs` — no `.eslintrc` files. |
| `typescript-eslint` | `^8.59.4` | TypeScript rules | The official TS-aware ESLint plugin. The `tseslint.config()` helper (`typescript-eslint` package) provides the standard recommended ruleset. |
### Packaging & Publishing
| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| `@vscode/vsce` | `^3.9.1` | Package and publish extensions | Official Microsoft tool (`vsce` on older docs = same thing, renamed). `vsce package` builds a `.vsix` without any marketplace account. `vsce publish` is the marketplace path — deferred per PROJECT.md. Node `>=20` required. |
### Markdown Parsing
| Approach | When to Use | Why |
|----------|-------------|-----|
| **Hand-rolled regex / line scanner** (RECOMMENDED) | This project — always | ROADMAP.md and STATE.md use a narrow, stable grammar (`### Phase N:`, `**Goal:**`, `**Mode:**`, bullet lists). A 60-line parser with `string.split('\n')` and a few regex matches will be faster, zero-dependency, and easier to debug than any library. No markdown-it or remark needed. |
| `markdown-it` (`^14.1.1`) | If you ever need to render HTML or parse CommonMark ambiguity | VS Code itself uses markdown-it; it has TypeScript types in `@types/markdown-it@14.1.2`. Add only if the grammar becomes complex enough to break regex. |
| `remark` / `unified` | Content pipelines, MDX, complex AST transforms | Severe overkill for line-oriented key-value extraction. Do not use. |
### File Watching
| Approach | Why |
|----------|-----|
| **`vscode.workspace.createFileSystemWatcher`** (REQUIRED) | The correct API for VS Code extensions. It hooks into VS Code's existing file watcher infrastructure — no additional OS watcher, no extra file descriptors, no CPU overhead. VS Code cmake-tools migrated away from chokidar specifically because chokidar caused high CPU on Apple M1 when `fsevents` was unavailable. |
| ~~chokidar~~ | Do NOT use. Bundles its own OS watcher that fights VS Code's native watcher, causes CPU spikes on macOS, and adds unnecessary bundle weight. |
## TypeScript Configuration
## engines.vscode
## Scaffolding Command
- Extension type: **New Extension (TypeScript)**
- Bundler: **unbundled** (no webpack, no esbuild — tsc only)
- Package manager: **npm**
- Initialize git: **Yes** (or No if the repo already exists)
## Installation (dev dependencies only — no runtime deps)
# After yo code scaffold, install current versions:
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chokidar` | Fights VS Code's native file watcher, causes CPU spikes on macOS, unnecessary bundle weight | `vscode.workspace.createFileSystemWatcher` |
| `webpack` | Configuration overhead is not justified for a zero-dependency extension with 5 source files | `tsc` (now), `esbuild` (if bundling ever needed) |
| `remark` / `unified` | 25+ package install for a grammar you can parse in 60 lines of regex | Hand-rolled line scanner |
| `vitest` | Cannot execute inside the VS Code extension host; tests that call any `vscode.*` API will fail | `@vscode/test-cli` + `mocha` |
| Global `yo` / `vsce` installs | Pollutes the global npm environment; `npx` is sufficient and always uses the latest version | `npx --package yo --package generator-code -- yo code` |
| Old `vsce` package name | Deprecated alias; the npm package is now `@vscode/vsce` | `@vscode/vsce` |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Bundler | `tsc` (no bundler) | `esbuild` | Zero runtime deps = no bundling benefit right now; add esbuild later if deps appear |
| Test runner | `@vscode/test-cli` + mocha | `@vscode/test-electron` (manual runner) | test-cli is Microsoft's current recommended path; less boilerplate |
| Linter config | ESLint v10 flat config | `.eslintrc` / ESLint v8 | ESLint v9+ made flat config default; `.eslintrc` is deprecated |
| Markdown parsing | Hand-rolled regex | `markdown-it` | Overkill for 3-4 known patterns; adds a runtime dependency for no practical gain |
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@types/vscode@^1.95.0` | `engines.vscode: "^1.95.0"` | Always keep these in sync — `@types/vscode` version must be <= your `engines.vscode` minimum |
| `typescript@^5.8` | `target: "ES2022"`, `module: "Node16"` | TypeScript 6.x (in beta) introduces breaking changes; stay on 5.x until ecosystem catches up |
| `@vscode/test-cli@^0.0.12` | `@vscode/test-electron@^2.5.2` | These two are a pair — always install both together |
| `@vscode/vsce@^3.9.1` | Node `>=20` | vsce 3.x requires Node 20; matches generator-code requirement |
## Sources
- [VS Code Extension API — Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension) — scaffolding command, TypeScript guidance (HIGH confidence)
- [VS Code Extension API — Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) — esbuild vs webpack guidance (HIGH confidence)
- [VS Code Extension API — Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension) — @vscode/test-cli recommendation (HIGH confidence)
- [VS Code Extension API — Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) — @vscode/vsce, vsix packaging (HIGH confidence)
- [npm registry — generator-code@1.11.18](https://www.npmjs.com/package/generator-code) — version and Node engine requirement verified (HIGH confidence)
- [npm registry — @vscode/vsce@3.9.1](https://www.npmjs.com/package/@vscode/vsce) — current version verified (HIGH confidence)
- [npm registry — @vscode/test-cli@0.0.12](https://www.npmjs.com/package/@vscode/test-cli) — current version, Mocha dependency confirmed (HIGH confidence)
- [npm registry — typescript@5.8.x, eslint@10.4.0, typescript-eslint@8.59.4, esbuild@0.28.0](https://www.npmjs.com) — versions verified directly from registry (HIGH confidence)
- [vscode-cmake-tools issue #2967](https://github.com/microsoft/vscode-cmake-tools/issues/2967) — chokidar vs FileSystemWatcher CPU evidence (HIGH confidence)
- [VS Code 1.120 release notes](https://code.visualstudio.com/updates/v1_120) — confirmed current stable version (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
