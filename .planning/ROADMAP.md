# Roadmap: GSD Status — VS Code Extension

## Milestones

- ✅ **v1.0 GSD Status VS Code Extension** — Phases 1-7 (shipped 2026-05-22)
- 🚧 **v1.0.1 Collapsed-Roadmap Phase-Bullet Fallback** — Phase 8

## Phases

<details>
<summary>✅ v1.0 GSD Status VS Code Extension (Phases 1-7) — SHIPPED 2026-05-22</summary>

Full phase details archived in [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md).

- [x] Phase 1: Scaffold + Minimal Status Bar (2/2 plans) — completed 2026-05-20
- [x] Phase 2: Parsers + Tests (2/2 plans) — completed 2026-05-20
- [x] Phase 3: StateController + File Watching (2/2 plans) — completed 2026-05-21
- [x] Phase 4: Tooltip, Commands + Configuration (3/3 plans) — completed 2026-05-21
- [x] Phase 5: Side Panel TreeView (3/3 plans) — completed 2026-05-21
- [x] Phase 6: Packaging + Distribution (2/2 plans) — completed 2026-05-21
- [x] Phase 7: Milestone-Collapsed Roadmap Support (2/2 plans) — completed 2026-05-22

</details>

### v1.0.1 Collapsed-Roadmap Phase-Bullet Fallback (Phase 8)

- [ ] **Phase 8: Phase-Bullet Fallback for Collapsed Roadmaps**
  - **Goal:** When a collapsed ROADMAP's `## Progress` table yields zero phases, source phases from the `## Phases` bullet section so the tree view renders them.
  - **Requirements:** PARSE-12
  - **Success Criteria**
    1. The `mcp_omni_connect` ROADMAP parses to all 48 phases grouped under their 8 milestones (currently 0 phases).
    2. Phase number, name, and done-status are read from `- [x] **Phase N: Name**` bullets.
    3. Each fallback phase is assigned its milestone via the existing `Phases X–Y` range inference.
    4. Existing collapsed-table fixtures (`collapsed-roadmap*.md`) still parse via the `## Progress` table — no regression.
    5. A regression test fixture mirroring the `mcp_omni_connect` layout guards the behavior.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold + Minimal Status Bar | v1.0 | 2/2 | Complete | 2026-05-20 |
| 2. Parsers + Tests | v1.0 | 2/2 | Complete | 2026-05-20 |
| 3. StateController + File Watching | v1.0 | 2/2 | Complete | 2026-05-21 |
| 4. Tooltip, Commands + Configuration | v1.0 | 3/3 | Complete | 2026-05-21 |
| 5. Side Panel TreeView | v1.0 | 3/3 | Complete | 2026-05-21 |
| 6. Packaging + Distribution | v1.0 | 2/2 | Complete | 2026-05-21 |
| 7. Milestone-Collapsed Roadmap Support | v1.0 | 2/2 | Complete | 2026-05-22 |
| 8. Phase-Bullet Fallback for Collapsed Roadmaps | v1.0.1 | 0/1 | Not started | - |
