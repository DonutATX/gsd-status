---
phase: 1
slug: scaffold-minimal-status-bar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract. Phase 1 ships extension scaffolding + minimal status bar; **test infrastructure is owned by Phase 2 (PARS-04 mandates `@vscode/test-cli` + mocha)**. Phase 1 therefore relies on TypeScript compile success and manual VS Code launch verification.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None in Phase 1 — Phase 2 installs `@vscode/test-cli@^0.0.12` + `mocha@^11` |
| **Config file** | `tsconfig.json` (compile-time validation only) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run compile` (produces `out/extension.js`) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` — must exit 0
- **After every plan wave:** Run `npm run compile` — must produce `out/extension.js`
- **Before `/gsd:verify-work`:** Manual launch via F5 (Extension Development Host) — observe status bar text
- **Max feedback latency:** ~5 seconds (compile), ~30 seconds (manual launch)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 01-01-* | 01 | 1 | SCAF-01..05 | compile | `npx tsc --noEmit` | ⬜ pending |
| 01-02-* | 02 | 1 | STAT-01, STAT-02, WSP-01 | compile | `npx tsc --noEmit` | ⬜ pending |

*Test infrastructure (mocha + test-cli) is Phase 2's responsibility per PARS-04. Phase 1 verification is intentionally compile-only + manual launch.*

---

## Wave 0 Requirements

- [ ] `package.json` — extension manifest with all SCAF-05 fields
- [ ] `tsconfig.json` — TypeScript ^5.8, target ES2022, module Node16, outDir `out`
- [ ] `.vscode/launch.json` — Extension Development Host launch config (enables manual F5 verification)

*No automated test framework — that arrives in Phase 2.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Status bar shows `$(pulse) v1.0 › Phase 1` on workspace open | STAT-01 | No `vscode.window` in unit context until Phase 2 wires `@vscode/test-cli` | F5 → open this repo (has `.planning/ROADMAP.md`) → confirm status bar text matches |
| Status bar shows `GSD: No project` when no `.planning/` | STAT-02 | Same as above | F5 → File > Open Folder → temp empty folder → confirm `GSD: No project` |
| Extension activates via `onStartupFinished` without blocking startup | SCAF-02 | Requires real VS Code lifecycle | F5 → observe Extension Development Host opens within ~2s, no "Activating extensions..." spinner |
| Disposables clean up on deactivate | SCAF-04 | Lifecycle event | F5 → Reload window → no leaked status bar item |

---

## Notes

- **Why no Nyquist matrix:** Nyquist sampling assumes an automated test framework. Phase 1 cannot satisfy this — PARS-04 explicitly defers framework setup to Phase 2. Recording this as a planned deviation; Phase 2's VALIDATION.md will inherit Phase 1's manifest as test-target.
- **Compile-time guarantees Phase 1 ships:** `tsc --noEmit` exits 0, `npm run compile` produces a valid `out/extension.js` that VS Code can load.
