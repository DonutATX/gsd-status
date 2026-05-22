# Milestones

## v1.0 GSD Status VS Code Extension (Shipped: 2026-05-22)

**Phases completed:** 7 phases, 16 plans, 21 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- Two VS Code settings declared in package.json manifest with live timer reload wired via onDidChangeConfiguration — refresh interval applies immediately without a window reload, clamped to a 5-second minimum.
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- parseRoadmap now handles milestone-collapsed ROADMAP.md files — zero `### Phase N:` headers route to a `## Progress`-table reader, with `## Milestones` bullets parsed into a milestone-grouped phase list; expanded roadmaps parse unchanged.
- TreeView now renders milestones as top-level nodes with their phases nested underneath — the active milestone expands by default, the active phase keeps its play icon, and roadmaps without a `## Milestones` section fall back to the existing flat phase layout.

---
