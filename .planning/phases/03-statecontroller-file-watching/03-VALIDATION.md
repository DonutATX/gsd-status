---
phase: 3
slug: statecontroller-file-watching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | mocha 11.x via @vscode/test-cli |
| **Config file** | .vscode-test.mjs (existing from Phase 2) |
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
| 3-01-* | 01 | 1 | WSP-02, WSP-03, WSP-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-* | 02 | 2 | WAT-01, WAT-02, WAT-03, WAT-04, STAT-05 | — | N/A | unit + manual | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/debounce.test.ts` — stubs for WAT-02 (debounce coalescing)
- [ ] `src/test/controller.test.ts` — stubs for WSP-02/03/04 (state, atomic refresh, error-as-state)

*Pure debounce util is testable without an Extension Development Host; StateController tests run inside the EDH via the existing @vscode/test-cli harness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Status bar updates ≤500ms after a save | STAT-05 | Timing/observation against a real editor | Save ROADMAP.md, observe status bar updates within 500ms |
| `.planning/` created after VS Code open activates watcher | WAT-04 | Requires a live workspace lifecycle | Open a non-GSD workspace, create `.planning/ROADMAP.md`, confirm status bar activates without reload |
| No CPU spike on rapid saves | WAT-02 | Requires Task Manager observation | Rapid-save ROADMAP.md, watch the extension host process CPU |

*Timing and OS-resource behaviors cannot be asserted in unit tests — debounce coalescing logic itself is unit-tested.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
