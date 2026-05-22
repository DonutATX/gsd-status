# Phase 7: Milestone-Collapsed Roadmap Support — Research

**Researched:** 2026-05-22
**Domain:** TypeScript parser extension + VS Code TreeView restructuring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Parsing a Collapsed Roadmap**
- "Collapsed" is detected by the absence of `### Phase N:` detail headers. If headers exist, parse them as today; if zero headers are found, fall back to Progress-table parsing.
- Milestones are parsed from the `## Milestones` section bullets (e.g. `- ✅ **v1.0 Checklists & Callouts** — Phases 1-4 (shipped 2026-03-21)`).
- The phase list in a collapsed roadmap is sourced from the `## Progress` table. Each table row becomes one phase entry — both range rows (`1-4. v1.0 Checklists & Callouts`) and single-phase rows (`18. B737 …`) are kept and labelled as written.
- The active phase is matched against `STATE.md` `Phase: N of M`, same as today.

**Milestone-Grouped Tree**
- The TreeView is restructured: milestone nodes at the top level, phase nodes nested under their milestone.
- Milestone grouping is applied to ALL roadmaps, not just collapsed ones — a single-milestone project (like this repo) shows one milestone node. Consistent UX.
- The "Recent Activity" section stays the first top-level node, above the milestone nodes.
- The milestone containing the active phase is expanded by default; other milestones are collapsed.

**Edge Cases & Scope**
- A roadmap with no `## Milestones` section at all falls back to today's flat phase list (no milestone wrapper) — backward compatible.
- Phase nodes for collapsed/archived phases have no goal/criteria children — the node simply has no children; never an error.
- Status bar text is unchanged — `milestone › phase` from STATE.md.

### Claude's Discretion

None specified in CONTEXT.md — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Reading archived phase goal/success-criteria from `milestones/vX.Y-ROADMAP.md` to populate children of collapsed phase nodes.
- Activity Bar badge with milestone/phase counts (UX-02) — still v2.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARS-06 | ROADMAP.md parser handles a milestone-collapsed roadmap — when no `### Phase N:` detail headers are present, sources phase list from the `## Progress` table; never returns zero phases for a valid collapsed roadmap. Expanded roadmaps continue to parse unchanged. | Collapsed-roadmap grammar analysed from real-world `training_data/.planning/ROADMAP.md`; two-path dispatch pattern documented in Architecture Patterns. |
| PARS-07 | ROADMAP.md parser extracts milestone grouping — each phase is associated with the milestone it belongs to (from `## Milestones` section and/or `## Progress` table's milestone column), exposed on `RoadmapData`. | `RoadmapMilestone` type design documented; `milestoneId` on `RoadmapPhase` approach analysed. |
| PANL-08 | TreeView renders milestones as top-level nodes with their phases nested underneath; the active phase remains visually distinguished within its milestone group. | `milestone` variant for `GsdTreeItem`, `getChildren` restructuring, and backward-compatible flat fallback documented. |
</phase_requirements>

---

## Summary

Phase 7 is a gap-closure phase with no new dependencies. The work falls into three tightly coupled but independently testable units: (1) parser extension, (2) type model extension, and (3) tree provider restructuring.

The real-world trigger is `training_data/.planning/ROADMAP.md` — a fully-shipped 6-milestone project where all 22 phases have been archived into `<details>` blocks and a `## Progress` table, leaving zero `### Phase N:` headers. The current parser returns `{ phases: [] }`, which causes `StateController` to emit `kind:'error'`.

The solution is a two-path dispatch inside `parseRoadmap`: if Pass 1 finds at least one `### Phase N:` header, execute the existing path unchanged; if Pass 1 finds zero headers, execute a new Progress-table path. The milestone grouping (from `## Milestones` bullets) is parsed in both paths and attached to `RoadmapData`. The tree provider then groups phases under milestone nodes when the roadmap has a `milestones` array, and falls back to the existing flat layout when it does not.

No external packages are introduced. No bundler changes. All new tests run under bare Mocha — no Extension Development Host required.

**Primary recommendation:** Implement as three sequential tasks — types first, then parser, then tree provider — because each depends on the previous. Write the collapsed-roadmap fixture before writing parser tests (TDD order).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect collapsed vs expanded roadmap | Parser (`roadmap.ts`) | — | Pure text analysis; zero VS Code API dependency; testable without EDH |
| Parse `## Milestones` bullets → milestone list | Parser (`roadmap.ts`) | — | Same file, same linear scan pass |
| Parse `## Progress` table rows → phase list | Parser (`roadmap.ts`) | — | Progress table is part of ROADMAP.md; pure text extraction |
| Associate each phase with its milestone | Parser (`roadmap.ts`) | `types.ts` | `milestoneId` field on `RoadmapPhase`; milestone column in Progress table provides the link |
| Milestone grouping data structure | `types.ts` | — | Shared type surface; consumed by both parser and tree provider |
| Render milestone nodes in tree | Tree provider (`provider.ts`) | `items.ts` | VS Code API calls belong in provider; item data shapes in items.ts |
| Active-milestone expansion logic | Tree provider (`provider.ts`) | — | `getChildren` builds collapsible state from `isActive` flag on phase nodes |
| Backward-compatible flat fallback | Tree provider (`provider.ts`) | — | Check `roadmap.milestones?.length > 0`; if absent/empty, use existing flat layout |

---

## Standard Stack

### Core (no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `^5.8` | Primary language | Already in use; no changes |
| `@types/vscode` | `^1.120.0` | VS Code API types | Already in use; no changes |
| Mocha (via `@vscode/test-cli`) | `^11.7.5` | Test runner | Already in use; new tests follow same pattern |

### No New Packages

This phase adds **zero new runtime or dev dependencies**. [VERIFIED: codebase inspection]

The full implementation is:
- Regex additions in `roadmap.ts`
- Type additions in `types.ts`
- Item variant addition in `items.ts`
- `getChildren` restructuring in `provider.ts`
- One new fixture file

---

## Package Legitimacy Audit

No new packages are introduced in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
ROADMAP.md text
      │
      ▼
┌─────────────────────────────────────────────────────┐
│  parseRoadmap()                                      │
│                                                      │
│  Pass 1 (scan for PHASE_HEADER)                      │
│       │                                              │
│       ├── found ≥1 header ──► existing expanded path │
│       │                          (unchanged)         │
│       │                          + parse ## Milestones│
│       │                            if present        │
│       │                                              │
│       └── found 0 headers ──► collapsed path:       │
│                                  parse ## Milestones  │
│                                  parse ## Progress    │
│                                    table rows        │
│                                                      │
│  Returns RoadmapData {                               │
│    projectName?, milestones?: RoadmapMilestone[],    │
│    phases: RoadmapPhase[]  ← never empty for valid   │
│  }                                                   │
└─────────────────────────────────────────────────────┘
      │
      ▼
StateController.refresh()
  roadmap.phases.length === 0 ──► kind:'error'  (unreachable for valid collapsed roadmap)
  roadmap.phases.length  >  0 ──► kind:'ok'
      │
      ▼
GsdTreeProvider.getChildren(undefined)
  roadmap.milestones?.length > 0
       ├── YES ──► [Recent Activity section, ...milestone nodes]
       │             getChildren(milestone) ──► phase nodes for that milestone
       └── NO  ──► [Recent Activity section, ...phase nodes]  ← existing flat layout
```

### Recommended Project Structure

No structural changes to the project layout. New fixture file added to existing fixtures directory:

```
src/
├── parsers/
│   ├── roadmap.ts          ← modified: add milestone parsing + Progress-table path
│   └── types.ts            ← modified: add RoadmapMilestone; extend RoadmapData/RoadmapPhase
├── tree/
│   ├── items.ts            ← modified: add 'milestone' variant
│   └── provider.ts         ← modified: milestone-aware getChildren
└── test/
    └── parsers/
        └── fixtures/
            └── collapsed-roadmap.md    ← NEW: 6-milestone collapsed fixture
```

---

### Pattern 1: Two-Path Dispatch in parseRoadmap

**What:** After Pass 1 (collecting `done` set), check whether any `### Phase N:` headers were found. If none, hand off to a Progress-table reader instead of the existing line-walker.

**When to use:** Only inside `parseRoadmap` — not a general pattern.

**Implementation sketch:**

```typescript
// Pass 1: collect done set AND detect if any PHASE_HEADER exists
const done = new Set<string>();
let hasDetailHeaders = false;
for (const line of lines) {
  const m = DONE_BULLET.exec(line);
  if (m) done.add(m[1]);
  if (!hasDetailHeaders && PHASE_HEADER.test(line)) hasDetailHeaders = true;
}

if (!hasDetailHeaders) {
  return parseCollapsedRoadmap(lines, done);
}
// ... existing expanded path follows unchanged
```

The `parseCollapsedRoadmap` function is a pure helper (not exported) that scans for `## Milestones` and `## Progress` table sections. [ASSUMED — exact function boundary; structure is sound given codebase patterns]

---

### Pattern 2: Milestone Bullet Grammar

**Source:** `training_data/.planning/ROADMAP.md` (canonical example, read directly) [VERIFIED: codebase inspection]

The `## Milestones` section uses this bullet format:

```
- ✅ **v1.0 Checklists & Callouts** — Phases 1-4 (shipped 2026-03-21)
- ✅ **v1.3.0 Training Database Webview** — Phases 5-7 (shipped 2026-05-14)
- ✅ **v1.4.1 Excel Column-Mapping Test Decoupling** — Phase 17 (shipped 2026-05-19)
- ✅ **v1.5.0 737 Data** — Phases 18-22 (shipped 2026-05-22)
```

Key observations:
- The ✅ prefix is a Unicode character (U+2705), not `[x]` — the existing `DONE_BULLET` regex does not match these.
- The milestone name is bold: `**v1.0 Checklists & Callouts**`
- The `—` is an em-dash (U+2014), not a hyphen-minus.
- The phase range is in the form `Phases 1-4` or `Phase 17` (singular for single phases).
- The shipped date is in `(shipped YYYY-MM-DD)` format, but is optional.

**Regex for milestone bullets:** [ASSUMED — verified against real data but regex not yet written]

```typescript
// Matches: - [✅ or checkbox] **milestone name** [— ...optional tail...]
const MILESTONE_BULLET = /^-\s+(?:✅|\[[xX]\])\s+\*\*(.+?)\*\*/;
```

The shipped date and phase range can be extracted from the tail using a separate regex if needed for the `description` field on milestone tree nodes.

This repo's own ROADMAP.md uses a different format — `## Milestone v1.0 milestone` — a `## ` H2 heading, not a bullet. The existing `MILESTONE` regex (`/^##\s+Milestone\s+(v\d+(?:\.\d+)?[^\r\n]*)$/`) handles that form. The `## Milestones` section (plural, with bullet list) is the collapsed format. Both must be handled.

---

### Pattern 3: Progress Table Grammar

**Source:** `training_data/.planning/ROADMAP.md` [VERIFIED: codebase inspection]

```
| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. v1.0 Checklists & Callouts | v1.0 | 7/7 | Complete | 2026-03-21 |
| 5-7. Training Database Webview | v1.3.0 | 12/12 | Complete | 2026-05-14 |
| 17. Excel Column-Mapping Decoupling | v1.4.1 | 1/1 | Complete | 2026-05-19 |
| 18. B737 Aircraft & Syllabus Foundation | v1.5.0 | 3/3 | Complete | 2026-05-20 |
```

Key observations:
- First column: `<number-or-range>. <name>` — the number is either a single integer (`17.`, `18.`) or a range (`1-4.`, `5-7.`, `8-11.`, `12-16.`).
- Second column: the milestone label (`v1.0`, `v1.3.0`, `v1.4.1`, `v1.5.0`).
- Third column: plans fraction — not needed by the parser.
- Fourth column: `Status` — `Complete` maps to `done: true`; anything else maps to `done: false`.
- Fifth column: `Completed` date — not needed by the parser for Phase 7.

**Number extraction for active-phase matching:** The `number` field on `RoadmapPhase` must be something the controller can compare to `STATE.md`'s `Phase: N of M`. For range rows (`1-4. …`), the `number` field should be the raw prefix (`1-4`) since there is no single phase number. For single rows (`18. …`) it should be `18`. The active phase match `phase.number === state.state.phaseNumber` works correctly for single-phase rows; range rows will never be "active" in a fully-collapsed roadmap since all those milestones are shipped. [ASSUMED — confirmed by reasoning about real-world shape]

**Regex for Progress table data rows:** [ASSUMED — verified against real data but regex not yet written]

```typescript
// Match a non-separator table row: | col1 | col2 | ... |
const PROGRESS_ROW = /^\|\s*(\d+(?:-\d+)?)\.\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|/;
// Group 1: number or range ("1-4" or "18")
// Group 2: phase name text
// Group 3: milestone label ("v1.0", "v1.5.0")
```

---

### Pattern 4: Type Model Extension

**Current types** (`src/parsers/types.ts`): [VERIFIED: codebase inspection]

```typescript
interface RoadmapPhase { number, name, goal?, mode?, ..., done, headerLine, endLine }
interface RoadmapData  { projectName?, milestoneLabel?, phases: RoadmapPhase[] }
```

**Proposed additions (additive — no breaking changes):**

```typescript
// New type
export interface RoadmapMilestone {
  label: string;           // e.g. "v1.0 Checklists & Callouts"
  phases: string[];        // phase number strings belonging to this milestone
  description?: string;   // e.g. "Phases 1-4 · shipped 2026-03-21"
}

// Extend RoadmapPhase — optional new field
export interface RoadmapPhase {
  // ... existing fields unchanged ...
  milestoneLabel?: string;  // which milestone this phase belongs to
}

// Extend RoadmapData — optional new field
export interface RoadmapData {
  projectName?: string;
  milestoneLabel?: string;  // existing single-milestone field — keep for backward compat
  milestones?: RoadmapMilestone[];  // NEW: array; absent = flat layout
  phases: RoadmapPhase[];
}
```

**Why additive is safe:** `controller.ts`, `tooltip.ts`, and `provider.ts` all access `roadmap.phases` — they are unaffected by new optional fields. The tree provider reads `roadmap.milestones` only if present. [VERIFIED: codebase inspection of controller.ts, state/types.ts, tree/provider.ts]

---

### Pattern 5: GsdTreeItem Milestone Variant

**Current union** (`src/tree/items.ts`): 6 variants — `section`, `phase`, `goal`, `criterion`, `activity`, `placeholder`. [VERIFIED: codebase inspection]

**New variant:**

```typescript
| { kind: 'milestone'; label: string; id: string; description?: string; isActive: boolean; phases: RoadmapPhase[] }
```

The `phases` array on the item lets `getChildren(milestone)` return phase nodes without re-querying the full roadmap. `isActive` drives the collapsible state decision. [ASSUMED — exact shape; rationale is sound]

**ID scheme:** `milestone-{slugified-label}` — e.g., `milestone-v1-0` for "v1.0 Checklists & Callouts". Slugification: lower-case, replace non-alphanumeric runs with `-`. Must be deterministic for PANL-07 stability. [ASSUMED — exact slug algorithm not yet defined]

---

### Pattern 6: Tree Provider Restructuring

**Current `_getRootChildren`** returns `[section, ...phases]`. [VERIFIED: codebase inspection]

**New logic:**

```typescript
private _getRootChildren(): GsdTreeItem[] {
  if (state.kind !== 'ok') { /* existing no-project / error handling unchanged */ }

  const section: GsdTreeItem = { kind: 'section', label: 'Recent Activity', id: 'recent-activity-section' };

  const { roadmap } = state;
  if (roadmap.milestones && roadmap.milestones.length > 0) {
    // Milestone-grouped layout
    const milestoneNodes = roadmap.milestones.map((ms): GsdTreeItem => {
      const msPhases = roadmap.phases.filter(p => p.milestoneLabel === ms.label);
      const isActive = msPhases.some(p => p.number === state.state.phaseNumber);
      return { kind: 'milestone', label: ms.label, id: slugify(ms.label), description: ms.description, isActive, phases: msPhases };
    });
    return [section, ...milestoneNodes];
  }

  // Flat fallback (no ## Milestones section — backward compatible)
  const phaseNodes = roadmap.phases.map(p => ({ kind: 'phase' as const, phase: p, isActive: p.number === state.state.phaseNumber }));
  return [section, ...phaseNodes];
}
```

`getChildren(milestone)` returns the milestone's phase nodes:

```typescript
if (element.kind === 'milestone') {
  return element.phases.map(p => ({ kind: 'phase' as const, phase: p, isActive: p.number === state.state.phaseNumber }));
}
```

[ASSUMED — exact code; the structure is prescribed by the locked decisions]

---

### Pattern 7: getTreeItem for Milestone Variant

From the UI-SPEC [VERIFIED: 07-UI-SPEC.md inspection]:

| Condition | Codicon | CollapsibleState |
|-----------|---------|-----------------|
| All phases done | `check-all` | `Collapsed` |
| Contains active phase | `milestone` | `Expanded` |
| No active phase, pending phases | `milestone` | `Collapsed` |

```typescript
case 'milestone': {
  const state = element.isActive
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
  const allDone = element.phases.every(p => p.done);
  const item = new vscode.TreeItem(element.label, state);
  item.id = element.id;
  item.description = element.description;
  item.iconPath = new vscode.ThemeIcon(allDone ? 'check-all' : 'milestone');
  // No command — milestone nodes expand/collapse only
  return item;
}
```

---

### Pattern 8: Test Fixture — Collapsed Roadmap

The new fixture must model the real-world `training_data/.planning/ROADMAP.md` shape. [VERIFIED: codebase inspection of training_data file]

Minimum required sections for tests:

1. `# Roadmap: <name>` — project name extraction
2. `## Milestones` — bullet list of milestones
3. `## Phases` — `<details>` block with archived bullet lines (`- [x] Phases N-M: …`)
4. `## Progress` — table with both range rows and single-phase rows, milestone column

The fixture should have at least 3 milestones to cover: all-done milestone (range row), single-phase milestone (single row), and a pending milestone. This gives test coverage for both the range and single-phase number extraction paths.

**Fixture file location:** `src/test/parsers/fixtures/collapsed-roadmap.md` [ASSUMED — follows existing fixture naming convention; VERIFIED location from `roadmap.test.ts` FIXTURES path]

---

### Anti-Patterns to Avoid

- **Modifying `MILESTONE` regex to match `## Milestones`:** The existing regex `MILESTONE` targets the single-H2-per-file form (`## Milestone v1.0 ...`). The plural `## Milestones` section heading is a different grammar. Add a new `MILESTONES_SECTION` regex rather than mutating the existing one.
- **Returning an empty `milestones: []` for roadmaps without `## Milestones`:** Use `milestones?: RoadmapMilestone[]` (optional/absent) as the absent signal. An empty array would require tree provider to distinguish "absent" from "parsed but empty". [ASSUMED]
- **Putting phase children inside the milestone item data:** The `phases` array on the `milestone` GsdTreeItem is correct; do not store pre-built `GsdTreeItem[]` children — that would couple item construction to the provider's internal logic.
- **Breaking the `phase.number === state.state.phaseNumber` comparison for range rows:** Range rows like `1-4` will never match a single-phase `phaseNumber` string. This is acceptable — range rows are always done (archived). Do not add special-case matching logic for them.
- **Throwing when `## Milestones` is present but `## Progress` is absent:** Parser must remain total (PARS-03). Return whatever phases were found; if Progress table is missing too, return `phases: []` — the controller's existing zero-phase error path handles it correctly.
- **Using `MILESTONE.exec` on the `## Milestones` section heading line:** The existing `MILESTONE` regex requires `## Milestone v\d+...`; the section heading `## Milestones` will not match it and will silently be ignored — which is the correct behavior.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown table parsing | Generic table parser | Narrow `PROGRESS_ROW` regex | The table has a fixed schema; a general parser adds complexity for no gain |
| Slug generation | Third-party slugify library | 3-line inline function (`label.toLowerCase().replace(/[^a-z0-9]+/g, '-')`) | Too simple to warrant a dependency |
| Tree state persistence (expansion memory) | Custom expansion tracking | VS Code's built-in reveal/expansion state (already used via stable IDs, PANL-07) | VS Code remembers expansion state per `TreeItem.id`; stable IDs are already implemented |

---

## Common Pitfalls

### Pitfall 1: `## Milestones` Section vs `## Milestone v1.0` Heading

**What goes wrong:** The section heading `## Milestones` (plural, no version suffix) is mis-matched by the existing `MILESTONE` regex, or a new regex for the plural form accidentally consumes the H2 heading as a milestone record.

**Why it happens:** Both formats use `## ` prefix. The existing regex is anchored to `Milestone\s+(v\d+...)`. The new `## Milestones` parsing must target the heading, then collect the bullet lines underneath — not parse the heading line itself as a milestone record.

**How to avoid:** Use a state-machine flag (`inMilestonesSection: boolean`) in the line-walker. Set it `true` when the line matches `/^##\s+Milestones\s*$/`. Set it `false` when the next `##` heading is encountered. Inside the section, parse bullet lines. [ASSUMED — exact state-machine design; structure is the same pattern used for `SUCCESS_ITEM` collection in existing code]

**Warning signs:** Parser returns `milestones: [{ label: 'Milestones' }]` — the section heading was consumed as a milestone record.

---

### Pitfall 2: `<details>` Block Lines Inside the Archived Phase Bullets

**What goes wrong:** The archived bullet lines inside `<details>` blocks follow a different format from the `## Milestones` bullets:

```
- [x] Phases 1-4: v1.0 Checklists & Callouts — shipped 2026-03-21
```

vs. milestone bullets:

```
- ✅ **v1.0 Checklists & Callouts** — Phases 1-4 (shipped 2026-03-21)
```

If the parser reads the `<details>` bullet lines to build the phase list (instead of the `## Progress` table), it gets a different number/name format, and the milestone grouping information is not present.

**How to avoid:** The locked decision is clear: **always use the `## Progress` table for the phase list in collapsed roadmaps**. The `<details>` block is for human reading only; ignore its content entirely. [VERIFIED: 07-CONTEXT.md — "The phase list in a collapsed roadmap is sourced from the `## Progress` table"]

**Warning signs:** Parser returns phase names that look like `v1.0 Checklists & Callouts` instead of `1-4. v1.0 Checklists & Callouts` — the `<details>` lines were used instead of the Progress table rows.

---

### Pitfall 3: Progress Table Header/Separator Row Leaking as a Phase

**What goes wrong:** The `## Progress` table has a header row and a separator row:

```
| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. ...
```

If the row regex is too broad, the header row (`| Phase | Milestone |…`) or separator row (`|-------|…`) matches as a phase.

**How to avoid:** The separator row only contains `-` and `|`; it will not match `PROGRESS_ROW` if the regex requires the first cell to start with a digit. The header row contains `Phase` (no leading digit). Both are naturally excluded by anchoring the number group to `/^\|\s*(\d+(?:-\d+)?)\./`. [ASSUMED — the anchoring approach is sound]

**Warning signs:** Parser returns a phase with `number: 'Phase'` or `number: '-----'`.

---

### Pitfall 4: Milestone ID Collisions in the Tree

**What goes wrong:** Two milestones whose names slugify to the same string get the same `TreeItem.id`, causing VS Code to silently drop one node from the tree.

**How to avoid:** In practice, milestone labels contain version numbers (`v1.0`, `v1.3.0`) which are distinct after slugification. Add a deduplication step in the milestone ID generator (append an index for collisions, same pattern as `buildActivityIds`). Or, use the milestone index as the primary ID component: `milestone-${index}` with the slug as context. [ASSUMED — the deduplication approach mirrors existing activity ID logic]

**Warning signs:** Tree shows fewer milestone nodes than expected; VS Code console logs "Duplicate tree item id".

---

### Pitfall 5: Active-Phase Detection in Mixed Milestone Tree

**What goes wrong:** When a roadmap has a `## Milestones` section (expanded roadmap, this repo's own ROADMAP.md), milestone grouping is applied to all roadmaps. But `this repo's ROADMAP.md` currently has `milestoneLabel: 'v1.0 milestone'` from the existing single-H2 `MILESTONE` regex, with no `milestones: []` array. The tree provider's milestone-grouping path is only entered when `roadmap.milestones?.length > 0`. So the flat fallback is used for this repo — correct.

The issue arises when Phase 7 is complete and this repo's own ROADMAP.md is collapsed after v1.0 ships. At that point `## Milestones` bullets will be added and the grouping path activates. Testing both branches is essential.

**How to avoid:** Write explicit tests for (a) roadmap with `milestones` array — grouped layout; (b) roadmap without `milestones` array — flat layout. [VERIFIED: test pattern established in roadmap.test.ts]

---

### Pitfall 6: vscode-stub Missing `milestone` and `check-all` Codicons

**What goes wrong:** The `ThemeIcon` stub in `vscode-stub.ts` stores only `id: string` — it does not validate codicon names. So tests using `new vscode.ThemeIcon('milestone')` will pass regardless of whether `'milestone'` is a valid codicon.

**Impact:** Low. The actual icon display is validated by manual EDH testing (UAT), not unit tests. Unit tests should only assert the `.id` string value.

**How to avoid:** In provider tests for milestone nodes, assert `item.iconPath instanceof vscode.ThemeIcon` and `(item.iconPath as ThemeIcon).id === 'milestone'` — matching the existing pattern for phase icon tests. [VERIFIED: codebase inspection of provider.test.ts]

---

## Code Examples

### Parsing `## Milestones` Section (state-machine approach)

```typescript
// Source: inferred from existing SUCCESS_ITEM collection pattern in roadmap.ts
const MILESTONES_HEADING = /^##\s+Milestones\s*$/;
const H2_ANY = /^##\s+/;
const MILESTONE_BULLET_PATTERN = /^-\s+(?:✅|\[[xX]\])\s+\*\*(.+?)\*\*(?:\s+—\s+(.*))?$/;

let inMilestonesSection = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (MILESTONES_HEADING.test(line)) { inMilestonesSection = true; continue; }
  if (inMilestonesSection && H2_ANY.test(line)) { inMilestonesSection = false; }
  if (inMilestonesSection) {
    const m = MILESTONE_BULLET_PATTERN.exec(line);
    if (m) {
      milestones.push({ label: m[1], phases: [], description: m[2]?.trim() });
    }
  }
}
```

[ASSUMED — regex details; the pattern matches the canonical real-world input]

---

### Parsing `## Progress` Table Rows

```typescript
// Source: inferred from training_data/.planning/ROADMAP.md table grammar [VERIFIED: codebase inspection]
const PROGRESS_HEADING = /^##\s+Progress\s*$/;
const PROGRESS_ROW_PATTERN = /^\|\s*(\d+(?:-\d+)?)\.\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|[^|]+\|\s*(Complete|[^|]+?)\s*\|/i;
// Group 1: number ("1-4" or "18")
// Group 2: phase name text
// Group 3: milestone label
// Group 4: status ("Complete" → done: true)

let inProgressSection = false;
for (const line of lines) {
  if (PROGRESS_HEADING.test(line)) { inProgressSection = true; continue; }
  if (inProgressSection && /^##\s+/.test(line)) { inProgressSection = false; }
  if (inProgressSection) {
    const m = PROGRESS_ROW_PATTERN.exec(line);
    if (m) {
      phases.push({
        number: m[1].trim(),
        name: m[2].trim(),
        milestoneLabel: m[3].trim(),
        done: /^complete$/i.test(m[4].trim()),
        headerLine: 0,   // no detail header in collapsed roadmap
        endLine: 0,
      });
    }
  }
}
```

[ASSUMED — regex details; structure is sound for the real-world input shape]

---

### Milestone Slugification

```typescript
// Source: inferred from PANL-07 stable-ID requirement + existing activityId pattern
function slugify(label: string): string {
  return `milestone-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
// "v1.0 Checklists & Callouts" → "milestone-v1-0-checklists-callouts"
```

[ASSUMED — exact transform; stable and collision-resistant for realistic milestone labels]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mocha 11 (via `@vscode/test-cli`) |
| Config file | `.mocharc.cjs` (existing) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARS-06 | Collapsed roadmap (no `### Phase N:`) returns non-empty phases from Progress table | unit | `npm test` | ❌ Wave 0 — new tests in `roadmap.test.ts` |
| PARS-06 | Expanded roadmap still parses unchanged after changes | unit | `npm test` | ✅ existing canonical tests |
| PARS-07 | Milestone grouping extracted from `## Milestones` bullets | unit | `npm test` | ❌ Wave 0 — new tests in `roadmap.test.ts` |
| PARS-07 | Each phase has `milestoneLabel` field from Progress table milestone column | unit | `npm test` | ❌ Wave 0 — new tests in `roadmap.test.ts` |
| PANL-08 | Milestone nodes appear as top-level children when `milestones` present | unit | `npm test` | ❌ Wave 0 — new tests in `provider.test.ts` |
| PANL-08 | Phase nodes appear under their milestone node | unit | `npm test` | ❌ Wave 0 — new tests in `provider.test.ts` |
| PANL-08 | Active-milestone node has `isActive: true`, expanded collapsible state | unit | `npm test` | ❌ Wave 0 — new tests in `provider.test.ts` |
| PANL-08 | Flat fallback used when `milestones` absent | unit | `npm test` | ❌ Wave 0 — new tests in `provider.test.ts` |
| PANL-08 | Active phase visually distinguished within milestone group (icon: `play`) | unit | `npm test` | ❌ Wave 0 — new tests in `provider.test.ts` |

### Wave 0 Gaps

- [ ] `src/test/parsers/fixtures/collapsed-roadmap.md` — collapsed roadmap fixture (6-milestone, covers range rows + single-phase rows)
- [ ] New `describe` block in `src/test/parsers/roadmap.test.ts` — collapsed roadmap tests (PARS-06, PARS-07)
- [ ] New `describe` block in `src/test/tree/provider.test.ts` — milestone-grouped tree tests (PANL-08)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `parseCollapsedRoadmap` is a private helper function inside `roadmap.ts`, not a separate module | Pattern 1 | Low — either works; keeping it in `roadmap.ts` is simpler |
| A2 | Milestone bullets may use `[x]` as well as `✅` for the done marker | Pattern 2 | Low — `✅` is canonical for GSD collapsed format; supporting `[x]` is defensive |
| A3 | Range rows will never be "active" in a real collapsed roadmap (all shipped) | Pattern 3 | Low — if somehow a range-row milestone is partially shipped, the active phase simply won't match any range row; no crash |
| A4 | `milestones?: RoadmapMilestone[]` (optional) is the correct absent-signal; `milestones: []` is not used | Pattern 4 | Low — provider checks `.length > 0`; empty array also works; but optional is cleaner |
| A5 | Milestone ID slugification: `label.toLowerCase().replace(/[^a-z0-9]+/g, '-')` | Pattern 6 | Low — slug algorithm only affects tree ID stability; any deterministic function works |
| A6 | `MILESTONE_BULLET_PATTERN` handles both `✅` (U+2705) and `[x]` done-markers | Code Examples | Low — worst case a bullet is silently skipped; parser remains total |
| A7 | `PROGRESS_ROW_PATTERN` column count matches the exact column order in all real-world Progress tables | Code Examples | Medium — if a project uses fewer columns, the regex may not match; use a more permissive row detector as fallback |
| A8 | `headerLine: 0` is safe for archived/range phase nodes (no line to navigate to) | Code Examples | Low — provider's `openRoadmap` command uses `phase.headerLine`; `0` opens the file at the top, which is acceptable per UI-SPEC |

---

## Open Questions (RESOLVED)

1. **Progress table column order variation**
   - What we know: The canonical `training_data` ROADMAP.md has columns `Phase | Milestone | Plans Complete | Status | Completed`.
   - What's unclear: Other GSD projects may omit columns or reorder them. The PARS-06 requirement says "sources the phase list from the `## Progress` table" but does not specify column order tolerance.
   - Recommendation: Parse columns by header name in a first-pass header scan, then use positional index. This is a one-time cost and makes the parser robust. If too complex for Phase 7, use fixed-column-order with a comment documenting the assumption.

2. **What happens if `## Milestones` is present but `## Progress` is absent?**
   - What we know: The locked decision says "the phase list in a collapsed roadmap is sourced from the `## Progress` table." If the table is absent, there are no phases.
   - What's unclear: Should the parser fall back to the `<details>` block bullets in this case?
   - Recommendation: No fallback. Return `phases: []` → controller emits `kind:'error'` with a clear message. This is the simplest behavior consistent with PARS-03 (no throw) and WSP-04 (error surfaced, not crashed).

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code and fixture changes. No external tools, services, or CLI utilities beyond `npm test` (already verified working).

---

## Security Domain

This extension is read-only (never writes to `.planning/`) and has no network access, authentication, or user-input surfaces. No ASVS categories apply to Phase 7 specifically. The regex additions must comply with the existing PARS-05 requirement — no catastrophic backtracking. All proposed regexes use character classes and non-greedy quantifiers inside `<details>` blocks; none use `.*` followed by `.*` or other backtracking-prone patterns.

---

## Sources

### Primary (HIGH confidence)
- `training_data/.planning/ROADMAP.md` — canonical collapsed roadmap shape; read directly in this session [VERIFIED: codebase inspection]
- `src/parsers/roadmap.ts` — current parser implementation; read directly [VERIFIED: codebase inspection]
- `src/parsers/types.ts` — current type definitions; read directly [VERIFIED: codebase inspection]
- `src/tree/items.ts` — current GsdTreeItem union; read directly [VERIFIED: codebase inspection]
- `src/tree/provider.ts` — current tree provider implementation; read directly [VERIFIED: codebase inspection]
- `src/state/controller.ts` — zero-phase error path; read directly [VERIFIED: codebase inspection]
- `07-CONTEXT.md` — all locked decisions; read directly [VERIFIED: codebase inspection]
- `07-UI-SPEC.md` — ThemeIcon contract, milestone node spec; read directly [VERIFIED: codebase inspection]
- `src/test/parsers/roadmap.test.ts` — existing test patterns; read directly [VERIFIED: codebase inspection]
- `src/test/tree/provider.test.ts` — existing tree test patterns; read directly [VERIFIED: codebase inspection]
- `src/test/setup/vscode-stub.ts` — stub capabilities; read directly [VERIFIED: codebase inspection]

### Secondary (MEDIUM confidence)
None — all findings are from direct codebase inspection of authoritative source files.

### Tertiary (LOW confidence)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing stack verified by direct inspection
- Architecture: HIGH — all patterns derived from real-world input files and existing codebase
- Pitfalls: HIGH — identified from direct inspection of the real data and existing code patterns
- Type model: HIGH — additive extension of verified existing types
- Tree restructuring: HIGH — derived from UI-SPEC and locked decisions

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable domain; VS Code TreeView API is not fast-moving)
