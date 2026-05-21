---
phase: 6
slug: packaging-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | mocha 11.x (via @vscode/test-cli) — existing suite, no new tests |
| **Config file** | existing `src/test/` setup |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's automated check (`npm test` for regression safety, `vsce ls` / `npm run package` for packaging tasks)
- **Before `/gsd:verify-work`:** `npm run package` must succeed and the `.vsix` must be under 500 KB
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | PKG-01,PKG-03 | — | N/A | build | `npm run package` then size check | ✅ | ⬜ pending |
| 6-02-01 | 02 | 2 | PKG-04 | — | N/A | docs | README section grep | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No new test files needed. Phase 6 is packaging config + documentation; the existing 121-test suite is the regression guard. Run `npm test` once to confirm no regression before packaging.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run package` produces a `.vsix` with no errors | PKG-01 | Build output requires inspection | Run `npm run package`, confirm `.vsix` created |
| `code --install-extension` installs and activates cleanly | PKG-02 | Requires a real VS Code stable instance | Install the `.vsix`, confirm extension activates |
| `vsce ls` shows <500 KB, no src/test/planning files | PKG-03 | Requires reviewing the file manifest | Run `vsce ls`, confirm size and contents |
| README screenshots reflect the actual UI | PKG-04 | Screenshot capture cannot be automated headlessly | Capture status bar + tree panel screenshots into `images/` |

---

## Validation Sign-Off

- [ ] Existing 121-test suite passes (regression guard)
- [ ] `npm run package` succeeds
- [ ] `.vsix` under 500 KB, excludes src/test/.planning/.serena
- [ ] `nyquist_compliant: true` set in frontmatter (after manual verification)

**Approval:** pending
