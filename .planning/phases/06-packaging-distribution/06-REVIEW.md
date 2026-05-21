---
phase: 06-packaging-distribution
reviewed: 2026-05-21T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - package.json
  - .vscodeignore
  - README.md
  - CHANGELOG.md
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the Phase 6 packaging and distribution files: `package.json`, `.vscodeignore`, `README.md`, and `CHANGELOG.md`. The manifest, scripts, and CHANGELOG are largely consistent with each other and with the documented behavior. However, the README references two screenshot images that do not exist in the repository, which will produce broken images in the marketplace/`.vsix` listing. Several smaller packaging hygiene issues were also found.

## Critical Issues

### CR-01: README references screenshot images that do not exist

**File:** `README.md:20-22`
**Issue:** The README embeds two images:
```
![GSD status bar ...](images/status-bar.png)
![GSD Activity Bar side panel ...](images/tree-panel.png)
```
The `images/` directory contains only `.gitkeep` — neither `status-bar.png` nor `tree-panel.png` exists. When the `.vsix` is packaged and installed, the extension details page (and any marketplace listing) will render two broken image placeholders. `.vscodeignore` does not exclude `images/`, so the empty/missing directory is the only thing shipped. This is the user-facing first impression of the extension and is currently broken.
**Fix:** Either add the actual screenshot files at `images/status-bar.png` and `images/tree-panel.png`, or remove the `### Screenshots` section (lines 18-22) from `README.md` until real screenshots are available.

## Warnings

### WR-01: package.json has no top-level `icon` field

**File:** `package.json:1-21`
**Issue:** The manifest defines `contributes.viewsContainers.activitybar[].icon` (`resources/gsd-icon.svg`) but has no top-level `"icon"` property. Without it the extension uses the default gray VS Code placeholder icon in the Extensions panel and any marketplace listing. For a packaging/distribution phase this is a visible gap.
**Fix:** Add a top-level `"icon": "resources/gsd-icon.png"` (the marketplace requires a 128x128 PNG; SVG is not accepted for the extension icon). Reuse/raster the existing `resources/gsd-icon.svg`.

### WR-02: `.vscodeignore` does not exclude `images/.gitkeep`

**File:** `.vscodeignore:1-26`
**Issue:** The `images/` directory currently holds only a placeholder `.gitkeep`. With no real screenshots, an empty `images/` dir plus `.gitkeep` ships inside the `.vsix` as dead weight. More generally, no `.gitkeep`/`*.keep` exclusion exists.
**Fix:** Once real images exist this is moot; until then add `images/.gitkeep` (or `**/.gitkeep`) to `.vscodeignore`, or remove the placeholder directory.

### WR-03: `package` script does not run a clean compile before packaging

**File:** `package.json:111-112`
**Issue:** `"package": "vsce package"`. `vsce package` triggers `vscode:prepublish` (`npm run compile`), which is `tsc -p .` — an incremental compile, not a clean build. Stale `out/` artifacts from removed/renamed source files (e.g. old test files) can be packaged. `out/test/**` is excluded by `.vscodeignore`, which mitigates the test case, but stale non-test `.js` from a renamed source file would still ship.
**Fix:** Add a clean step, e.g. `"vscode:prepublish": "rimraf out && npm run compile"` or a `"pretest"`-style clean, so packaging always builds from a fresh `out/`.

### WR-04: No `files`/`.vscodeignore` guard against `.serena/` cache and dotfiles drift

**File:** `.vscodeignore:1-26`
**Issue:** The ignore list is enumerated explicitly. It correctly excludes `.serena/**`, `.planning/**`, `CLAUDE.md`, etc., but enumeration is fragile — any new dev-only dotfile or directory (e.g. `.github/`, `.agents/`, `MEMORY`-style folders) will ship by default. `.vsixignore` uses a denylist; a stray dev artifact is easy to miss.
**Fix:** Run `vsce ls` (or `vsce package` then inspect the `.vsix` contents) as part of the phase verification to confirm exactly which files ship. Consider adding broad patterns like `.github/**`, `.agents/**`, `*.log`.

## Info

### IN-01: CHANGELOG date matches a future-dated release relative to repo history

**File:** `CHANGELOG.md:7`
**Issue:** `## [0.1.0] - 2026-05-21` is dated the current day. This is fine, but the CHANGELOG has no `[Unreleased]` section and no comparison links at the bottom — "Keep a Changelog" (which the file claims to adhere to) recommends both.
**Fix:** Optionally add an `## [Unreleased]` heading and version-diff links (`[0.1.0]: https://github.com/.../releases/tag/v0.1.0`).

### IN-02: README and manifest are consistent — no mismatch found

**File:** `README.md:44-51`, `package.json:79-97`
**Issue:** Verified the documented commands (`gsd.refresh`, `gsd.openRoadmap`, `gsd.openState`, `gsd.refreshTree`), setting keys (`gsd.refreshIntervalSeconds` default 30 min 5, `gsd.recentActivityCount` default 5 min 1), and `engines.vscode ^1.95.0` all match the manifest. No action needed — recorded for completeness.
**Fix:** None.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
