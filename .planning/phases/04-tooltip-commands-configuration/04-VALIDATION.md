---
phase: 4
slug: tooltip-commands-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | mocha 11.x (via @vscode/test-cli) |
| **Config file** | `.vscode-test.mjs` / existing `src/test/` setup |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

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
| 4-01-01 | 01 | 1 | STAT-03 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | STAT-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | CMD-01..04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | CFG-01..03 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/vscode-stub.ts` — add `MarkdownString`, `commands.registerCommand`, `workspace.getConfiguration`, `workspace.onDidChangeConfiguration` stubs
- [ ] `src/state/relativeTime.test.ts` — stub tests for the relative-time formatter
- [ ] Tooltip-builder and config-listener unit test files

*Mocha + @vscode/test-cli already installed — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tooltip renders on hover with MarkdownString formatting | STAT-03 | VS Code hover UI cannot be asserted headlessly | EDH: hover the status bar item, confirm milestone/phase/goal/last-entry shown |
| Command Palette discoverability under "GSD" category | CMD-04 | Palette UI is interactive | EDH: open Command Palette, type "GSD", confirm 3 commands listed |
| Live interval change without reload | CFG-03 | Requires VS Code Settings UI interaction | EDH: change `gsd.refreshIntervalSeconds`, confirm timer restarts without reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
