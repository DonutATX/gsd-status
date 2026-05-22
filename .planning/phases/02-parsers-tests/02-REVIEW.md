---
phase: 02-parsers-tests
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/parsers/types.ts
  - src/parsers/lines.ts
  - src/parsers/roadmap.ts
  - src/parsers/state.ts
  - src/test/parsers/roadmap.test.ts
  - src/test/parsers/state.test.ts
  - src/test/parsers/stress.test.ts
  - package.json
  - .vscode-test.mjs
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: findings_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 9
**Status:** findings_found

## Summary

Parser modules are clean, total, deterministic, and properly isolated from the
`vscode` API (PARS-04 satisfied). Regex set is linear with no nested
quantifiers; the PARS-05 stress test confirms <100ms on pathological input.

The defects below are real but limited: a heading-grammar inconsistency that
makes `**Goal**` parsing fragile against the canonical convention documented
in CLAUDE.md, a missing dev-dep that breaks `npm run package:vsix`, and
several robustness/coverage gaps. No security issues, no critical bugs.

## Warnings

### WR-01: `**Goal**:` vs `**Goal:**` grammar mismatch (fragile parser)

**File:** `src/parsers/roadmap.ts:17`
**Issue:** The Goal regex is `^\*\*Goal\*\*:\s*(.+?)\s*$` (colon OUTSIDE the
bold markers), but every other directive in the same file uses the
`**Key:**` form (colon INSIDE), e.g. `MODE`, `DEPENDS_ON`, `REQUIREMENTS`.
The GSD planning convention and the rest of the codebase (STATE.md examples,
roadmap research notes) consistently produce `**Goal:**`. The current parser
only succeeds because the test fixture happens to be authored in the
non-standard `**Goal**:` form. The first real ROADMAP.md that uses
`**Goal:**` (the canonical GSD style) will silently produce
`goal: undefined`.
**Fix:**
```ts
const GOAL = /^\*\*Goal:\*\*\s*(.+?)\s*$/;
```
Then update the fixture and the canonical-test assertion accordingly, OR
accept both forms:
```ts
const GOAL = /^\*\*Goal(?::\*\*|\*\*:)\s*(.+?)\s*$/;
```

### WR-02: `npm run package:vsix` will fail — `@vscode/vsce` not in devDependencies

**File:** `package.json:35`
**Issue:** Script `"package:vsix": "vsce package"` invokes the `vsce` binary,
but `@vscode/vsce` is absent from `devDependencies`. Running the script in
CI or on a fresh clone errors with `vsce: command not found`. CLAUDE.md
explicitly lists `@vscode/vsce ^3.9.1` as required.
**Fix:** Add to devDependencies:
```json
"@vscode/vsce": "^3.9.1"
```
Or change the script to `npx --package @vscode/vsce -- vsce package` if you
want to avoid the install.

### WR-03: Unsafe `as string` assertion masks the real type

**File:** `src/parsers/state.ts:67`
**Issue:** `stripQuotes(fmLastActivity) as string` — `stripQuotes` returns
`string | undefined`. The cast is technically safe today because the
overload returns `string` when given a `string`, but the function signature
is not overloaded and TypeScript widens to `string | undefined`. The `as`
cast silences strict-mode checking and will hide a real bug if `stripQuotes`
is ever changed to return `undefined` for an unquoted-but-empty value.
**Fix:**
```ts
const stripped = stripQuotes(fmLastActivity);
data.lastEntry = buildEntry(stripped ?? fmLastActivity);
```
Or add a string overload to `stripQuotes` so the cast becomes unnecessary.

## Info

### IN-01: `DONE_BULLET` regex accepts unclosed `**`

**File:** `src/parsers/roadmap.ts:12`
**Issue:** `/^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/` does not require
a closing `**`. Malformed lines like `- [x] **Phase 3` with no terminator
are matched and treated as "done", silently polluting the `done` Set.
The stress test exploits this (intentionally or not) on line 16.
**Fix:** Anchor the closing bold marker or at least a `:`:
```ts
const DONE_BULLET = /^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)[:\s]/;
```

### IN-02: `MILESTONE` regex requires literal `v` prefix

**File:** `src/parsers/roadmap.ts:15`
**Issue:** `/^##\s+Milestone\s+(v\d+(?:\.\d+)?[^\r\n]*)$/` will not match
`## Milestone 1.0` or `## Milestone M1 — Foundation`. CLAUDE.md does not
mandate the `v` prefix; the GSD ↔ GitHub convention does (`vX.Y`), so this
is acceptable today — but worth flagging because no test asserts a missing-
`v` milestone returns `undefined`, so a future format drift will be silent.
**Fix:** Either widen the pattern to `(v?\d+(?:\.\d+)?...)` or add a
negative test asserting current behavior so the constraint is explicit.

### IN-03: BOM on line 0 defeats frontmatter detection

**File:** `src/parsers/lines.ts:32`
**Issue:** `if (lines[0] === '---')` uses strict equality. A file saved
with a UTF-8 BOM (`﻿`) will have `lines[0] === '﻿---'` and
frontmatter is skipped entirely — silently dropping milestone, status,
last_updated. VS Code on Windows occasionally produces BOM-prefixed files.
**Fix:** Strip a leading BOM before comparison:
```ts
const first = lines[0]?.replace(/^﻿/, '');
if (first === '---') { openIdx = 0; }
```

### IN-04: Fall-through after end-of-success-collection is subtle

**File:** `src/parsers/roadmap.ts:96-98`
**Issue:** When `collectingSuccess` is true and the line is blank or a
new directive, the code sets the flag to `false` but does NOT `continue`.
The line then falls through to the GOAL/MODE/DEPENDS_ON/REQUIREMENTS/
SUCCESS_HEADER checks below. Today this is safe (blank lines match
nothing; new directives are correctly re-matched), but the control flow
is non-obvious and a future edit could easily introduce a double-process
bug. Either add an explicit comment or restructure so each line is
classified exactly once.

### IN-05: Coverage gaps vs. behavior contract

**File:** `src/test/parsers/roadmap.test.ts`, `src/test/parsers/state.test.ts`
**Issue:** Several documented behaviors have no test:
- `RoadmapPhase.endLine` — never asserted; bugs in `closeCurrent` would
  not be caught.
- `RoadmapPhase.dependsOn` — no test exercises the `Depends on:` line.
- `[✅]` checkbox variant in `DONE_BULLET` is supported but never asserted.
- `parseState` ISO timestamp extraction is tested only for the `YYYY-MM-DD`
  form; the `T...` extension branch in `ISO_OR_DATE` (state.ts:14) is
  untested.
- No test asserts `done: false` propagates correctly when a phase number
  exists in headers but is absent from the `- [x]` bullet list (the canonical
  fixture covers Phase 2 not-done, but only with the natural test setup).
**Fix:** Add focused unit tests for each item. None block shipping; they
prevent regression.

### IN-06: REQUIREMENTS split does not trim leading whitespace on first item

**File:** `src/parsers/roadmap.ts:118`
**Issue:** `r[1].split(/,\s*/)` handles inter-item space after commas, but
if the value is ` PARS-01, PARS-02 ` the capture group's trailing `\s*$`
in the regex trims the tail; however a leading space before the first item
(e.g., authoring slip `**Requirements**:  PARS-01`) survives because the
capture `(.+?)` is non-greedy and starts at the first non-space implicitly
only because `\s*` precedes it. Verify by reading the regex: `^\*\*Requirements\*\*:\s*(.+?)\s*$`
— the `\s*` before the capture handles this. Actually safe. Logging as INFO
only because the split would still preserve internal whitespace inside
each requirement (e.g., `PARS- 01`) — unlikely in practice. No fix needed
unless you want defensive `.map(s => s.trim()).filter(Boolean)`.

---

## Notes on Things Verified Clean

- **PARS-04 (module isolation):** No `import` of `vscode` in any
  `src/parsers/*.ts` file. Confirmed.
- **PARS-05 (ReDoS):** Every regex in `roadmap.ts`, `state.ts`, and
  `lines.ts` is linear. No nested quantifiers (no `(a+)+`), no
  `.*.*` patterns, no alternation with overlapping prefixes inside a
  repetition. The bounded character class `[^\s"]*` in `ISO_OR_DATE`
  is the most permissive and is still linear. Stress test confirms.
- **Strict-mode compliance:** All exports typed; no implicit `any`; no
  unsafe non-null assertions in production code (the single `as string`
  is flagged in WR-03).
- **Frontmatter robustness:** `readFrontmatter` correctly skips indented
  continuation lines, tolerates missing close fence (loop just ends),
  and returns an empty Map on no-frontmatter input. Aside from IN-03
  (BOM), it is total.
- **CRLF handling:** `splitLines` correctly normalizes; the CRLF test
  in `roadmap.test.ts` and the in-memory CRLF case both pass through
  the same code path.

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Fixes Applied

**Fixed at:** 2026-05-20

| Finding | Status   | Commit    | Notes |
|---------|----------|-----------|-------|
| WR-01   | Fixed    | `914f00f` | Parser accepts both `**Key**:` and `**Key:**` styles for Goal, Mode, Depends on, Requirements. Three tests added. All 34 tests pass. |
| WR-02   | Deferred | -         | Out of Phase 2 scope; `@vscode/vsce` install + `package:vsix` belong to Phase 6 (Packaging + Distribution) per ROADMAP. |
| WR-03   | Fixed    | `17a2f42` | Replaced `as string` cast in `state.ts` with `?? fmLastActivity` nullish-coalesce fallback. All 34 tests pass. |

Info findings (IN-01 through IN-06): not addressed (out of auto-mode scope, none block shipping).
