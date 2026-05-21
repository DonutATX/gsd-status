---
status: partial
phase: 06-packaging-distribution
source: [06-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Manual install + activation test
expected: Running `code --install-extension gsd-status-0.1.0.vsix` installs the extension into VS Code stable. Opening the ../gsd-test workspace shows the GSD status bar item and the GSD Activity Bar panel, both activating cleanly with no errors or deprecation warnings.
result: [pending]

### 2. Screenshot capture
expected: Capture images/status-bar.png and images/tree-panel.png from the live extension; the README Markdown preview renders both without broken-image placeholders. Note: images/** is currently excluded in .vscodeignore — once real screenshots are committed, adjust the exclusion (e.g. allow images/*.png) before the next package build so the packaged README resolves them.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
