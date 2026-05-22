# Phase 2: Parsers + Tests - Research

**Researched:** 2026-05-20
**Domain:** TypeScript line-scanner parsers + pure-Node Mocha tests
**Confidence:** HIGH

## Summary

Phase 2 delivers two pure parser modules (`src/parsers/roadmap.ts`, `src/parsers/state.ts`) and shared types (`src/parsers/types.ts`) that read raw markdown text and return typed `RoadmapData` / `StateData`. Parsers must be importable from plain Node — zero `vscode` imports — so unit tests run without the Extension Development Host. The chosen test harness is `@vscode/test-cli` + Mocha for the extension-host suite later, but Phase 2's parser tests run as **plain Mocha** via `mocha out/test/parsers/**/*.test.js`. This is the canonical pattern recommended by Microsoft and used by every major TS-only VS Code extension.

The current Phase 1 `parseLite` (in `src/extension.ts`) is intentionally to be **replaced wholesale** — its decisions about milestone resolution precedence and "active phase = first non-done `### Phase N` header" are the load-bearing patterns the new parser must preserve.

**Primary recommendation:** Hand-rolled `splitLines()`-based scanners with one regex per field, bounded by line-by-line iteration (no multi-line greedy patterns). Test runner is a vanilla `mocha` invocation against compiled JS in `out/test/`. Add `@vscode/test-cli` config only as a stub for future extension-host tests in Phase 3+.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked — entire phase is "Claude's Discretion" with guidance.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Guidance:
- Hand-rolled regex / line scanner per PROJECT.md tech stack (no markdown-it, no remark).
- Parser modules live under `src/parsers/` (roadmap.ts, state.ts) with shared types in `src/parsers/types.ts`.
- Tests use Mocha (the `@vscode/test-cli` test framework) but run as pure Node — no extension host needed for parser tests. Place under `src/test/parsers/` or `test/parsers/`; whichever fits existing scaffolding.
- Both parsers must tolerate missing fields, partial files, CRLF/LF endings.
- Include a stress test with pathological regex input asserting <100ms — guards against catastrophic backtracking.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARS-01 | Pure ROADMAP.md parser returning typed `RoadmapData` (project name, phases with `name`, `goal`, `mode`, `successCriteria`, source line numbers) — zero `vscode` imports | Grammar inventoried below (Architecture > ROADMAP grammar); types defined in Standard Stack > Module shape |
| PARS-02 | Pure STATE.md parser returning typed `StateData` (current milestone, current phase id/name, last entry text + timestamp) — zero `vscode` imports | Grammar inventoried below (Architecture > STATE grammar); types defined in Standard Stack > Module shape |
| PARS-03 | Parsers handle missing fields, partial files, and CRLF/LF line endings without throwing | Common Pitfalls > CRLF/empty/partial; all field reads return `\| undefined` and parser returns a partial object rather than throwing |
| PARS-04 | Unit tests (mocha + @vscode/test-cli) covering canonical, partial, and malformed inputs; no VS Code Extension Development Host required | Validation Architecture section: plain `mocha` invocation against `out/test/parsers/**/*.test.js`; `@vscode/test-cli` config added as stub for Phase 3+ |
| PARS-05 | Parser regex avoids catastrophic backtracking — verified by a stress test with pathological input | Architecture > Linear-time regex rules; stress test pattern in Code Examples |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read ROADMAP.md text → typed phases | Pure Node module (`src/parsers/roadmap.ts`) | — | No I/O, no VS Code API — caller supplies raw string |
| Read STATE.md text → typed state | Pure Node module (`src/parsers/state.ts`) | — | Same — pure function `(text: string) => StateData` |
| Shared type definitions | Pure Node module (`src/parsers/types.ts`) | — | Re-used by Phase 3 `StateController`, Phase 5 TreeView |
| File I/O (read from disk) | NOT in this phase | Phase 3 (`StateController`) | Parsers take strings, not paths — keeps tests trivial |
| Watch files for change | NOT in this phase | Phase 3 (`FileSystemWatcher`) | Out of scope |
| Test execution | Node CLI (`mocha`) | — | Pure parsers ⇒ no extension host needed |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mocha` | `^11.7.5` | Test framework | `@vscode/test-cli` wraps Mocha, so using Mocha directly for pure-Node tests keeps a single test framework across the project. [VERIFIED: npm registry — confirmed in CLAUDE.md tech stack] |
| `@types/mocha` | `^10.0.10` | Mocha type defs | Standard companion. [ASSUMED — version pending `npm view @types/mocha version` at install time] |
| `@vscode/test-cli` | `^0.0.12` | Extension-host test runner (stub config only this phase) | Microsoft-current; defer real use to Phase 3+ when tests touch `vscode.*`. [CITED: CLAUDE.md tech stack] |
| `@vscode/test-electron` | `^2.5.2` | Peer of `@vscode/test-cli` | Required peer. [CITED: CLAUDE.md tech stack] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node built-in `assert/strict` | n/a | Assertions | Zero-dep; `import { strict as assert } from 'node:assert'`. Avoid `chai` — extra dep with no benefit for line-oriented checks. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mocha | `node:test` (built-in) | `node:test` is lighter, but `@vscode/test-cli` only wraps Mocha — using two frameworks splits mental model. Stick with Mocha. |
| `assert/strict` | `chai` | Chai's fluent API is nicer but the parser tests are simple equality checks. Avoid extra dep per CLAUDE.md "no runtime deps" stance. |
| Hand-rolled scanner | `markdown-it` AST | Explicitly forbidden by CLAUDE.md — grammar is narrow and stable. |

**Installation:**
```bash
npm install --save-dev mocha @types/mocha @vscode/test-cli @vscode/test-electron
```

**Version verification:** All four packages were verified during Phase 1 research (see `01-RESEARCH.md` lines 457-469). Re-confirm at install time with `npm view <pkg> version`.

### Module shape (PARS-01, PARS-02)

```typescript
// src/parsers/types.ts
export interface RoadmapPhase {
  number: string;          // "1", "2.1"
  name: string;            // "Scaffold + Minimal Status Bar"
  goal?: string;
  mode?: string;           // "mvp"
  dependsOn?: string;      // "Phase 1" or "Nothing (first phase)"
  requirements?: string[]; // ["SCAF-01", "SCAF-02"]
  successCriteria?: string[];
  done: boolean;           // from bullet checklist "- [x]"
  headerLine: number;      // 1-based, points at "### Phase N: ..."
  endLine: number;         // 1-based, exclusive: next `### ` or EOF
}

export interface RoadmapData {
  projectName?: string;        // from H1, prefix/suffix stripped
  milestoneLabel?: string;     // from "## Milestone vX.Y ..." if present
  phases: RoadmapPhase[];
}

export interface StateEntry {
  text: string;
  timestamp?: string;          // ISO string or YYYY-MM-DD if present
  raw: string;                 // original line(s) for tooltip rendering
}

export interface StateData {
  milestone?: string;          // from frontmatter `milestone:` or body
  milestoneName?: string;
  phaseNumber?: string;        // from "Phase: N of M (...)"
  phaseName?: string;
  lastEntry?: StateEntry;
  lastUpdated?: string;        // ISO from frontmatter `last_updated:`
  status?: string;             // frontmatter `status:`
}
```

```typescript
// src/parsers/roadmap.ts
import type { RoadmapData } from './types.js';
export function parseRoadmap(text: string): RoadmapData { /* ... */ }
```

```typescript
// src/parsers/state.ts
import type { StateData } from './types.js';
export function parseState(text: string): StateData { /* ... */ }
```

Both functions are **pure** (string in, object out), **total** (never throw), and **deterministic**.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| mocha | npm | ~14 yrs | ~10M/wk | github.com/mochajs/mocha | not run (offline) | Approved — used by Phase 1 RESEARCH and CLAUDE.md |
| @types/mocha | npm | DefinitelyTyped | ~8M/wk | github.com/DefinitelyTyped/DefinitelyTyped | not run | Approved |
| @vscode/test-cli | npm | Microsoft | high | github.com/microsoft/vscode-test-cli | not run | Approved — official |
| @vscode/test-electron | npm | Microsoft | high | github.com/microsoft/vscode-test | not run | Approved — official |

*slopcheck not available in this environment; all four packages are Microsoft-owned or canonical OSS already vetted in Phase 1 research. No new ecosystem risk introduced.*

## Architecture Patterns

### System Architecture (Phase 2 scope)

```
┌──────────────────────────────────────────────────────────────┐
│  Caller (Phase 1 extension.ts now, Phase 3 StateController)  │
└────────────────────────┬─────────────────────────────────────┘
                         │ raw string (fs.readFile result)
                         ▼
                 ┌───────────────────┐
                 │  splitLines(text) │  normalizes CRLF→LF, returns string[]
                 └─────────┬─────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────────┐       ┌─────────────────┐
     │ parseRoadmap()  │       │ parseState()    │
     │  - scanH1       │       │  - frontmatter  │
     │  - scanMilestone│       │  - position blk │
     │  - scanPhases   │       │  - lastEntry    │
     └────────┬────────┘       └────────┬────────┘
              │ RoadmapData             │ StateData
              ▼                         ▼
            (consumer: status bar, tree view, tooltip)
```

### Recommended Project Structure
```
src/
├── extension.ts                # Phase 1 — parseLite still inline (Phase 3 will swap)
├── parsers/
│   ├── types.ts                # NEW — RoadmapData, StateData, RoadmapPhase, StateEntry
│   ├── roadmap.ts              # NEW — parseRoadmap(text): RoadmapData
│   ├── state.ts                # NEW — parseState(text): StateData
│   └── lines.ts                # NEW — splitLines(text), stripFrontmatter(lines)
└── test/
    └── parsers/
        ├── roadmap.test.ts     # NEW — canonical, partial, malformed, CRLF, stress
        ├── state.test.ts       # NEW — same matrix
        ├── fixtures/
        │   ├── canonical-roadmap.md     # copy of real .planning/ROADMAP.md
        │   ├── canonical-state.md       # copy of real .planning/STATE.md
        │   ├── minimal-roadmap.md       # just H1 + one phase header
        │   ├── crlf-roadmap.md          # CRLF-only line endings
        │   ├── partial-roadmap.md       # phase header with no Goal:/Mode:
        │   ├── malformed-state.md       # no frontmatter, no Position block
        │   └── empty.md                 # zero bytes
        └── stress.test.ts      # NEW — PARS-05 catastrophic-backtrack guard
.vscode-test.mjs                # NEW — stub config for @vscode/test-cli (Phase 3+)
```

### Pattern 1: Single-pass line scanner with section state

**What:** Iterate `lines` once; track current phase via a small `section` state machine; emit phases as `### Phase N:` headers are encountered.

**When to use:** Always — the only sane way to scan markdown with line-anchored fields.

**Example:**
```typescript
// src/parsers/roadmap.ts
const H1 = /^#\s+(.+?)\s*$/;
const MILESTONE = /^##\s+Milestone\s+(v\d+(?:\.\d+)?[^\r\n]*)$/;
const PHASE_HEADER = /^###\s+Phase\s+(\d+(?:\.\d+)?):\s+(.+?)\s*$/;
const DONE_BULLET = /^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/;
const GOAL_LINE = /^\*\*Goal\*\*:\s*(.+?)\s*$/;
const MODE_LINE = /^\*\*Mode:\*\*\s*(.+?)\s*$/;
const DEPENDS_LINE = /^\*\*Depends on\*\*:\s*(.+?)\s*$/;
const REQS_LINE = /^\*\*Requirements\*\*:\s*(.+?)\s*$/;
const SC_HEADER = /^\*\*Success Criteria\*\*.*$/;
const SC_ITEM = /^\s+\d+\.\s+(.+?)\s*$/;

export function parseRoadmap(text: string): RoadmapData {
  const lines = text.split(/\r?\n/);
  const doneNumbers = new Set<string>();
  // First pass: collect done bullets
  for (const ln of lines) {
    const m = DONE_BULLET.exec(ln);
    if (m) doneNumbers.add(m[1]);
  }
  // Second pass: H1, Milestone, Phases
  let projectName: string | undefined;
  let milestoneLabel: string | undefined;
  const phases: RoadmapPhase[] = [];
  let current: RoadmapPhase | null = null;
  let inSuccess = false;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!projectName) {
      const h1 = H1.exec(ln);
      if (h1) projectName = stripProjectName(h1[1]);
    }
    if (!milestoneLabel) {
      const ms = MILESTONE.exec(ln);
      if (ms) milestoneLabel = ms[1].trim();
    }
    const ph = PHASE_HEADER.exec(ln);
    if (ph) {
      if (current) { current.endLine = i; phases.push(current); }
      current = {
        number: ph[1],
        name: ph[2].trim(),
        done: doneNumbers.has(ph[1]),
        headerLine: i + 1,
        endLine: lines.length,
      };
      inSuccess = false;
      continue;
    }
    if (!current) continue;
    const g = GOAL_LINE.exec(ln);   if (g) { current.goal = g[1]; continue; }
    const md = MODE_LINE.exec(ln);  if (md) { current.mode = md[1]; continue; }
    const dp = DEPENDS_LINE.exec(ln); if (dp) { current.dependsOn = dp[1]; continue; }
    const rq = REQS_LINE.exec(ln);  if (rq) { current.requirements = rq[1].split(/,\s*/); continue; }
    if (SC_HEADER.test(ln)) { inSuccess = true; current.successCriteria = []; continue; }
    if (inSuccess) {
      const item = SC_ITEM.exec(ln);
      if (item) current.successCriteria!.push(item[1]);
      else if (ln.trim() === '' || /^\*\*/.test(ln)) inSuccess = false;
    }
  }
  if (current) phases.push(current);
  return { projectName, milestoneLabel, phases };
}
```

### Pattern 2: STATE.md frontmatter + position-block scan

```typescript
// src/parsers/state.ts
const FM_OPEN = /^---\s*$/;
const POSITION = /^Phase:\s+(\d+(?:\.\d+)?)\s+of\s+\d+\s+\((.+?)\)\s*$/;
const LAST_ACT = /^Last activity:\s+(.+?)\s*$/;
const FM_KV = /^([a-z_]+):\s*(.+?)\s*$/;
const ISO_OR_DATE = /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}[^\s"]*)?)/;

export function parseState(text: string): StateData {
  const lines = text.split(/\r?\n/);
  const fm = readFrontmatter(lines);   // returns Map<string,string> or empty
  const out: StateData = {
    milestone: fm.get('milestone'),
    milestoneName: fm.get('milestone_name'),
    status: fm.get('status'),
    lastUpdated: stripQuotes(fm.get('last_updated')),
  };
  for (const ln of lines) {
    const p = POSITION.exec(ln);
    if (p) { out.phaseNumber = p[1]; out.phaseName = p[2]; }
    const la = LAST_ACT.exec(ln);
    if (la) {
      const raw = la[1];
      const ts = ISO_OR_DATE.exec(raw)?.[1];
      out.lastEntry = { text: raw, timestamp: ts, raw };
    }
  }
  // Frontmatter `last_activity:` as fallback for lastEntry
  if (!out.lastEntry && fm.get('last_activity')) {
    const raw = fm.get('last_activity')!;
    out.lastEntry = { text: raw, timestamp: ISO_OR_DATE.exec(raw)?.[1], raw };
  }
  return out;
}
```

### Anti-Patterns to Avoid
- **Multi-line greedy regex**: Never `text.match(/### Phase.*?(?=###|$)/s)`. Use line iteration; `.*?` with `s` flag is the textbook catastrophic-backtracking surface.
- **Throwing on missing fields**: Return partial data. The status bar's "Parse error" state is reserved for malformed grammar that breaks the line iterator, not for a missing `**Goal:**`.
- **Single regex on the whole file**: Splits into a single megacapture; impossible to debug, brittle to whitespace.
- **Reading from disk inside the parser**: Phase 3 owns I/O. Parsers receive strings.
- **Importing `vscode`**: Breaks pure-Node test execution. PARS-01/02 explicit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter parsing | full YAML parser | Tiny KV scanner between `---` fences (frontmatter is flat scalars) | STATE.md frontmatter has no nested structures — only `key: value` pairs. Pulling in `js-yaml` is overkill for ~10 keys. |
| Markdown AST | markdown-it / remark | Line scanner | Explicit CLAUDE.md prohibition. |
| Test framework | custom runner | Mocha | Standard, paired with `@vscode/test-cli`. |

**Key insight:** The single dependency we cannot reasonably hand-roll is the test framework. Everything else — frontmatter, headers, bullet lists — is line-oriented and trivially scanned.

## Runtime State Inventory

Not applicable — this phase adds new code only; no rename/refactor/migration. Phase 1's inline `parseLite` is NOT removed in Phase 2 (extension.ts still works); Phase 3 will swap to the new parser. No runtime state at risk.

## Common Pitfalls

### Pitfall 1: CRLF/LF inconsistency
**What goes wrong:** Splitting on `'\n'` leaves trailing `\r` in regex matches; `^...$` anchors then fail.
**Why it happens:** Windows-authored files use CRLF. Git's `autocrlf` setting varies.
**How to avoid:** Always split with `/\r?\n/`. Never split with the literal string `'\n'`.
**Warning signs:** Tests pass on dev machine, fail in CI with a different `autocrlf` setting.

### Pitfall 2: Empty / partial files
**What goes wrong:** Reading a zero-byte file or a file truncated mid-write throws or yields undefined fields.
**Why it happens:** STATE.md is rewritten by GSD; a watcher event can fire mid-write.
**How to avoid:** All field accessors return `T | undefined`. `parseRoadmap("")` returns `{ phases: [] }`. `parseState("")` returns `{}`.
**Warning signs:** Stack traces from `undefined.match` or `Cannot read property '1' of null`.

### Pitfall 3: Frontmatter with quoted ISO timestamps
**What goes wrong:** `last_updated: "2026-05-20T20:31:23.470Z"` — naively stripping the value leaves quotes.
**Why it happens:** YAML allows but does not require quoting; GSD's emitter quotes some scalars.
**How to avoid:** Strip a single matching pair of leading/trailing `"` or `'` from frontmatter values before use.

### Pitfall 4: Decimal phase numbers
**What goes wrong:** Regex `Phase\s+(\d+)` rejects "Phase 2.1".
**Why it happens:** GSD supports decimal phase numbers (per ROADMAP.md "Phase Numbering" note).
**How to avoid:** Always use `(\d+(?:\.\d+)?)`. Phase 1's `parseLite` already does this — preserve the pattern.

### Pitfall 5: Done-detection split across two lines
**What goes wrong:** `### Phase 1: ...` header alone doesn't say "done"; the bullet list `- [x] **Phase 1: ...**` carries completion state.
**Why it happens:** GSD ROADMAP.md tracks completion on the **bullet**, not the header (WR-01 in Phase 1 plan).
**How to avoid:** Two-pass scan — first pass populates `doneNumbers: Set<string>` from bullets; second pass attaches `done` to phases. Phase 1's `parseLite` codifies this; replicate.

### Pitfall 6: Catastrophic backtracking
**What goes wrong:** A pathological input (e.g., 10,000 leading spaces, or "Phase " repeated) takes seconds to match.
**Why it happens:** Nested quantifiers like `(a+)+` or `.*.*`.
**How to avoid:** **Linear regex only.** No nested quantifiers, no `.*` followed by `.*`, no `.*?` with multiline flag. All regex above use one quantifier per branch.

## Code Examples

### Stress test pattern (PARS-05)

```typescript
// src/test/parsers/stress.test.ts
import { strict as assert } from 'node:assert';
import { parseRoadmap } from '../../parsers/roadmap.js';
import { parseState } from '../../parsers/state.js';

describe('parser stress (PARS-05)', () => {
  it('parseRoadmap finishes <100ms on pathological input', () => {
    const evil =
      '#'.repeat(50_000) + '\n' +
      ('### Phase 1: ' + 'x'.repeat(10_000) + '\n').repeat(100) +
      ('- [x] **Phase ' + '9'.repeat(1000) + ': nope\n').repeat(100) +
      '*'.repeat(50_000);
    const t0 = performance.now();
    const out = parseRoadmap(evil);
    const dt = performance.now() - t0;
    assert.ok(dt < 100, `parseRoadmap took ${dt.toFixed(1)}ms`);
    assert.ok(Array.isArray(out.phases));
  });

  it('parseState finishes <100ms on pathological input', () => {
    const evil = '---\n' + 'a'.repeat(50_000) + '\n---\n' +
      ('Phase: ' + '1'.repeat(1000) + ' of 9 (x)\n').repeat(100);
    const t0 = performance.now();
    parseState(evil);
    const dt = performance.now() - t0;
    assert.ok(dt < 100, `parseState took ${dt.toFixed(1)}ms`);
  });
});
```

### Canonical fixture test

```typescript
// src/test/parsers/roadmap.test.ts
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseRoadmap } from '../../parsers/roadmap.js';

describe('parseRoadmap — canonical', () => {
  const text = readFileSync(
    path.join(__dirname, 'fixtures/canonical-roadmap.md'), 'utf8');
  const data = parseRoadmap(text);

  it('extracts project name', () => {
    assert.equal(data.projectName, 'GSD Status — VS Code Extension');
  });
  it('finds all six phases', () => {
    assert.equal(data.phases.length, 6);
  });
  it('marks Phase 1 done', () => {
    assert.equal(data.phases[0].done, true);
  });
  it('Phase 2 has goal, mode, requirements, success criteria', () => {
    const p2 = data.phases[1];
    assert.match(p2.goal!, /Pure parser modules/);
    assert.equal(p2.mode, 'mvp');
    assert.deepEqual(p2.requirements, ['PARS-01','PARS-02','PARS-03','PARS-04','PARS-05']);
    assert.equal(p2.successCriteria!.length, 5);
  });
});

describe('parseRoadmap — robustness (PARS-03)', () => {
  it('empty string returns empty phases', () => {
    assert.deepEqual(parseRoadmap('').phases, []);
  });
  it('CRLF normalizes correctly', () => {
    const out = parseRoadmap('# Title\r\n### Phase 1: Hello\r\n');
    assert.equal(out.phases[0].name, 'Hello');
  });
  it('phase with no Goal/Mode does not throw', () => {
    const out = parseRoadmap('### Phase 1: bare\n');
    assert.equal(out.phases[0].goal, undefined);
  });
});
```

### Test wiring in package.json

```jsonc
{
  "scripts": {
    "compile": "tsc -p .",
    "watch": "tsc -w -p .",
    "test": "npm run compile && mocha \"out/test/parsers/**/*.test.js\"",
    "test:parsers": "mocha \"out/test/parsers/**/*.test.js\"",
    "package:vsix": "vsce package"
  }
}
```

**Why a separate `test:parsers` script:** Phase 3 will add `test:host` for `@vscode/test-cli`-driven tests. `npm test` will then chain both. Keeping them split keeps Phase 2 trivially runnable in pure Node.

### tsconfig adjustment (minimal)

The current tsconfig has `rootDir: "src"` and `outDir: "out"`. Adding `src/test/parsers/*.test.ts` requires no changes — it stays under `rootDir`. Ensure the test files compile to `out/test/parsers/*.test.js`. **Do NOT add a separate `tsconfig.test.json`** — single tsconfig is simpler and still correct.

### Canonical ROADMAP.md grammar (from real `.planning/ROADMAP.md`)

```
# Roadmap: <project name>            <- H1; strip "Roadmap: " prefix
## Overview                           <- ignored
## Phases                             <- contains "- [x] **Phase N: name** - desc" bullets
- [x] **Phase 1: name** - description
- [ ] **Phase 2: name** - description
## Phase Details                      <- ignored as section header
### Phase N: Name                     <- phase block start
**Goal**: ...                         <- one line
**Mode:** mvp                         <- one line  (note: "Mode:**" colon inside)
**Depends on**: Phase N | Nothing     <- one line
**Requirements**: REQ-01, REQ-02, ... <- comma-separated
**Success Criteria** (what must be TRUE):
  1. First criterion
  2. Second criterion
**Plans**: 2 plans                    <- ignored in Phase 2
- [x] 01-01-PLAN.md — description     <- ignored
**UI hint**: yes                      <- ignored
### Phase N+1: ...                    <- next phase block
## Progress                           <- ends phase blocks
```

### Canonical STATE.md grammar (from real `.planning/STATE.md`)

```
---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: <text>
last_updated: "2026-05-20T20:31:23.470Z"
last_activity: 2026-05-20 — <description>
progress:                            <- nested; skip safely
  total_phases: 6
  ...
---

# Project State
## Current Position
Phase: 1 of 6 (Scaffold + Minimal Status Bar)   <- canonical position line
Plan: 2 of 2 in current phase (complete)
Status: <free text>
Last activity: 2026-05-20 — <description>       <- canonical "last entry" line
```

The `last_activity:` frontmatter and the body `Last activity:` line carry the same content; either is acceptable for `StateData.lastEntry`. Prefer the body line (richer formatting); fall back to frontmatter.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `runTest.ts` + `@vscode/test-electron` only | `@vscode/test-cli` + `.vscode-test.mjs` config | 2024 | Less boilerplate; supports pure-Node parser tests by running `mocha` directly |
| `tsc` + custom mocha config | Compiled-output testing (`mocha out/**/*.test.js`) | Stable | Avoids ts-node/tsx in test path; matches VS Code extension toolchain |

**Deprecated/outdated:**
- `ts-node`/`tsx` for test execution: unnecessary; just compile with `tsc` and run JS. Adds zero value for parser tests.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@types/mocha` current is `^10.0.10` | Standard Stack | Low — `npm view` at install corrects it |
| A2 | STATE.md `last_activity:` body line is preferable to frontmatter `last_activity:` for tooltip rendering | Architecture > STATE grammar | Low — either source produces the same string in current STATE.md |
| A3 | Frontmatter has no nested keys we care about (we skip `progress:` block) | Code Examples > parseState | Medium — if a future STATE.md adds a needed nested key, the simple KV scanner misses it. Acceptable for v1. |

## Open Questions

1. **Should `StateData.lastEntry.timestamp` be ISO or Date?**
   - What we know: Phase 4 tooltip will render it; STATE.md emits both `YYYY-MM-DD` (body) and ISO (frontmatter).
   - What's unclear: Whether downstream wants a `Date` object.
   - Recommendation: Keep as `string` (preserve original format). Phase 4 can `new Date(s)` if it wants relative rendering.

2. **Should `parseRoadmap` populate `phases[i].requirements` as raw strings or split into objects?**
   - What we know: REQUIREMENTS.md is owned by a separate file we don't parse this phase.
   - What's unclear: Whether Phase 5 TreeView wants the requirement description joined in.
   - Recommendation: Strings now (e.g., `"PARS-01"`). Phase 5 can join later if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + test | ✓ | (>=20, per CLAUDE.md) | — |
| npm | Install deps | ✓ | bundled with Node | — |
| TypeScript (`tsc`) | Build | ✓ | already in devDependencies | — |
| mocha | Test runner | ✗ (not yet installed) | — | none — installs in plan |
| @vscode/test-cli | Phase 3+ host tests | ✗ | — | none needed for Phase 2 parser tests |

**Missing dependencies with no fallback:** mocha — install step is the first task of any plan.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha 11 (compiled JS, run via `mocha out/test/parsers/**/*.test.js`) |
| Config file | none — flag-driven; consider `.mocharc.json` only if config grows |
| Quick run command | `npm run test:parsers` |
| Full suite command | `npm test` (compile + parser tests this phase; adds host tests Phase 3+) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARS-01 | `parseRoadmap` returns typed `RoadmapData` on canonical input | unit | `mocha out/test/parsers/roadmap.test.js` | Wave 0 — `src/test/parsers/roadmap.test.ts` + canonical fixture |
| PARS-02 | `parseState` returns typed `StateData` on canonical input | unit | `mocha out/test/parsers/state.test.js` | Wave 0 — `src/test/parsers/state.test.ts` + canonical fixture |
| PARS-03 | Both parsers tolerate CRLF, empty, partial, malformed inputs | unit | `npm run test:parsers` | Wave 0 — robustness `describe` blocks in both test files |
| PARS-04 | Tests run without VS Code Extension Development Host | unit (smoke) | `npm run test:parsers` succeeds without `code` CLI | Wave 0 — no `vscode` import in parser modules grep check |
| PARS-05 | Stress test completes <100ms on pathological input | perf-unit | `mocha out/test/parsers/stress.test.js` | Wave 0 — `src/test/parsers/stress.test.ts` |

### Sampling Rate
- **Per task commit:** `npm run test:parsers`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green + verification grep `! grep -r "from 'vscode'" src/parsers/` returns nothing

### Wave 0 Gaps
- [ ] `package.json` — add `mocha`, `@types/mocha`, `@vscode/test-cli`, `@vscode/test-electron` to devDependencies; add `test` and `test:parsers` scripts
- [ ] `src/parsers/types.ts` — type definitions
- [ ] `src/parsers/lines.ts` — `splitLines`, frontmatter helper
- [ ] `src/parsers/roadmap.ts` — `parseRoadmap`
- [ ] `src/parsers/state.ts` — `parseState`
- [ ] `src/test/parsers/fixtures/` — six fixture files listed in Project Structure
- [ ] `src/test/parsers/roadmap.test.ts`
- [ ] `src/test/parsers/state.test.ts`
- [ ] `src/test/parsers/stress.test.ts`
- [ ] `.vscode-test.mjs` — stub config (one line, exports `defineConfig({files: 'out/test/host/**/*.test.js'})`) — wired but unused until Phase 3
- [ ] tsconfig: confirm `src/test/**` is included (already covered by `src/**/*`)
- [ ] `.vscodeignore`: ensure `out/test/**` and `src/test/**` are excluded from the packaged .vsix (Phase 6 also re-checks)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — read-only parser, no users |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a — caller controls file access |
| V5 Input Validation | yes | Treat parser input as untrusted text; linear regex; total functions (never throw) |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for hand-rolled markdown parser

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Catastrophic backtracking DoS | Denial-of-Service | Linear-time regex (no nested quantifiers); PARS-05 stress test enforces <100ms |
| Exception leaking from parser to caller | DoS (host crash) | All field reads guarded; functions are total |
| Memory exhaustion on huge files | DoS | Single-pass scan, `O(n)` memory; if file > ~10 MB consider future streaming (deferred) |

## Sources

### Primary (HIGH confidence)
- `.planning/REQUIREMENTS.md` — PARS-01..05 exact wording
- `.planning/ROADMAP.md` — canonical phase grammar (lines 22-103)
- `.planning/STATE.md` — canonical frontmatter + position-block grammar (lines 1-30)
- `src/extension.ts` — Phase 1 `parseLite` regex shapes and milestone precedence (to preserve)
- `CLAUDE.md` — locks tech stack (mocha, @vscode/test-cli, no markdown-it, no chokidar, hand-rolled scanner)
- `.planning/phases/01-scaffold-minimal-status-bar/01-RESEARCH.md` — Phase 2 framing notes (lines 457, 469, 545, 573, 586, 597)
- `.planning/phases/01-scaffold-minimal-status-bar/01-02-SUMMARY.md` — Phase 1 patterns to inherit (WR-01 two-pass done detection, decimal phase numbers, linear regex)

### Secondary (MEDIUM confidence)
- VS Code Extension Testing docs — `@vscode/test-cli` wraps Mocha (CLAUDE.md cites)

### Tertiary (LOW confidence)
- None — every claim here is grounded in either an in-repo file or CLAUDE.md.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries previously verified in Phase 1 RESEARCH
- Architecture: HIGH — grammars inspected directly in `.planning/ROADMAP.md` and `.planning/STATE.md`
- Pitfalls: HIGH — Phase 1's `parseLite` already encodes the same hazards (CRLF, decimal phases, two-pass done)

**Research date:** 2026-05-20
**Valid until:** 2026-06-19 (30 days — stable grammar, stable libraries)
