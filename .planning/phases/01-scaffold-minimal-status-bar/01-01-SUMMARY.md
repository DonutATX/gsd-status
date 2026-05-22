---
phase: 01-scaffold-minimal-status-bar
plan: 01
subsystem: scaffold
tags: [scaffold, manifest, tsconfig, licensing, packaging]
dependency-graph:
  requires: []
  provides:
    - package.json (extension manifest with locked identity)
    - tsconfig.json (compile config; out/ target)
    - .vscodeignore (packaging exclusions)
    - .gitignore (security + build artifacts)
    - LICENSE (MIT)
    - README.md (stub)
    - .vscode/launch.json (F5 → Extension Development Host)
    - .vscode/tasks.json (npm: compile)
  affects:
    - All future phases compile via `npm run compile` → out/extension.js
tech-stack:
  added:
    - typescript ^5.8 (devDependency)
    - "@types/vscode ^1.95.0 (devDependency)"
    - "@types/node ^20 (devDependency)"
  patterns:
    - Hand-written scaffold (no yo code, no bundler)
    - Zero runtime dependencies
    - capabilities.untrustedWorkspaces + virtualWorkspaces (read-only safe)
key-files:
  created:
    - package.json
    - tsconfig.json
    - package-lock.json
    - .vscodeignore
    - .gitignore
    - LICENSE
    - README.md
    - .vscode/launch.json
    - .vscode/tasks.json
  modified: []
decisions:
  - Hand-write scaffold instead of `yo code` (smaller, intentional diff)
  - publisher=donutatx, name=gsd-status, engines.vscode=^1.95.0 (locked in CONTEXT.md)
  - outDir=out matches main=./out/extension.js (RESEARCH Pitfall 6)
  - Defer ESLint to Phase 2 (no source code to lint yet)
  - Defer @vscode/vsce install to Phase 6 (script line only)
metrics:
  duration_minutes: 2
  completed_date: 2026-05-20
  tasks_completed: 2
  files_created: 9
---

# Phase 1 Plan 1: Scaffold Files Summary

Hand-wrote the VS Code extension scaffold (8 files + lockfile) with locked manifest identity (publisher=donutatx, name=gsd-status, engines.vscode=^1.95.0) and matching `@types/vscode`; `npm install` resolved 4 packages with zero vulnerabilities, and F5 launch infrastructure is ready for plan 02 to drop `src/extension.ts`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Author extension manifest and TypeScript config | `56710ca` | package.json, tsconfig.json, package-lock.json |
| 2 | Author .vscodeignore, .gitignore, LICENSE, README, launch.json, tasks.json | `b51bc7d` | .vscodeignore, .gitignore, LICENSE, README.md, .vscode/launch.json, .vscode/tasks.json |

## Verification Results

- `node -e require('./package.json')` assertion → **manifest ok** (publisher, name, activationEvents, main, engines.vscode, @types/vscode all match locked values)
- `node -e require('./tsconfig.json')` assertion → **tsconfig ok** (outDir=out, rootDir=src, strict=true)
- `npm install` → 4 packages added, 0 vulnerabilities
- All 6 Task 2 files present, content assertions pass, launch.json + tasks.json parse as JSON

## Requirements Satisfied

- **SCAF-01**: TypeScript scaffold, unbundled, engines.vscode=^1.95.0 with matching @types/vscode
- **SCAF-03**: .vscodeignore excludes src/, .planning/, *.ts, *.map, dev configs, .env*, *.pem, *.key, credentials.json, secrets.json — keeps out/ and package.json included
- **SCAF-05**: package.json declares publisher, name, displayName, description, categories, repository; LICENSE present with MIT text

## Key Decisions

1. **Hand-written scaffold** — produces a smaller, intentional diff than `yo code` (8 files vs ~25), aligned with RESEARCH recommendation.
2. **outDir/main alignment** — both resolve to `./out/extension.js` (Pitfall 6 mitigation).
3. **Defer ESLint** to Phase 2 when there is actual source code to lint.
4. **Defer @vscode/vsce install** to Phase 6 — `scripts.package` line is reserved but the tool itself is not installed until packaging work begins.
5. **capabilities.untrustedWorkspaces.supported=true** with read-only description added now (T-01-03 mitigation).

## Deviations from Plan

None — plan executed exactly as written. All locked values, file lists, and acceptance criteria were honored verbatim.

## Threat Mitigations Confirmed

- **T-01-01** (Information Disclosure via .vsix): `.vscodeignore` excludes `src/**`, `.planning/**`, `.env*`, `*.pem`, `*.key`, `credentials.json`, `secrets.json` — to be verified by Phase 6 `vsce ls`.
- **T-01-02** (Information Disclosure via git): `.gitignore` covers all five security-mandated patterns.
- **T-01-03** (Untrusted workspace tampering): `capabilities.untrustedWorkspaces.supported=true` with read-only description in package.json.

## Self-Check: PASSED

- FOUND: package.json
- FOUND: tsconfig.json
- FOUND: package-lock.json
- FOUND: .vscodeignore
- FOUND: .gitignore
- FOUND: LICENSE
- FOUND: README.md
- FOUND: .vscode/launch.json
- FOUND: .vscode/tasks.json
- FOUND commit: 56710ca (Task 1)
- FOUND commit: b51bc7d (Task 2)
