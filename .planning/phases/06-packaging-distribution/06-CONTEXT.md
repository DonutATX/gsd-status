# Phase 6: Packaging + Distribution - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 makes the extension distributable as a local `.vsix` that installs into VS Code stable with a single command, without a marketplace publisher account. It adds the `vsce` packaging toolchain and an `npm run package` script, verifies the `.vsix` excludes sources/tests/planning docs and stays under 500 KB, and expands `README.md` into real install + feature documentation. It does NOT publish to the marketplace (deferred to v2) and adds no new extension features.

</domain>

<decisions>
## Implementation Decisions

### Packaging Mechanics
- Add an `npm run package` script that runs `vsce package` (the phase success criterion names `npm run package` exactly). The existing `package:vsix` script is superseded/renamed.
- Add `@vscode/vsce` as a pinned devDependency (`^3.x`); the package script invokes it.
- Add a minimal `CHANGELOG.md` with the v0.1.0 entry — vsce surfaces it in the package.
- Add a `vscode:prepublish` script running `npm run compile` so the packaged `.vsix` always contains a fresh `out/`.

### README & Distribution
- `README.md` references screenshot image files under an `images/` directory; the actual screenshot capture is a manual UAT step (cannot be automated headlessly).
- `README.md` scope: install via `code --install-extension <vsix>`, feature overview (status bar, tooltip, commands, side panel TreeView), settings reference (`gsd.refreshIntervalSeconds`, `gsd.recentActivityCount`), and build-from-source instructions.
- Add `*.vsix` to `.gitignore` — the built package is a build artifact, not committed.
- Marketplace-only manifest fields (`icon`, `galleryBanner`, etc.) are intentionally left out — deferred to v2 per PROJECT.md.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` already declares `name` (gsd-status), `displayName` (GSD Status), `description`, `publisher` (donutatx), `version` (0.1.0), `categories`, `repository`, `engines.vscode` (^1.95.0). Most SCAF-05 manifest metadata is already complete.
- `LICENSE` exists (added in Phase 1).
- `README.md` exists but is minimal (~525 bytes) — needs expansion.
- `.vscodeignore` exists — must be verified to exclude `src/`, `out/test/`, `.planning/`, and dev-only files.
- Existing scripts: `compile` (tsc -p .), `watch`, `test`, `test:parsers`, `package:vsix` (vsce package).

### Established Patterns
- Unbundled build — `tsc` only, no esbuild/webpack (per CLAUDE.md and PROJECT.md).
- Zero runtime dependencies; `@vscode/vsce` is dev-only.
- `resources/gsd-icon.svg` exists (Phase 5 Activity Bar icon).

### Integration Points
- `package.json` `scripts` and `devDependencies`.
- `.vscodeignore` — packaging exclusion list.
- `.gitignore` — add `*.vsix`.
- New files: `CHANGELOG.md`, `images/` directory (with README references).

</code_context>

<specifics>
## Specific Ideas

`@vscode/vsce` is the official Microsoft packaging tool (`vsce package` builds a `.vsix` with no marketplace account). Node >=20 required (already satisfied). Standard VS Code extension packaging — no custom tooling.

</specifics>

<deferred>
## Deferred Ideas

- Marketplace publishing (publisher account, `vsce publish`, GitHub Actions release workflow, listing assets — icon 128×128, gallery banner) — v2 (MKT-01..03).

</deferred>
