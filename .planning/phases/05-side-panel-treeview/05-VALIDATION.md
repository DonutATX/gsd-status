---
phase: 5
slug: side-panel-treeview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | mocha 11.x (via @vscode/test-cli) |
| **Config file** | `.vscode-test.mjs` / existing `src/test/` setup |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | PANL-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | PANL-01..03,06,07 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 3 | PANL-05 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Read `src/test/parsers/fixtures/canonical-state.md` to confirm real STATE.md multi-entry grammar before writing the `recentEntries` parser (Research Assumption A1 / Pitfall 7)
- [ ] `src/test/setup/vscode-stub.ts` — add `TreeItem`, `ThemeIcon`, `TreeItemCollapsibleState`, `window.createTreeView` stubs
- [ ] Parser test file for `recentEntries`
- [ ] TreeDataProvider test file (`src/test/tree/provider.test.ts`)

*Mocha + @vscode/test-cli already installed — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Activity Bar panel renders with custom SVG icon | PANL-01 | Activity Bar UI is visual | EDH: confirm GSD panel appears in Activity Bar with the icon |
| Active phase visually distinguished, expand shows goal/criteria | PANL-02, PANL-03 | TreeView rendering is visual | EDH: confirm active phase icon + expand a phase node |
| Recent Activity section shows last 5 entries | PANL-04 | Visual tree rendering | EDH: confirm Recent Activity node lists entries |
| Welcome view shows on no-project workspace | PANL-05 | viewsWelcome rendering | EDH: open a folder with no .planning/, confirm welcome message |
| Toolbar refresh button updates the tree | PANL-06 | Toolbar UI interaction | EDH: click refresh, confirm tree updates |
| Expansion state preserved across refresh | PANL-07 | Visual state persistence | EDH: expand nodes, refresh, confirm they stay expanded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
