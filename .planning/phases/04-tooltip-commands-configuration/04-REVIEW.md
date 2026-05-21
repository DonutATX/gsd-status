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
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 4 wires up the tooltip builders, the three GSD commands, and live config
reload for the refresh interval. The code is clean and well-commented, with
prior review IDs tracked inline. However, two correctness gaps undermine the
phase's stated goal: (1) the user-configured refresh interval is never applied
at startup — it only takes effect after the setting is *changed*, so a project
opened with a custom interval silently runs at the hardcoded 30s default; and
(2) the `setRefreshInterval` clamp that claims to prevent a busy-loop DoS does
not guard against `NaN`, which would defeat the clamp entirely. There is also a
markdown-injection vector in the tooltip that the isTrusted=false comment does
not actually cover.

## Critical Issues

### CR-01: Refresh-interval clamp bypassed by NaN — busy-loop risk

**File:** `src/state/controller.ts:138`
**Issue:** `setRefreshInterval` computes `const ms = Math.max(5, seconds) * 1000`.
The inline comment claims this "prevents busy-loop DoS" (T-04-05). But
`Math.max(5, NaN)` returns `NaN`, and `setInterval(fn, NaN)` is treated by
Node/VS Code as a 0ms (or 1ms) interval — `refresh()` fires continuously,
hammering the filesystem and the editor. `seconds` comes from
`getConfiguration('gsd').get<number>('refreshIntervalSeconds', 30)`; the default
is only returned when the key is *absent*. A user who sets the value to a
non-numeric or otherwise malformed JSON value can produce a non-number, which
flows straight into the clamp. The clamp's whole purpose is defeated.
**Fix:**
```ts
setRefreshInterval(seconds: number): void {
  if (this._disposed) return;
  const safe = Number.isFinite(seconds) ? seconds : 30;
  const ms = Math.max(5, safe) * 1000; // clamp: finite + 5s minimum
  ...
}
```
Apply the same `Number.isFinite` guard at the `extension.ts:84-86` call site.

## Warnings

### WR-01: User-configured refresh interval is ignored at startup

**File:** `src/extension.ts:80-89`
**Issue:** `setRefreshInterval` is only invoked from inside the
`onDidChangeConfiguration` handler. On `activate()`, the controller's
constructor starts a timer at the hardcoded `REFRESH_INTERVAL_MS` (30s). If a
project's `settings.json` already contains
`gsd.refreshIntervalSeconds: 10`, that value is never read until the user edits
the setting again. The phase goal ("configuration") is only half-delivered:
the setting is live-reloadable but not honored on load.
**Fix:** After constructing the controller in `activate()`, read the current
value once and apply it:
```ts
const initialInterval = vscode.workspace.getConfiguration('gsd')
  .get<number>('refreshIntervalSeconds', 30);
controller.setRefreshInterval(initialInterval);
```

### WR-02: Tooltip injects raw STATE.md text as markdown

**File:** `src/state/tooltip.ts:33`
**Issue:** `ms.appendMarkdown(state.lastEntry.text)` appends user-controlled file
content via `appendMarkdown`, which interprets markdown syntax. The function
comment only justifies `isTrusted=false` (blocks command-URI injection) — it
does not address that arbitrary markdown in a STATE.md entry (headings, list
markers, backtick fences, links) will render/break the tooltip layout. Entry
text is data, not markup.
**Fix:** Use `ms.appendText(state.lastEntry.text)` for the entry body so the
content is escaped and rendered literally. `appendMarkdown` should be reserved
for the labels the extension itself controls.

### WR-03: Empty backticks rendered when timestamp is absent

**File:** `src/state/tooltip.ts:28-32`
**Issue:** `abs` falls back through `state.lastEntry.timestamp ?? state.lastUpdated ?? ''`.
When both are absent, `abs` is `''` and line 32 renders `_unknown_ — ` followed
by empty backticks (`` `` ``), producing a stray, meaningless code span in the
tooltip.
**Fix:** Guard the absolute-timestamp span:
```ts
const tail = abs ? ` — \`${abs}\`` : '';
ms.appendMarkdown(`_${rel}_${tail}\n`);
```

### WR-04: Config change handler ignores workspace-folder scope

**File:** `src/extension.ts:81-88`
**Issue:** `onDidChangeConfiguration` checks `affectsConfiguration('gsd.refreshIntervalSeconds')`
with no resource argument, then reads `getConfiguration('gsd')` also with no
resource. In a multi-root workspace the effective value can differ per folder;
the controller is bound to `workspaceFolders[0]`. Reading the unscoped value can
apply the wrong folder's setting. Low likelihood for this single-folder-focused
extension, but the mismatch is a latent bug.
**Fix:** Pass the controller's folder URI to both calls:
`getConfiguration('gsd', folder?.uri)` and check
`event.affectsConfiguration('gsd.refreshIntervalSeconds', folder?.uri)`.

## Info

### IN-01: "1 days ago" is grammatically incorrect

**File:** `src/state/relativeTime.ts:28`
**Issue:** The `>=24h` bucket always renders `${d} days ago`, producing
"1 days ago" for a one-day-old timestamp. The `relativeTime` test at
`relativeTime.test.ts:42` even asserts this incorrect string, locking in the
bug.
**Fix:** `return d === 1 ? '1 day ago' : \`${d} days ago\`;` and update the test
expectation accordingly.

### IN-02: vscode stub diverges from real getConfiguration signature

**File:** `src/test/setup/vscode-stub.ts:70-72`
**Issue:** The stub's `getConfiguration` ignores the optional `scope`/`resource`
second argument and always returns the default. If WR-04 is fixed to pass a
resource argument, tests would still pass against a stub that does not model
scoping — giving false confidence. Acceptable for current coverage but worth a
note.
**Fix:** When resource-scoped config is introduced, extend the stub to accept
and (minimally) honor the second argument.

### IN-03: No test coverage for setRefreshInterval value mapping

**File:** `src/test/state/controller.test.ts:139-188`
**Issue:** Every `setRefreshInterval` test only asserts `doesNotThrow`. None
verifies that the interval actually changes, that the clamp produces the
expected ms, or (relevant to CR-01) that a `NaN`/non-finite input is handled.
The clamp logic is effectively untested.
**Fix:** Inject a fake timer or expose the computed interval for assertion, and
add a case for `setRefreshInterval(NaN)`.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
