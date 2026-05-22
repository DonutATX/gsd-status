---
status: complete
phase: 07-milestone-collapsed-roadmap-support
source: [07-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

Verified against ../training_data — collapsed roadmap no longer errors; milestone hierarchy renders. Empty-chevron bug fixed (commit 118836a).

## Tests

### 1. Collapsed roadmap no longer errors
expected: Opening ../training_data (a real 6-milestone collapsed GSD project) in the Extension Development Host shows the GSD tree populated with phases — NOT the "GSD: Error" status. This is the exact bug Phase 7 closes.
result: pass

### 2. Milestone -> Phase hierarchy renders
expected: The TreeView shows milestone nodes at the top level (under Recent Activity), with phase nodes nested underneath their milestone. The active milestone is expanded by default; others collapsed.
result: pass

### 3. Phase node icons + collapsed-phase click
expected: Phase nodes show correct state icons (play = active, pass-filled = done, circle-outline = pending). Clicking a collapsed/archived phase node opens ROADMAP.md without a spurious wrong-line scroll jump.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- **Deferred to v1.1** — Archived milestones (Progress-table range rows like `1-4. v1.0 …`) render as a single pseudo-phase that repeats the milestone name; the individual phases 1–16 are not shown because their detail lives in `.planning/milestones/vX.Y-ROADMAP.md` archives, which the extension does not yet read. v1.1 work: `StateController` reads the milestone archive files and merges per-phase detail so archived milestones show their real individual phases. Decided during Phase 7 UAT (2026-05-22).
