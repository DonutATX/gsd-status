---
status: partial
phase: 07-milestone-collapsed-roadmap-support
source: [07-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Collapsed roadmap no longer errors
expected: Opening ../training_data (a real 6-milestone collapsed GSD project) in the Extension Development Host shows the GSD tree populated with phases — NOT the "GSD: Error" status. This is the exact bug Phase 7 closes.
result: [pending]

### 2. Milestone -> Phase hierarchy renders
expected: The TreeView shows milestone nodes at the top level (under Recent Activity), with phase nodes nested underneath their milestone. The active milestone is expanded by default; others collapsed.
result: [pending]

### 3. Phase node icons + collapsed-phase click
expected: Phase nodes show correct state icons (play = active, pass-filled = done, circle-outline = pending). Clicking a collapsed/archived phase node opens ROADMAP.md without a spurious wrong-line scroll jump.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
