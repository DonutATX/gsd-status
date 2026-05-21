---
status: partial
phase: 04-tooltip-commands-configuration
source: [04-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Status bar hover tooltip
expected: In the EDH against ../gsd-test, hovering the GSD status bar item (ok state) shows a MarkdownString tooltip with milestone name, active phase name + goal, a horizontal rule, "Last Entry" heading with relative timestamp, the absolute ISO timestamp, and the last STATE.md entry text.
result: [pending]

### 2. Command Palette — three GSD commands
expected: Command Palette (Ctrl+Shift+P) typing "GSD" lists exactly three commands — "GSD: Refresh", "GSD: Open Roadmap", "GSD: Open State" — under the GSD category.
result: [pending]

### 3. GSD: Open Roadmap (file present)
expected: With ../gsd-test/.planning/ROADMAP.md present, running "GSD: Open Roadmap" opens ROADMAP.md in an editor tab.
result: [pending]

### 4. GSD: Open Roadmap (file absent)
expected: With ROADMAP.md temporarily renamed, running "GSD: Open Roadmap" shows an info message "GSD: ROADMAP.md not found in .planning/" instead of an error.
result: [pending]

### 5. Live configuration reload
expected: In VS Code Settings, both gsd.refreshIntervalSeconds and gsd.recentActivityCount appear with descriptions; changing gsd.refreshIntervalSeconds applies immediately (status bar updates at the new cadence) with no window reload.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
