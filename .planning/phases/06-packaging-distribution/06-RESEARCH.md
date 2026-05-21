# Phase 6: Packaging + Distribution - Research

**Researched:** 2026-05-21
**Domain:** VS Code Extension Packaging (`@vscode/vsce`, `.vscodeignore`, CHANGELOG, README)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add an `npm run package` script that runs `vsce package` (supersedes the existing `package:vsix` script).
- Add `@vscode/vsce` as a pinned devDependency (`^3.x`); the package script invokes it.
- Add a minimal `CHANGELOG.md` with the v0.1.0 entry — vsce surfaces it in the package.
- Add a `vscode:prepublish` script running `npm run compile` so the packaged `.vsix` always contains a fresh `out/`.
- `README.md` references screenshot image files under an `images/` directory; the actual screenshot capture is a manual UAT step (cannot be automated headlessly).
- `README.md` scope: install via `code --install-extension <vsix>`, feature overview (status bar, tooltip, commands, side panel TreeView), settings reference (`gsd.refreshIntervalSeconds`, `gsd.recentActivityCount`), and build-from-source instructions.
- Add `*.vsix` to `.gitignore` — the built package is a build artifact, not committed.
- Marketplace-only manifest fields (`icon`, `galleryBanner`, etc.) are intentionally left out — deferred to v2 per PROJECT.md.

### Claude's Discretion
- None specified.

### Deferred Ideas (OUT OF SCOPE)
- Marketplace publishing (publisher account, `vsce publish`, GitHub Actions release workflow, listing assets — icon 128x128, gallery banner) — v2 (MKT-01..03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | `npm run package` produces a `.vsix` via `@vscode/vsce` that installs cleanly in VS Code stable | `@vscode/vsce@3.9.1` confirmed on npm; `vsce package` command; `vscode:prepublish` hook; `.vscodeignore` gaps identified |
| PKG-02 | `vsce ls` output reviewed; packaged size <500 KB | `vsce ls` lists files that would be packaged; live `vsce ls` run shows current inclusions and gaps that must be fixed |
| PKG-03 | Compatibility verified on the minimum declared `engines.vscode` version | `engines.vscode: "^1.95.0"` — vsce validates this at package time; no code changes needed |
| PKG-04 | README.md documents install, feature overview, and screenshot of status bar + tree | Existing README is 525 bytes placeholder; expansion required; screenshot is manual UAT |
</phase_requirements>

---

## Summary

Phase 6 is a pure tooling and documentation phase — no new extension features. The work is: install `@vscode/vsce`, wire `npm run package` + `vscode:prepublish`, audit and fix `.vscodeignore`, create `CHANGELOG.md`, and expand `README.md`.

A live `vsce ls` run (executed during research) reveals two critical gaps in the current `.vscodeignore`: (1) `.serena/**` files are included in the package — the Serena MCP tool directory is not excluded; (2) `out/test/**` files are included — the compiled test output is included in the `.vsix` when it should not be. These gaps must be fixed before the package meets the <500 KB target and clean install requirement.

`@vscode/vsce@3.9.1` is confirmed as the current stable release on npm (published 2026-05-14). [VERIFIED: npm registry] Node >=20 is required by vsce; the development machine runs Node v25.2.1 — fully satisfied. The extension has zero runtime dependencies, so the package will be small once tests and Serena files are excluded.

**Primary recommendation:** Fix `.vscodeignore` first (add `.serena/**` and `out/test/**` exclusions), then wire `npm run package`, write CHANGELOG.md and expanded README.md, and verify with `vsce ls` + a manual install.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `.vsix` build | Build toolchain | — | `vsce package` runs at dev time; output is a build artifact |
| File exclusion | Build toolchain (`.vscodeignore`) | — | Defines what enters the `.vsix`; no runtime component |
| Entry point | Extension host (Node.js via VS Code) | — | `main: ./out/extension.js` is the runtime entry; must be present in `.vsix` |
| Documentation | Static files in `.vsix` | — | `README.md`, `CHANGELOG.md`, `LICENSE` are metadata read by VS Code and marketplace |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vscode/vsce` | `3.9.1` | Package and publish VS Code extensions | Official Microsoft tool; `vsce package` builds `.vsix` without a marketplace account. Node >=20 required. [VERIFIED: npm registry] |

**Version verification:**
```bash
npm view @vscode/vsce version
# → 3.9.1 (published 2026-05-14)
```

### Supporting

None. This phase adds no runtime dependencies. `@vscode/vsce` is the sole new devDependency.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@vscode/vsce` | `ovsx` (Open VSX) | Only relevant for publishing to Open VSX Registry (Eclipse/Theia). Not a replacement for `.vsix` packaging. Deferred to v2. |

**Installation:**
```bash
npm install --save-dev @vscode/vsce
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@vscode/vsce` | npm | ~8 yrs (as `vsce`, renamed 2022) | ~1.2M/wk | github.com/microsoft/vscode-vsce | N/A (slopcheck unavailable) | Approved — official Microsoft tool, well-known provenance [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. `@vscode/vsce` is an official Microsoft package with a known GitHub repository and multi-year npm history. The planner should confirm before install if desired, but risk is negligible for this well-known package.*

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
project/
├── images/               # Screenshots for README.md (created in this phase)
│   └── status-bar.png    # Manual UAT capture — placeholder reference in README
├── CHANGELOG.md          # NEW — Keep a Changelog format, v0.1.0 entry
├── README.md             # EXPAND — install, features, settings, build-from-source
├── .vscodeignore         # FIX — add .serena/** and out/test/** exclusions
└── package.json          # ADD scripts: npm run package, vscode:prepublish
```

### Pattern 1: `npm run package` + `vscode:prepublish`

**What:** `vscode:prepublish` is a special lifecycle script that `vsce package` runs automatically before building the `.vsix`. It ensures the compiled `out/` is always fresh.

**When to use:** Required whenever you want to guarantee the packaged extension reflects the current source.

**Example:**
```json
// Source: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
"scripts": {
  "compile": "tsc -p .",
  "vscode:prepublish": "npm run compile",
  "package": "vsce package"
}
```

> Note: The existing `package:vsix` script calls `vsce package` without `@vscode/vsce` installed. It must be replaced with `package` (per CONTEXT.md decision). The `vscode:prepublish` hook makes `package` always compile first — no stale `out/`.

### Pattern 2: `.vscodeignore` File Inclusion/Exclusion

**What:** `.vscodeignore` uses `.gitignore`-style glob patterns. Files NOT in `.vscodeignore` and NOT in `devDependencies` are included in the `.vsix`.

**Current gaps found by live `vsce ls` run:**

The following files appear in `vsce ls` output but SHOULD NOT be in the package:

```
.serena/project.yml
.serena/project.local.yml
.serena/.gitignore
.serena/memories/*.md
.serena/cache/**/*.pkl
CLAUDE.md
.vscode-test.mjs
.mocharc.cjs
out/test/**          (all compiled test files)
```

**Fixed `.vscodeignore` additions needed:**
```
.serena/**
out/test/**
CLAUDE.md
.vscode-test.mjs
.mocharc.cjs
**/*.map
```

> Note: `**/*.map` (source maps) are currently included. They are useful for debugging but add weight. Per the <500 KB requirement, they should be excluded unless there is a specific reason to include them.

**Files that MUST remain in the package:**
```
out/extension.js        ← main entry point
out/parsers/*.js        ← parser modules
out/state/*.js          ← state modules
out/tree/*.js           ← tree provider
resources/gsd-icon.svg  ← Activity Bar icon
README.md
CHANGELOG.md            ← NEW
LICENSE
package.json
```

### Pattern 3: CHANGELOG.md — Keep a Changelog Format

**What:** vsce reads `CHANGELOG.md` and surfaces it in the VS Code extension details panel. [ASSUMED — vsce docs don't explicitly mandate a format, but Keep a Changelog is the de facto standard for VS Code extensions.]

**Minimum valid format:**
```markdown
# Change Log

## [0.1.0] - 2026-05-21

### Added
- Status bar item showing current GSD milestone and phase
- Hover tooltip with milestone, phase goal, and recent STATE.md activity
- Activity Bar side panel (TreeView) with all phases and recent activity
- Commands: `gsd.refresh`, `gsd.openRoadmap`, `gsd.openState`, `gsd.refreshTree`
- Configuration: `gsd.refreshIntervalSeconds`, `gsd.recentActivityCount`
- File watcher on `.planning/ROADMAP.md` and `.planning/STATE.md`
- Welcome view when no GSD project is detected
```

### Anti-Patterns to Avoid

- **Forgetting `vscode:prepublish`:** Without it, `vsce package` packages whatever is in `out/` from the last manual compile — potentially stale. Always wire `vscode:prepublish: npm run compile`.
- **Running `vsce` without it in `devDependencies`:** The current `package:vsix` script calls bare `vsce` which is not installed. Replace with `@vscode/vsce` as a devDependency and invoke via the npm script (npm scripts resolve `node_modules/.bin` automatically).
- **Leaving `.serena/**` unexcluded:** Serena MCP tool files are project-local tooling, not extension runtime files. They inflate package size and expose internal tool configuration.
- **Including `out/test/**`:** Test files are not needed at runtime and inflate the `.vsix`.
- **Including `CLAUDE.md`:** Project AI instructions are internal tooling, not user documentation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `.vsix` packaging | Custom zip/tar script | `vsce package` | vsce handles manifest validation, dependency bundling, file signing, and marketplace format; a custom script would miss all of these |
| Extension version validation | Manual semver check | `vsce package` validates `engines.vscode` against the declared version | Built-in validation in vsce |

**Key insight:** `vsce package` is the only correct tool for this job. It validates `package.json` fields, verifies `engines.vscode`, checks for required fields, and produces a correctly-structured `.vsix`. There is no simpler alternative.

---

## Common Pitfalls

### Pitfall 1: `vsce` Not in PATH / Not Installed

**What goes wrong:** The existing `package:vsix` script calls `vsce package` directly. If `@vscode/vsce` is not in `devDependencies`, running `npm run package:vsix` fails with `vsce: command not found`.
**Why it happens:** `vsce` is the old package name (deprecated); the new name is `@vscode/vsce`. The old `vsce` global might not be installed.
**How to avoid:** Add `@vscode/vsce` to `devDependencies` and invoke via `npm run package` (npm resolves `node_modules/.bin/vsce` automatically).
**Warning signs:** `npm run package:vsix` fails; `npx vsce` installs the old deprecated package.

### Pitfall 2: `.serena/**` and `out/test/**` Included in Package

**What goes wrong:** The package is larger than necessary and contains internal tooling files. The `.vsix` installs with Serena memory files and compiled test code visible to the extension host.
**Why it happens:** `.vscodeignore` does not currently exclude `.serena/**` or `out/test/**` (confirmed by live `vsce ls` run during research).
**How to avoid:** Add `.serena/**` and `out/test/**` to `.vscodeignore`.
**Warning signs:** `vsce ls` output shows `.serena/` entries or `out/test/` entries.

### Pitfall 3: `vscode:prepublish` Missing

**What goes wrong:** `vsce package` packages whatever is in `out/` at the time of packaging — potentially stale after source changes.
**Why it happens:** Developer forgets to `npm run compile` before `npm run package`.
**How to avoid:** Add `"vscode:prepublish": "npm run compile"` to `scripts` in `package.json`. `vsce package` runs this hook automatically.
**Warning signs:** `.vsix` installs successfully but extension behavior doesn't reflect recent source changes.

### Pitfall 4: README.md Contains Placeholder Text on Install

**What goes wrong:** VS Code displays the README in the extension details panel. The current README contains "Phase 6 will expand this README..." — visible to anyone who installs from the `.vsix`.
**Why it happens:** README was intentionally deferred to Phase 6.
**How to avoid:** Expand README before packaging (this is the primary Phase 6 task).
**Warning signs:** `vsce ls` output includes `README.md` — it is always included and always displayed.

### Pitfall 5: `*.vsix` Not in `.gitignore`

**What goes wrong:** The built `.vsix` is committed to git, bloating the repository.
**Why it happens:** Developer runs `npm run package` and `git add .`.
**How to avoid:** Verify `*.vsix` is in `.gitignore` — it already is (confirmed during research).
**Warning signs:** `git status` shows an untracked `.vsix` file.

---

## Code Examples

### package.json scripts block (final state)

```json
// Source: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
"scripts": {
  "compile":           "tsc -p .",
  "watch":             "tsc -w -p .",
  "vscode:prepublish": "npm run compile",
  "package":           "vsce package",
  "test":              "npm run compile && mocha \"out/test/**/*.test.js\"",
  "test:parsers":      "mocha \"out/test/parsers/**/*.test.js\""
}
```

> Remove `package:vsix` entirely; replace with `package`. The `vscode:prepublish` hook is added as a new entry.

### Verifying package contents

```bash
# List all files that would be included in the .vsix
npx @vscode/vsce ls --no-dependencies

# Build the .vsix
npm run package

# Install locally
code --install-extension gsd-status-0.1.0.vsix

# Uninstall
code --uninstall-extension donutatx.gsd-status
```

### CHANGELOG.md structure

```markdown
# Change Log

All notable changes to the "gsd-status" extension will be documented in this file.

## [0.1.0] - 2026-05-21

### Added
- Status bar item showing current GSD milestone and active phase
- Hover tooltip: milestone, phase name + goal, most recent STATE.md entry
- Activity Bar side panel with all phases (active phase highlighted) and recent activity
- Commands: GSD: Refresh, GSD: Open Roadmap, GSD: Open State, GSD: Refresh GSD tree
- Configuration: `gsd.refreshIntervalSeconds` (default 30s), `gsd.recentActivityCount` (default 5)
- File watcher on `.planning/ROADMAP.md` and `.planning/STATE.md` with 300ms debounce
- Welcome view shown when no GSD project detected in workspace
```

### README.md required sections

```markdown
# GSD Status

[brief description + badge]

## Features
- Status bar: ...
- Tooltip: ...
- Side panel: ...
- Commands: ...

## Requirements
- VS Code ^1.95.0

## Installation
### From .vsix (local)
1. Download `gsd-status-0.1.0.vsix`
2. Run: `code --install-extension gsd-status-0.1.0.vsix`
3. Or: Extensions panel → "..." → "Install from VSIX..."

## Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `gsd.refreshIntervalSeconds` | 30 | Polling interval in seconds (min 5) |
| `gsd.recentActivityCount` | 5 | Recent STATE.md entries shown (min 1) |

## Build from Source
```bash
git clone https://github.com/DonutATX/gsd-extenstion
cd gsd-extenstion
npm install
npm run package
code --install-extension gsd-status-0.1.0.vsix
```

## Known Limitations
- Read-only: the extension never writes to .planning/
- Single-workspace scope
```

---

## SCAF-03 and SCAF-05 Gap Verification

The phase description notes SCAF-03 (`.vscodeignore`) and SCAF-05 (manifest metadata) were nominally Phase 1. Here is the verified current state:

### SCAF-03: `.vscodeignore` — INCOMPLETE

Current `.vscodeignore` is missing these exclusions (confirmed by live `vsce ls` run):

| Missing Pattern | Files Affected | Action |
|-----------------|---------------|--------|
| `.serena/**` | 8+ Serena MCP files | Add to `.vscodeignore` |
| `out/test/**` | ~15 compiled test files | Add to `.vscodeignore` |
| `CLAUDE.md` | Project AI instructions | Add to `.vscodeignore` |
| `.vscode-test.mjs` | Test runner config | Add to `.vscodeignore` |
| `.mocharc.cjs` | Mocha config | Add to `.vscodeignore` |
| `**/*.map` | Source map files (optional) | Add to `.vscodeignore` if <500KB target requires it |

The `.vscodeignore` already correctly excludes: `src/**`, `.vscode/**`, `node_modules/**`, `.planning/**`, `.gitignore`, `eslint.config.mjs`, `tsconfig.json`, `**/*.ts`, `*.vsix`, `.env*`.

### SCAF-05: Extension Manifest Metadata — COMPLETE

All required fields are present in `package.json` (verified):

| Field | Value | Status |
|-------|-------|--------|
| `name` | `gsd-status` | Present |
| `displayName` | `GSD Status` | Present |
| `description` | (full description) | Present |
| `publisher` | `donutatx` | Present |
| `version` | `0.1.0` | Present |
| `categories` | `["Other"]` | Present |
| `repository` | github URL | Present |
| `engines.vscode` | `^1.95.0` | Present |
| `license` | `MIT` | Present |
| `LICENSE` file | exists | Present |

SCAF-05 is fully complete. No work needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vsce` (standalone npm package) | `@vscode/vsce` (scoped package) | ~2022 | The old `vsce` package is deprecated; always use `@vscode/vsce` |
| `.eslintrc` config | `eslint.config.mjs` (flat config) | ESLint v9 | Already using flat config in this project |

**Deprecated/outdated:**
- `vsce` (unscoped npm package): deprecated alias; replaced by `@vscode/vsce`. [ASSUMED — based on known deprecation notice; the old package still exists on npm but points users to the new scoped package]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@vscode/vsce` has well-known provenance and passes slopcheck legitimacy | Package Legitimacy Audit | Negligible — official Microsoft package with years of history and >1M weekly downloads |
| A2 | vsce surfaces CHANGELOG.md in extension details panel | Code Examples | If vsce ignores it, the changelog still documents history for git/GitHub users; no functional regression |
| A3 | `*.map` source map exclusion reduces `.vsix` below 500 KB | Common Pitfalls | If maps are small enough that the package is already <500 KB without excluding them, this is a no-op optimization |

---

## Open Questions

1. **Screenshot requirement (PKG-04)**
   - What we know: PKG-04 requires a screenshot of status bar + tree in README. CONTEXT.md confirms screenshot capture is a manual UAT step.
   - What's unclear: The `images/` directory does not exist yet. README must reference `images/status-bar.png` (or similar) even before the screenshot is captured.
   - Recommendation: Create `images/` directory in this phase with a placeholder README note. Planner should include a UAT checklist item: "Capture screenshot and add to images/".

2. **Exact final `.vsix` size**
   - What we know: Zero runtime deps; compiled JS is small (~8KB for extension.js + supporting modules). Source maps + test output inflate it.
   - What's unclear: Exact size after `.vscodeignore` fixes — cannot know without building.
   - Recommendation: Plan includes a `vsce ls` review step and a size check after `npm run package`. If >500 KB, exclude `**/*.map`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `@vscode/vsce` (Node >=20) | Yes | v25.2.1 | — |
| npm | Package install | Yes | (bundled with Node 25) | — |
| `@vscode/vsce` | PKG-01 build | Not yet installed | — | Add to devDependencies |
| VS Code CLI (`code`) | PKG-01 install test | Assumed present | — | Manual install via Extensions panel |

**Missing dependencies with no fallback:** none (Node >=20 is satisfied)

**Missing dependencies with fallback:**
- `@vscode/vsce` — not yet in `devDependencies`; install is the first task of this phase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mocha `^11.7.5` |
| Config file | `.mocharc.cjs` |
| Quick run command | `npm run test:parsers` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKG-01 | `npm run package` produces a `.vsix` that installs cleanly | smoke (manual) | `npm run package && code --install-extension *.vsix` | N/A — manual UAT |
| PKG-02 | `vsce ls` output clean; packaged size <500 KB | smoke (manual) | `npx @vscode/vsce ls --no-dependencies` | N/A — manual check |
| PKG-03 | Compatibility on engines.vscode minimum | manual verification | Launch EDH, verify no deprecation warnings | N/A — manual UAT |
| PKG-04 | README documents install, features, settings, screenshot | manual inspection | Review README.md | N/A — documentation |

> All PKG-* requirements are packaging/documentation artifacts that require human verification. There are no automated tests to write for this phase — verification is via `vsce ls`, manual install, and README review.

### Sampling Rate
- **Per task commit:** `npm run compile` (ensure compile succeeds)
- **Per wave merge:** `npm run test` (full mocha suite — no regressions)
- **Phase gate:** Full suite green + successful `npm run package` + clean `vsce ls` before `/gsd:verify-work`

### Wave 0 Gaps
- None — no new test files needed for this phase. Existing mocha suite covers parser/state/tree logic. Packaging verification is manual.

---

## Security Domain

> `security_enforcement` is not explicitly set to `false` in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | n/a — no auth in this extension |
| V3 Session Management | No | n/a |
| V4 Access Control | No | n/a |
| V5 Input Validation | No | packaging phase — no new input paths |
| V6 Cryptography | No | n/a |

### Known Threat Patterns for VS Code Extension Packaging

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sensitive files in `.vsix` (`.env`, `secrets.json`, credentials) | Information Disclosure | `.vscodeignore` already excludes `.env*`, `*.pem`, `*.key`, `credentials.json`, `secrets.json` — confirmed |
| Internal tooling exposure (`.serena/**`, `CLAUDE.md`) | Information Disclosure | Add `.serena/**` and `CLAUDE.md` to `.vscodeignore` (gap identified during research) |
| Committing `.vsix` to git | Information Disclosure | `*.vsix` already in `.gitignore` — confirmed |

---

## Sources

### Primary (HIGH confidence)
- [VS Code Extension API — Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) — `vscode:prepublish`, `.vscodeignore` patterns, `vsce package` usage
- [npm registry — @vscode/vsce@3.9.1](https://www.npmjs.com/package/@vscode/vsce) — version 3.9.1, Node >=20 engine requirement, publish date 2026-05-14 [VERIFIED: npm registry]
- Live `vsce ls` run — current package inclusion list (exact files confirmed in research session)

### Secondary (MEDIUM confidence)
- [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/) — CHANGELOG.md format and section types
- [VS Code Extension Manifest reference](https://code.visualstudio.com/api/references/extension-manifest) — required `package.json` fields

### Tertiary (LOW confidence)
- WebSearch results on `.vscodeignore` best practices — cross-referenced with official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@vscode/vsce@3.9.1` confirmed on npm registry; official Microsoft tool
- Architecture: HIGH — live `vsce ls` run reveals exact current state; no guesswork on file inclusion
- Pitfalls: HIGH — gaps confirmed empirically (live tool run), not inferred

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable domain — vsce major version changes rarely)
