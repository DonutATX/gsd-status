---
phase: 01-scaffold-minimal-status-bar
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/extension.ts
  - package.json
  - tsconfig.json
  - .vscodeignore
  - .gitignore
  - LICENSE
  - README.md
  - .vscode/launch.json
  - .vscode/tasks.json
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: fixed
fixed_at: 2026-05-20T00:00:00Z
fixes:
  WR-01: 725c7bf
  IN-01: 603e606
  IN-02: skipped (cosmetic; repo URL polish deferred to Phase 6)
  IN-03: 835bc0c
  IN-04: 0028f21
  IN-05: 1b5a513
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 1 scaffold and minimal status bar were reviewed against CLAUDE.md (pinned stack, security rules), the locked decisions in `01-CONTEXT.md`, and the two execute plans. Implementation closely follows the spec: zero runtime dependencies, hand-rolled regex parser (~35 lines including blanks), tsc-only build, `onStartupFinished` activation, single `StatusBarItem` registered to `context.subscriptions`, fire-and-forget I/O, and three failure-path strings exactly as specified.

No Critical findings (no security holes, no bugs that crash activate, no secrets, no path traversal — the only constructed path is `path.join(workspaceFolders[0].uri.fsPath, '.planning', 'ROADMAP.md')` with no user-supplied segments). One Warning around a parser correctness gap that will mis-report a completed phase as active against the *current* `ROADMAP.md` in this very repo, plus five Info items around packaging hygiene and minor robustness.

## Warnings

### WR-01: parseLite ignores bullet-list completion markers; reports Phase 1 as active even though ROADMAP marks it complete

**File:** `src/extension.ts:67-76`
**Issue:** `parseLite` only checks for `✅` or `[x]` on the `### Phase N: ...` header line itself. In this repo's actual `.planning/ROADMAP.md`, completion is tracked in the bullet list (line 15: `- [x] **Phase 1: Scaffold + Minimal Status Bar** ...`), while the corresponding `### Phase 1: Scaffold + Minimal Status Bar` section header on line 24 has no marker. The parser therefore returns `Phase 1: Scaffold + Minimal Status Bar` as the *active* phase even though the roadmap explicitly marks it complete and Phase 2 is next.

The locked decision in `01-CONTEXT.md` ("first `### Phase N:` header in ROADMAP.md whose line is not marked `✅` or `[x]`") was written before the team adopted the bullet-list `[x]` convention now visible in `ROADMAP.md`. The implementation matches the letter of the spec but not its intent ("active phase"). Result: the F5 acceptance string in `01-02-PLAN.md` (`Phase 1: Scaffold + Minimal Status Bar`) is achievable only because the spec and the implementation share the same blind spot.

**Fix:** Either (a) flag this as deferred work for Phase 2's proper parser and document it explicitly in `01-02-SUMMARY.md` so users aren't surprised, or (b) extend the done-detection in `parseLite` to also consult the bullet list. Minimal patch — scan the bullet list once, build a set of completed phase numbers, then skip those when iterating section headers:

```ts
const doneNumbers = new Set<string>();
for (const line of lines) {
  const b = line.match(/^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/);
  if (b) doneNumbers.add(b[1]);
}
for (const line of lines) {
  const m = line.match(/^###\s+(Phase\s+(\d+(?:\.\d+)?):\s+.+)$/);
  if (!m) continue;
  if (doneNumbers.has(m[2])) continue;
  if (line.includes('✅')) continue;
  if (/\[x\]/i.test(line)) continue;
  phase = m[1].trim();
  break;
}
```

Whichever path is chosen, the Phase 1 success criterion needs updating to reflect reality. As shipped, the status bar will lie about what's active the moment Phase 1 closes.

## Info

### IN-01: .vscodeignore does not explicitly exclude node_modules — relies on vsce's implicit devDependency trimming

**File:** `.vscodeignore:1-20`
**Issue:** No `node_modules/**` entry. `@vscode/vsce` trims `node_modules` for packages that declare no runtime `dependencies` (only `devDependencies`), so today this is safe. However, if a future change accidentally adds a runtime `dependency`, vsce will silently bundle the entire `node_modules` tree into the `.vsix` — the explicit Phase 6 size budget would be blown without any code change to `.vscodeignore`.
**Fix:** Add `node_modules/**` to `.vscodeignore` as a belt-and-braces guard. If a real runtime dep ever lands, remove that line deliberately and add precise allowlists.

### IN-02: package.json repository URL omits `.git` suffix and uses the misspelled repo name `gsd-extenstion`

> **DEFERRED:** Cosmetic-only; repo URL polish will be addressed in Phase 6 (Packaging + Distribution) along with marketplace assets.


**File:** `package.json:8-11`
**Issue:** `repository.url` is `https://github.com/DonutATX/gsd-extenstion` (no `.git`). npm/vsce tooling accepts both forms, but the canonical form is `git+https://github.com/DonutATX/gsd-extenstion.git`. Also worth noting: `gsd-extenstion` is the actual GitHub slug per CLAUDE.md — confirmed intentional, not a typo to fix here. Flagging only the URL form for Phase 6 polish.
**Fix:** When packaging in Phase 6, update to:
```json
"repository": { "type": "git", "url": "git+https://github.com/DonutATX/gsd-extenstion.git" }
```

### IN-03: `package` script references `vsce` but `@vscode/vsce` is not installed in devDependencies

**File:** `package.json:29`
**Issue:** `"package": "vsce package"` will fail with `vsce: command not found` if a contributor runs `npm run package` today. The plan explicitly defers `@vscode/vsce` install to Phase 6, but the script line is live now. Anyone exploring scripts will hit a confusing error.
**Fix:** Either delete the `package` script until Phase 6 adds the dep, or change it to `npx --yes @vscode/vsce package` so it bootstraps on demand without polluting devDependencies. The latter matches CLAUDE.md's "prefer npx" rule.

### IN-04: updateStatusBar can write to a disposed StatusBarItem if deactivate fires mid-read

**File:** `src/extension.ts:22-44`
**Issue:** `activate()` does `void updateStatusBar(item)` and returns. If VS Code calls `deactivate()` (or reloads the window) before `fs.readFile` resolves, `context.subscriptions` disposes the item, and the subsequent `item.text = ...` writes to a disposed object. VS Code tolerates this (no exception in current builds), but it is undefined behavior and will surface as a noisy warning if the API ever tightens. Cheap to defend.
**Fix:** Capture a local `disposed` flag via a disposable, or check `item` was not disposed before assignment:
```ts
let disposed = false;
context.subscriptions.push({ dispose: () => { disposed = true; } });
// inside updateStatusBar branches:
if (disposed) return;
item.text = '...';
```
Phase 3 (file watching) will need this primitive anyway.

### IN-05: parseLite milestone-header regex returns the full `## Milestone v1.0 — Label` line verbatim

**File:** `src/extension.ts:50-52`
**Issue:** When a `## Milestone vX.Y` header is found, the code strips `## ` and returns the rest unchanged, so the rendered status bar would read `$(pulse) Milestone v1.0 — Some Label › Phase ...`. The "Milestone" word is redundant in the status bar (the `›` already separates the milestone from the phase). Minor, and the current `ROADMAP.md` does not hit this branch — the H1 path is used instead.
**Fix:** When the Milestone header path is taken, additionally strip the leading `Milestone\s+` to keep just `v1.0` / `v1.0 — Label`:
```ts
milestone = milestoneHeader[0].replace(/^##\s+Milestone\s+/, '').trim();
```
Re-confirm in Phase 2 when the proper parser lands.

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
