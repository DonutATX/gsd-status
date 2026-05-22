---
phase: 02-parsers-tests
plan: 01
subsystem: parsers
tags: [vscode-extension, typescript, mocha, parsers, scaffolding]
requires: []
provides:
  - splitLines / readFrontmatter / stripQuotes helpers
  - RoadmapData / RoadmapPhase / StateData / StateEntry types
  - Mocha test harness wired via npm run test:parsers
  - Fixture corpus under src/test/parsers/fixtures/
affects: [package.json, tsconfig.json (unchanged), .vscode-test.mjs]
tech_stack_added:
  - mocha@11.7.5
  - "@types/mocha@10.0.10"
  - "@vscode/test-cli@0.0.12"
  - "@vscode/test-electron@2.5.2"
patterns:
  - Hand-rolled regex line scanner (no markdown-it / remark)
  - Pure-Node parser modules (zero vscode imports)
  - Linear regex only (no nested quantifiers) per T-02-02
key_files_created:
  - src/parsers/types.ts
  - src/parsers/lines.ts
  - .vscode-test.mjs
  - src/test/parsers/fixtures/canonical-roadmap.md
  - src/test/parsers/fixtures/canonical-state.md
  - src/test/parsers/fixtures/minimal-roadmap.md
  - src/test/parsers/fixtures/crlf-roadmap.md
  - src/test/parsers/fixtures/partial-roadmap.md
  - src/test/parsers/fixtures/malformed-state.md
  - src/test/parsers/fixtures/empty.md
key_files_modified:
  - package.json
decisions:
  - "readFrontmatter accepts an opening --- at line 0 or 1 to tolerate a single leader (BOM/blank); closing --- always ends the block"
  - "stripQuotes only strips a single matched pair of \" or '; leaves mismatched/unquoted strings untouched"
metrics:
  tasks: 3
  files_created: 10
  files_modified: 1
  duration_minutes: 4
  completed: 2026-05-20
---

# Phase 02 Plan 01: Mocha harness, parser types, fixtures — Summary

Installed the Mocha test harness with @vscode/test-cli/test-electron, defined the shared parser type surface
(`RoadmapData`, `StateData`, plus children), implemented the `splitLines` / `readFrontmatter` / `stripQuotes`
helpers in `src/parsers/lines.ts`, and staged the seven-file fixture corpus that Plan 02's RED tests will load.

## What Was Built

### Task 1 — Mocha harness + scripts (commit `ac4e5d7`)

- Added devDependencies: `mocha@11.7.5`, `@types/mocha@10.0.10`, `@vscode/test-cli@0.0.12`, `@vscode/test-electron@2.5.2`.
- Added scripts:
  - `"test:parsers": "mocha \"out/test/parsers/**/*.test.js\""`
  - `"test": "npm run compile && mocha \"out/test/parsers/**/*.test.js\""`
- Created `.vscode-test.mjs` stub exporting `defineConfig({ files: 'out/test/host/**/*.test.js' })` for Phase 3+ extension-host tests.
- `npm run compile` continues to succeed with strict mode enabled.

### Task 2 — Parser types + line helper (commit `8923efb`)

- `src/parsers/types.ts` exports `RoadmapPhase`, `RoadmapData`, `StateEntry`, `StateData` with the exact field
  shapes from the plan's `<interfaces>` block. Top-of-file JSDoc states "Pure types — zero vscode imports".
- `src/parsers/lines.ts` exports:
  - `splitLines(text)` — `text.split(/\r?\n/)`; `'a\r\nb\nc'` → `['a','b','c']`; `''` → `['']`.
  - `readFrontmatter(lines)` — scans for an opening `---` at line 0 or 1, collects flat
    `^([a-z_]+):\s*(.+?)\s*$` matches, skips indented continuation lines (handles nested `progress:` block),
    stops at closing `---`. Returns empty Map on no frontmatter; never throws.
  - `stripQuotes(v)` — strips one matched pair of `"` or `'`; `undefined` returns `undefined`.
- Linear regex only (no nested quantifiers) per threat T-02-02.
- Grep confirmed: no `from 'vscode'` imports in `src/parsers/`.

### Task 3 — Fixture corpus (commit `598d11a`)

| Fixture | Bytes | Notes |
| --- | --- | --- |
| `canonical-roadmap.md` | ~8.0K | Verbatim copy of `.planning/ROADMAP.md` (contains `### Phase 1:` and all six phases) |
| `canonical-state.md` | ~2.5K | Verbatim copy of `.planning/STATE.md` (frontmatter `---` + `Phase: 1 of 6`) |
| `minimal-roadmap.md` | 36 | LF endings — `# Roadmap: Tiny\n\n### Phase 1: Hello\n` |
| `crlf-roadmap.md` | 39 | Identical content, CRLF line endings |
| `partial-roadmap.md` | 40 | Two bare `### Phase` headers, no `**Goal**:` lines |
| `malformed-state.md` | 43 | No frontmatter fence, no `Phase: N of M` line |
| `empty.md` | 0 | Exactly zero bytes |

## Verification

- `npm run compile` — passes (strict mode, no new TS errors).
- Task 1 verify (`node -e` package.json + mocha bin check) — exits 0.
- Task 2 verify (`splitLines`, `readFrontmatter`, `stripQuotes` runtime checks) — exits 0.
- Task 3 verify (seven fixture stat + CRLF + canonical content checks) — exits 0.
- `grep -rn "from 'vscode'" src/parsers/ src/test/parsers/` — no matches.
- `npm run test:parsers` output:

  ```
  > mocha "out/test/parsers/**/*.test.js"
  Error: No test files found: "out/test/parsers/**/*.test.js"
  ```

  This is the expected resolved state for Plan 01. Plan 02 adds the first `*.test.js` files, at which
  point Mocha will report "passing/failing" counts instead of the no-files error.

## Deviations from Plan

None — plan executed exactly as written. No deviations from RESEARCH.md.

## Decisions Made

- `readFrontmatter` accepts an opening `---` at line 0 OR line 1 to tolerate a single leading blank/BOM
  line; closing `---` always ends the block. Matches plan behavior contract.
- `stripQuotes` strips exactly one matched pair (`"…"` or `'…'`); mismatched or unquoted values are
  returned untouched. Aligns with the canonical `last_updated: "2026-05-20T20:31:23.470Z"` shape in
  `.planning/STATE.md`.

## Known Stubs

None. All artifacts shipped are functional. `.vscode-test.mjs` points at `out/test/host/**` which does
not yet exist — this is an intentional stub for Phase 3+, documented in the file itself.

## Commits

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 — Mocha harness + scripts | `ac4e5d7` | chore |
| 2 — Parser types + line helper | `8923efb` | feat |
| 3 — Fixture corpus | `598d11a` | test |

## Self-Check: PASSED

- `src/parsers/types.ts` — FOUND
- `src/parsers/lines.ts` — FOUND
- `.vscode-test.mjs` — FOUND
- All seven fixture files — FOUND
- Commits `ac4e5d7`, `8923efb`, `598d11a` — present in `git log`.
