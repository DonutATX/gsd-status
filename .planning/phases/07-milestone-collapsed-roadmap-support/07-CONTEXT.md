# Phase 7: Milestone-Collapsed Roadmap Support - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 is a gap-closure phase. The ROADMAP.md parser currently only recognizes
`### Phase N:` detail headers; a milestone-collapsed ROADMAP.md (the format
`/gsd:complete-milestone` produces — phase detail sections archived to `milestones/`,
leaving `<details>` blocks plus a `## Progress` table) yields zero phases, so the
extension shows "GSD: Error" on any multi-milestone GSD project. This phase makes the
parser handle collapsed roadmaps, extracts milestone grouping, and restructures the
TreeView into a Milestone → Phase hierarchy. It does NOT add marketplace publishing or
new status-bar features.

</domain>

<decisions>
## Implementation Decisions

### Parsing a Collapsed Roadmap
- "Collapsed" is detected by the absence of `### Phase N:` detail headers. If headers exist, parse them as today; if zero headers are found, fall back to Progress-table parsing.
- Milestones are parsed from the `## Milestones` section bullets (e.g. `- ✅ **v1.0 Checklists & Callouts** — Phases 1-4 (shipped 2026-03-21)`).
- The phase list in a collapsed roadmap is sourced from the `## Progress` table. Each table row becomes one phase entry — both range rows (`1-4. v1.0 Checklists & Callouts`) and single-phase rows (`18. B737 …`) are kept and labelled as written.
- The active phase is matched against `STATE.md` `Phase: N of M`, same as today.

### Milestone-Grouped Tree
- The TreeView is restructured: milestone nodes at the top level, phase nodes nested under their milestone.
- Milestone grouping is applied to ALL roadmaps, not just collapsed ones — a single-milestone project (like this repo) shows one milestone node. Consistent UX.
- The "Recent Activity" section stays the first top-level node, above the milestone nodes.
- The milestone containing the active phase is expanded by default; other milestones are collapsed.

### Edge Cases & Scope
- A roadmap with no `## Milestones` section at all falls back to today's flat phase list (no milestone wrapper) — backward compatible.
- Phase nodes for collapsed/archived phases have no goal/criteria children (that detail was archived to `milestones/` and is not read) — the node simply has no children; never an error.
- Status bar text is unchanged — `milestone › phase` from STATE.md.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/parsers/roadmap.ts` — `parseRoadmap`; `PHASE_HEADER` regex only matches `### Phase N:`. Needs a Progress-table fallback path and a `## Milestones` parser. `DONE_BULLET` currently requires bold `**Phase` — collapsed bullets are not bold.
- `src/parsers/types.ts` — `RoadmapData { projectName, milestoneLabel, phases[] }`, `RoadmapPhase`. Needs a milestone grouping field (e.g. `milestones: RoadmapMilestone[]` or a `milestone` field on each phase).
- `src/tree/items.ts` — `GsdTreeItem` discriminated union; needs a new `milestone` variant.
- `src/tree/provider.ts` — `GsdTreeProvider.getChildren`; the top-level currently returns Recent Activity + phase nodes. Becomes Recent Activity + milestone nodes; `getChildren(milestone)` returns that milestone's phases.
- `src/state/controller.ts` — already emits `kind:'error'` when `roadmap.phases.length === 0`; once the parser returns phases for collapsed roadmaps this error path stops firing for them.
- `src/test/setup/vscode-stub.ts` — already has TreeItem/ThemeIcon/TreeItemCollapsibleState.

### Established Patterns
- Pure parsers, zero `vscode` imports; tests under bare Mocha. `.js` extension on relative imports.
- `RoadmapPhase` consumed by `controller.ts`, `tooltip.ts`, `provider.ts` — additive changes preferred to avoid breaking those.
- Tree nodes have stable `id`s (PANL-07).

### Integration Points
- `roadmap.ts` parser — new collapsed-roadmap + milestone parsing.
- `types.ts` — milestone type + grouping.
- `tree/items.ts` + `tree/provider.ts` — milestone node tier.
- Test fixtures — add a milestone-collapsed ROADMAP.md fixture (model on `../training_data/.planning/ROADMAP.md`).

</code_context>

<specifics>
## Specific Ideas

The real-world failing file is `../training_data/.planning/ROADMAP.md` — a 6-milestone
collapsed roadmap. Its `## Progress` table mixes range rows (`1-4. …`, `5-7. …` for
fully-archived milestones) and per-phase rows (`17.`, `18.` … for recent milestones).
Use it as the reference shape for the collapsed-roadmap test fixture.

</specifics>

<deferred>
## Deferred Ideas

- Reading archived phase goal/success-criteria from `milestones/vX.Y-ROADMAP.md` to populate children of collapsed phase nodes — deferred; collapsed phase nodes simply have no children.
- Activity Bar badge with milestone/phase counts (UX-02) — still v2.

</deferred>
