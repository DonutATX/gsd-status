---
phase: 04-tooltip-commands-configuration
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/extension.ts
  - src/state/controller.ts
  - src/state/relativeTime.ts
  - src/state/tooltip.ts
  - src/test/extension.test.ts
  - src/test/setup/vscode-stub.ts
  - src/test/state/controller.test.ts
  - src/test/state/relativeTime.test.ts
  - src/test/state/tooltip.test.ts
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Status:** issues_found
**Files Reviewed:** 9

## Summary

Re-review after fixes for prior findings CR-01, WR-01, WR-02, WR-03, WR-04.

**Prior findings — all confirmed resolved:**

- **CR-01 (NaN clamp bypass)** — RESOLVED. `controller.ts:141` now coerces
  non-finite input via `Number.isFinite(seconds) ? seconds : 30` before the
  `Math.max(5, …)` clamp.
- **WR-01 (interval ignored at startup)** — RESOLVED. `extension.ts:81-83`
  reads `gsd.refreshIntervalSeconds` and calls `controller.setRefreshInterval`
  during `activate()`.
- **WR-02 (raw markdown injection)** — RESOLVED in production code.
  `tooltip.ts:39` now uses `ms.appendText(state.lastEntry.text)`. See CR-02
  below: the fix introduced a test-stub regression.
- **WR-03 (empty backtick span)** — RESOLVED. `tooltip.ts:34-35` guards the
  absolute-timestamp span behind `const tail = abs ? … : ''`.
- **WR-04 (folder scope ignored)** — RESOLVED. `extension.ts:81,95-96` pass
  `folder?.uri` to both `getConfiguration` and `affectsConfiguration`.

**New issue:** the WR-02 fix changed production code (`appendMarkdown` →
`appendText`) but the test `MarkdownString` stub was not updated to implement
`appendText`. This breaks the `buildOkTooltip` test suite (CR-02).

## Critical Issues

### CR-02: WR-02 fix breaks the tooltip test suite — stub missing `appendText`

**File:** `src/test/setup/vscode-stub.ts:57-61` (and `src/state/tooltip.ts:39`)
**Issue:** The WR-02 fix replaced `ms.appendMarkdown(state.lastEntry.text)`
with `ms.appendText(state.lastEntry.text)` in `tooltip.ts:39`. The bare-Mocha
test stub's `MarkdownString` class implements only `appendMarkdown` and a
`value` getter — it has no `appendText` method:

```ts
class MarkdownString {
  private _value = '';
  appendMarkdown(value: string): this { this._value += value; return this; }
  get value(): string { return this._value; }
}
```

`tooltip.test.ts` exercises `buildOkTooltip` with `MINIMAL_STATE`, which has a
populated `lastEntry`, so every call reaches `tooltip.ts:39` and invokes
`ms.appendText(...)`. Against the stub this throws
`TypeError: ms.appendText is not a function`, failing the entire
`buildOkTooltip` suite (milestone rendering, active-phase rendering, last-entry
rendering — 8+ tests). The fix shipped production code without updating the
test double it depends on, so the suite that should validate the fix instead
crashes. This is a correctness/CI-breaking defect.
**Fix:** Add `appendText` to the stub. To faithfully model VS Code behavior
(`appendText` escapes markdown), escape the input:

```ts
class MarkdownString {
  private _value = '';
  appendMarkdown(value: string): this { this._value += value; return this; }
  appendText(value: string): this {
    // VS Code escapes markdown control chars in appendText.
    this._value += value.replace(/[\\`*_{}[\]()#+\-.!>~|]/g, '\\$&');
    return this;
  }
  get value(): string { return this._value; }
}
```

Note: `tooltip.test.ts:78` asserts `ms.value.includes('Completed scaffolding')`
— that plain text contains no escapable characters, so it still passes. Verify
no other assertion relies on un-escaped entry text.

## Warnings

### WR-05: `appendText` is called with a possibly-undefined value

**File:** `src/state/tooltip.ts:39`
**Issue:** `ms.appendText(state.lastEntry.text)` passes `state.lastEntry.text`
directly. If the `StateData.lastEntry.text` field is typed as optional (or the
Phase 2 state parser can produce a `lastEntry` with an absent `text`), this
passes `undefined` into `appendText`. The real VS Code `appendText` expects a
`string`; `undefined` either throws or renders the literal string
`"undefined"`. The surrounding `if (state.lastEntry)` guard checks the entry
object exists but not that `text` is populated. The test fixture always
supplies a `text`, so this gap is untested.
**Fix:** Guard the field, or default it:
```ts
ms.appendText(state.lastEntry.text ?? '');
```
If the `StateData` type guarantees `text` is always a non-optional string,
this is a no-op — confirm against `src/parsers/types.ts` and downgrade if so.

## Info

### IN-01: "1 days ago" is grammatically incorrect

**File:** `src/state/relativeTime.ts:28`
**Issue:** The `>=24h` bucket always renders `${d} days ago`, producing
"1 days ago" for a one-day-old timestamp. `relativeTime.test.ts:41-44`
asserts this incorrect string, locking in the defect. (Carried over from prior
review — not in the CR-01/WR-01..04 fix scope, still unresolved.)
**Fix:** `return d === 1 ? '1 day ago' : \`${d} days ago\`;` and update the
test expectation.

### IN-02: vscode stub `getConfiguration` ignores the scope argument

**File:** `src/test/setup/vscode-stub.ts:70-72`
**Issue:** Now that WR-04 is fixed, `extension.ts` passes a resource URI as the
second argument to `getConfiguration('gsd', folder?.uri)`. The stub signature
is `getConfiguration: (_section?: string) => …` — it accepts and silently
ignores the resource argument and always returns the supplied default. Tests
pass regardless of whether folder-scoped resolution works, giving false
confidence in the WR-04 fix.
**Fix:** Extend the stub signature to accept the second `scope` argument and,
minimally, document that it is ignored — or model per-folder values if
folder-scoped tests are added.

### IN-03: No test coverage for `setRefreshInterval` value mapping

**File:** `src/test/state/controller.test.ts:139-188`
**Issue:** Every `setRefreshInterval` test asserts only `doesNotThrow`. None
verifies the interval actually changes, that the clamp produces the expected
ms, or — most relevant given the CR-01 fix — that a `NaN`/non-finite input is
coerced to the 30s default. The CR-01 fix is effectively untested; a future
regression that removes the `Number.isFinite` guard would not be caught.
**Fix:** Inject a fake timer (or expose the computed interval for assertion)
and add explicit cases for `setRefreshInterval(NaN)`,
`setRefreshInterval(2)` → 5000ms, and `setRefreshInterval(10)` → 10000ms.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
