---
phase: 7
slug: milestone-collapsed-roadmap-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | mocha 11.x (compiled JS, run via `npx mocha "out/test/**/*.test.js" --exit`) |
| **Config file** | existing `.mocharc.cjs` / `src/test/` setup |
| **Quick run command** | `npx mocha "out/test/**/*.test.js" --exit` |
| **Full suite command** | `npm run compile && npx mocha "out/test/**/*.test.js" --exit` |
| **Estimated runtime** | ~1 second (mocha) + compile |

---

## Sampling Rate

- **After every task commit:** Run the compiled mocha suite with `--exit`
- **After every plan wave:** Full suite green
- **Before `/gsd:verify-work`:** Full suite green; collapsed-roadmap fixture parses without error
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | PARS-06, PARS-07 | — | N/A | unit | `npx mocha "out/test/**/*.test.js" --exit` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 2 | PANL-08 | — | N/A | unit | `npx mocha "out/test/**/*.test.js" --exit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/parsers/fixtures/collapsed-roadmap.md` — milestone-collapsed ROADMAP.md fixture modelled on `../training_data/.planning/ROADMAP.md` (mixed range + per-phase Progress rows)
- [ ] Parser test cases for the collapsed path (roadmap.test.ts)
- [ ] Tree provider test cases for the milestone-node tier (provider.test.ts)

*Mocha already installed. Note: run mocha with `--exit` — the StateController test leaves a setInterval handle open, so bare mocha hangs after passing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extension shows phases (not "GSD: Error") on a real collapsed roadmap | PARS-06 | Requires opening a real multi-milestone project in the EDH | EDH: open ../training_data, confirm the tree populates and the status bar is not in the error state |
| Milestone → Phase tree hierarchy renders correctly | PANL-08 | TreeView rendering is visual | EDH: confirm milestone nodes at top level with phases nested, active milestone expanded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the collapsed-roadmap fixture
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
