---
phase: 02-parsers-tests
plan: 02
subsystem: parsers
tags: [vscode-extension, typescript, mocha, parsers, tdd]
requires:
  - splitLines / readFrontmatter / stripQuotes (Plan 02-01)
  - RoadmapData / StateData / RoadmapPhase / StateEntry types (Plan 02-01)
  - Fixture corpus under src/test/parsers/fixtures/ (Plan 02-01)
provides:
  - parseRoadmap(text) → RoadmapData (total, deterministic, linear)
  - parseState(text) → StateData (total, deterministic, linear)
  - PARS-05 stress guard against catastrophic backtracking
affects:
  - Phase 3 StateController will import parseRoadmap / parseState
tech_stack_added: []
patterns:
  - TDD RED → GREEN → REFACTOR (test commit precedes feat commit)
  - Linear regex constants hoisted to module top
  - Two-pass scan for parseRoadmap (done bullets, then phase blocks)
  - Frontmatter-first / body-overrides for parseState last_activity
key_files_created:
  - src/parsers/roadmap.ts
  - src/parsers/state.ts
  - src/test/parsers/roadmap.test.ts
  - src/test/parsers/state.test.ts
  - src/test/parsers/stress.test.ts
key_files_modified: []
decisions:
  - "Resolve fixture path from __dirname up to repo root, then into src/test/parsers/fixtures (tests run from out/ but fixtures live under src/)"
  - "parseRoadmap: only set projectName/milestoneLabel before the first phase header is opened (avoids late H1 lines being mistaken for project title)"
  - "parseState: body 'Last activity:' wins over frontmatter last_activity (most-recent observation principle)"
metrics:
  tasks: 3
  files_created: 5
  files_modified: 0
  duration_minutes: 5
  completed: 2026-05-20
---

# Phase 02 Plan 02: TDD parseRoadmap + parseState + PARS-05 stress guard — Summary

Drove `parseRoadmap` and `parseState` through three RED → GREEN cycles (Task 1, Task 2, Task 3
stress guard). All 31 parser tests green on a single `npm test`; pathological inputs measured
well under the 100ms threshold.

## What Was Built

### Task 1 — parseRoadmap (commits `21abc14`, `5537a4d`)

- **RED** (`21abc14`) — Wrote `src/test/parsers/roadmap.test.ts` with 15 `it(...)` cases:
  9 canonical (project name strip, 6-phase count, Phase 1 done, Phase 2 not done, goal text,
  mode, requirements list, success criteria count, headerLine 1-based) and 6 robustness
  (empty string, empty.md fixture, inline CRLF, crlf-roadmap.md fixture, partial-roadmap.md
  with undefined goals, decimal phase number). Compile failed with `TS2307: Cannot find
  module '../../parsers/roadmap.js'` — confirmed RED.
- **GREEN** (`5537a4d`) — Implemented `src/parsers/roadmap.ts` with hoisted regex constants
  and a two-pass scan. Pass 1 collects done phase numbers from `- [x] **Phase N:` bullets;
  Pass 2 walks lines, capturing H1 (with `Roadmap:` prefix strip), milestone heading, phase
  headers, and per-phase `**Goal**:`, `**Mode:**`, `**Depends on**:`, `**Requirements**:`
  fields plus indented `Success Criteria` list items. All 15 tests pass.

### Task 2 — parseState (commits `20e6847`, `7d50903`)

- **RED** (`20e6847`) — Wrote `src/test/parsers/state.test.ts` with 14 `it(...)` cases:
  8 canonical (milestone, milestone_name, status, last_updated with quotes stripped,
  phaseNumber, phaseName, lastEntry.raw, lastEntry.timestamp) and 6 robustness (empty
  string, empty.md, malformed-state.md doesNotThrow, decimal phase position, frontmatter
  fallback when body Last activity absent, body wins over frontmatter). Compile failed
  with `TS2307: Cannot find module '../../parsers/state.js'` — confirmed RED.
- **GREEN** (`7d50903`) — Implemented `src/parsers/state.ts` using `readFrontmatter` from
  Plan 02-01 and a single body scan. Body `Last activity:` populates `lastEntry`; if absent,
  frontmatter `last_activity` is used as fallback. ISO_OR_DATE extracts the timestamp from
  the raw string. All 14 tests pass.

### Task 3 — PARS-05 stress guard (commit `6cb35cf`)

- Added `src/test/parsers/stress.test.ts` with two `it(...)` blocks:
  - `parseRoadmap`: ~50KB of `#`, 500 repeated `### Phase 1: x*200` headers, 500 repeated
    done-bullet lines, ~50KB of `*`.
  - `parseState`: ~500-key frontmatter block (`v*200` each), 1000 long `Phase: N.N of 9999 (n*100)`
    lines, ~50KB of `*`.
- Both assert `dt < 100` with the actual ms reported on failure. Whole test run executes in
  ~5ms total on dev hardware — comfortable margin against the 100ms gate.

## Regex Constants Used

`src/parsers/roadmap.ts`:

```
DONE_BULLET     = /^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/
H1              = /^#\s+(.+?)\s*$/
ROADMAP_PREFIX  = /^Roadmap:\s*/
MILESTONE       = /^##\s+Milestone\s+(v\d+(?:\.\d+)?[^\r\n]*)$/
PHASE_HEADER    = /^###\s+Phase\s+(\d+(?:\.\d+)?):\s+(.+?)\s*$/
GOAL            = /^\*\*Goal\*\*:\s*(.+?)\s*$/
MODE            = /^\*\*Mode:\*\*\s*(.+?)\s*$/
DEPENDS_ON      = /^\*\*Depends on\*\*:\s*(.+?)\s*$/
REQUIREMENTS    = /^\*\*Requirements\*\*:\s*(.+?)\s*$/
SUCCESS_HEADER  = /^\*\*Success Criteria\*\*/
SUCCESS_ITEM    = /^\s+\d+\.\s+(.+?)\s*$/
DIRECTIVE       = /^\*\*/
```

`src/parsers/state.ts`:

```
POSITION    = /^Phase:\s+(\d+(?:\.\d+)?)\s+of\s+\d+\s+\((.+?)\)\s*$/
LAST_ACT    = /^Last activity:\s+(.+?)\s*$/
ISO_OR_DATE = /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}[^\s"]*)?)/
```

Every regex is linear: no nested quantifiers `(x+)+`, no `.*` followed by `.*`. All branches
use a single quantifier per match group.

## Verification

- `npm test` → 31 passing (compile + Mocha):
  - `parseRoadmap — canonical` 9 passing
  - `parseRoadmap — robustness (PARS-03)` 6 passing
  - `parseState — canonical` 8 passing
  - `parseState — robustness (PARS-03)` 6 passing
  - `PARS-05 — stress / catastrophic backtracking guard` 2 passing
  - Total runtime: ~5ms

```
  31 passing (5ms)
```

- `grep "from 'vscode'" src/parsers/ src/test/parsers/` — no matches.
- Decimal phase support proven in both parsers (`### Phase 2.1:` → `'2.1'`;
  `Phase: 2.1 of 6 (…)` → `'2.1'`).
- Body-wins-over-frontmatter precedence for `last_activity` asserted in test.

## TDD Commit Log Excerpt

```
6cb35cf test(02-02): add PARS-05 stress guard and gate phase
7d50903 feat(02-02): implement parseState
20e6847 test(02-02): add failing tests for parseState
5537a4d feat(02-02): implement parseRoadmap
21abc14 test(02-02): add failing tests for parseRoadmap
```

RED commits (`21abc14`, `20e6847`) precede their GREEN counterparts (`5537a4d`, `7d50903`)
as required by the acceptance criteria. No REFACTOR commit was needed — first GREEN was
already linear and constants were hoisted from the start.

## Deviations from Plan

None. RESEARCH.md Pattern 1 / Pattern 2 implementations matched the plan exactly. The only
notable implementation detail not explicitly in the plan was the fixture path resolution:
tests compile to `out/test/parsers/` while fixtures live under `src/test/parsers/fixtures/`,
so each test resolves the fixtures directory by walking three levels up from `__dirname` and
descending back into `src/test/parsers/fixtures`. This is a test-harness concern, not a
parser concern.

## Decisions Made

- Resolve fixtures from `path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'parsers', 'fixtures')` —
  works under both `npx mocha` direct invocation and `npm test`.
- `parseRoadmap` only writes `projectName` / `milestoneLabel` if they have not yet been set
  AND no phase has been opened. This makes the top-of-file capture intent explicit and
  prevents stray H1 lines later in the document from clobbering the title.
- `parseState` body `Last activity:` always wins over frontmatter `last_activity:` — body
  is the most-recent observation; frontmatter is fallback only when body line is absent.

## Known Stubs

None.

## Self-Check: PASSED

- `src/parsers/roadmap.ts` — FOUND
- `src/parsers/state.ts` — FOUND
- `src/test/parsers/roadmap.test.ts` — FOUND
- `src/test/parsers/state.test.ts` — FOUND
- `src/test/parsers/stress.test.ts` — FOUND
- Commits `21abc14`, `5537a4d`, `20e6847`, `7d50903`, `6cb35cf` — all present in `git log`.
- RED-before-GREEN order verified for both Task 1 and Task 2.

## Commits

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 — parseRoadmap RED | `21abc14` | test |
| 1 — parseRoadmap GREEN | `5537a4d` | feat |
| 2 — parseState RED | `20e6847` | test |
| 2 — parseState GREEN | `7d50903` | feat |
| 3 — PARS-05 stress guard | `6cb35cf` | test |
