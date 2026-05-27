/**
 * parseRoadmap — total, deterministic ROADMAP.md parser.
 *
 * Zero vscode imports. Linear regex only (no nested quantifiers, no `.*` followed by `.*`).
 * Two-pass scan: (1) collect done phase numbers from `- [x] **Phase N:` bullets,
 * (2) walk lines to extract H1 / milestone / phase headers and per-phase fields.
 */

import { splitLines } from './lines.js';
import type { RoadmapData, RoadmapMilestone, RoadmapPhase } from './types.js';

const DONE_BULLET = /^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/;
const H1 = /^#\s+(.+?)\s*$/;
const ROADMAP_PREFIX = /^Roadmap:\s*/;
const MILESTONE = /^##\s+Milestone\s+(v\d+(?:\.\d+)?[^\r\n]*)$/;
const PHASE_HEADER = /^###\s+Phase\s+(\d+(?:\.\d+)?):\s+(.+?)\s*$/;

// Collapsed-roadmap grammar — see 07-RESEARCH.md Patterns 2 & 3.
const MILESTONES_HEADING = /^##\s+Milestones\s*$/;
const H2_ANY = /^##\s+/;
// `- ✅ **label**`, `- 🚧 **label**`, `- [x] **label**`, or `- [ ] **label**`,
// with an optional em-dash tail. Status markers cover shipped (✅), in-progress
// (🚧), pending (⏳), and any GFM checkbox state — without this, in-progress
// milestones like `- 🚧 **v3.2 ...**` are dropped from the milestones list and
// their phases fall through to the synthetic "Other" bucket (#4).
const MILESTONE_BULLET_PATTERN = /^-\s+(?:✅|🚧|⏳|\[[ xX]\])\s+\*\*(.+?)\*\*(?:\s+—\s+(.+?))?\s*$/;
const PROGRESS_HEADING = /^##\s+Progress\s*$/;
// `Phases 33–38`, `Phases 1-7.2`, with en-dash/em-dash/hyphen. Used to infer
// phase→milestone membership when the ROADMAP has no `## Milestone vX.Y` H2
// headers (mcp_omni_connect layout).
const PHASE_RANGE = /Phases?\s+(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)/;
// WR-02: A Progress table row, parsed by splitting on `|` rather than a rigid
// full-row regex, so tables with extra/missing trailing columns still parse.
// Standard GSD Progress columns (1-based after the leading `|`):
//   col 1 = Phase ("1-4. Foundation Setup"), col 2 = Milestone ("v1.0"),
//   col 3 = Plans Complete, col 4 = Status, col 5 = Completed.
// Only the phase, milestone, and status cells are required; the row is kept
// as long as cols 1, 2, and 4 are present. The phase cell must start with a
// digit — this excludes the header row (starts with "Phase") and the
// separator row (only `-`/`|`), see RESEARCH Pitfall 3.
const PROGRESS_PHASE_CELL = /^(\d+(?:-\d+)?)\.\s+(.+)$/;
// Accept both `**Key:**` and `**Key**:` punctuation styles. Real GSD files
// mix conventions (canonical ROADMAP.md uses `**Goal**:` and `**Mode:**` on
// adjacent lines), so each directive tolerates either form.
const GOAL = /^\*\*Goal(?:\*\*:|:\*\*)\s*(.+?)\s*$/;
const MODE = /^\*\*Mode(?:\*\*:|:\*\*)\s*(.+?)\s*$/;
const DEPENDS_ON = /^\*\*Depends on(?:\*\*:|:\*\*)\s*(.+?)\s*$/;
const REQUIREMENTS = /^\*\*Requirements(?:\*\*:|:\*\*)\s*(.+?)\s*$/;
const SUCCESS_HEADER = /^\*\*Success Criteria\*\*/;
const SUCCESS_ITEM = /^\s+\d+\.\s+(.+?)\s*$/;
const DIRECTIVE = /^\*\*/;

/**
 * CR-01: derive a stable join key from a milestone reference.
 *
 * The `## Milestones` bullet label is descriptive prose
 * (`"v1.0 Foundation"`), while the `## Progress` table's milestone column is
 * a bare version token (`"v1.0"`). Both reference the same milestone, so we
 * join on the leading version token (`v\d+(.\d+)*`). When a label has no
 * version token we fall back to the full normalized label.
 */
export function milestoneKey(label: string): string {
  const trimmed = label.trim();
  return (trimmed.match(/^v\d+(?:\.\d+)*/)?.[0] ?? trimmed).toLowerCase();
}

/**
 * WR-03: status-cell values that mean a phase/milestone is done. GSD Progress
 * tables in the wild use `Complete`, `Completed`, `Done`, `Shipped`, or a `✅`
 * checkmark — all are treated as done (case-insensitive).
 */
function isDoneStatus(status: string): boolean {
  const s = status.trim();
  return /^(complete|completed|done|shipped)$/i.test(s) || /✅/.test(s);
}

/**
 * WR-02: split a `|`-delimited Markdown table row into trimmed cells, or
 * undefined for a non-row line. Drops the leading/trailing `|`.
 */
function splitTableCells(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) {
    return undefined;
  }
  return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/**
 * WR-02: resolve the 0-based index of the Status column from a Progress-table
 * header row. Falls back to the standard GSD position (index 3) when no
 * "Status" header cell is found, so column reordering or a missing
 * "Plans Complete" column does not mis-map the status cell.
 */
function findStatusColumn(headerCells: string[]): number {
  const idx = headerCells.findIndex((c) => /^status$/i.test(c.trim()));
  return idx >= 0 ? idx : 3;
}

/**
 * WR-02: known Progress-table header cell names. A `|`-row is only treated as
 * the header row when at least one of its cells matches one of these — this
 * skips the Markdown separator row (`|---|---|`) and blank rows, so
 * `findStatusColumn` never runs on separator cells and silently falls back to
 * the wrong index.
 */
const PROGRESS_HEADER_NAMES = /^(phase|status|milestone|plans complete|completed)$/i;

/**
 * WR-02: true when a `|`-row is a recognizable Progress-table header row —
 * i.e. at least one cell is a known header name. Separator rows (cells made
 * only of `-`/`:`) and blank rows return false so header detection skips them.
 */
function isHeaderRow(cells: string[]): boolean {
  return cells.some((c) => PROGRESS_HEADER_NAMES.test(c.trim()));
}

/**
 * WR-02: build a phase record from a Progress-table data row. Returns
 * undefined for non-data rows (header, separator, or rows without a
 * digit-prefixed phase cell). `statusCol` is the header-resolved Status
 * column index. Tolerant of extra/missing trailing columns.
 */
function parseProgressRow(
  line: string,
  statusCol: number,
): { number: string; name: string; milestoneLabel: string; done: boolean } | undefined {
  const cells = splitTableCells(line);
  // Required cells: phase (0), milestone (1), status (statusCol).
  if (!cells || cells.length < 2 || cells.length <= statusCol) {
    return undefined;
  }
  const phaseCell = PROGRESS_PHASE_CELL.exec(cells[0]);
  if (!phaseCell) {
    return undefined;
  }
  return {
    number: phaseCell[1].trim(),
    name: phaseCell[2].trim(),
    milestoneLabel: cells[1],
    done: isDoneStatus(cells[statusCol]),
  };
}

/**
 * Parse the `## Milestones` section into RoadmapMilestone records.
 * Returns undefined when no `## Milestones` section is present — the
 * flat-fallback signal. Total: never throws.
 */
function parseMilestonesSection(lines: string[]): RoadmapMilestone[] | undefined {
  let inMilestonesSection = false;
  let milestones: RoadmapMilestone[] | undefined;

  for (const line of lines) {
    if (MILESTONES_HEADING.test(line)) {
      inMilestonesSection = true;
      milestones = milestones ?? [];
      continue;
    }
    if (inMilestonesSection && H2_ANY.test(line)) {
      inMilestonesSection = false;
      continue;
    }
    if (inMilestonesSection) {
      const m = MILESTONE_BULLET_PATTERN.exec(line);
      if (m && milestones) {
        milestones.push({
          label: m[1].trim(),
          phases: [],
          description: m[2]?.trim() || undefined,
        });
      }
    }
  }

  return milestones;
}

/**
 * Parse a milestone-collapsed roadmap: phases come from the `## Progress`
 * table, milestones from the `## Milestones` section. Total: never throws;
 * a missing Progress table yields phases: [].
 */
function parseCollapsedRoadmap(lines: string[]): RoadmapData {
  const data: RoadmapData = { phases: [] };

  // H1 project name.
  for (const line of lines) {
    const h1 = H1.exec(line);
    if (h1) {
      data.projectName = h1[1].replace(ROADMAP_PREFIX, '');
      break;
    }
  }

  const milestones = parseMilestonesSection(lines);
  if (milestones !== undefined) {
    data.milestones = milestones;
  }

  // `## Progress` table rows → phases. WR-02: the header row is the first
  // `|`-row whose cells contain a recognizable header name — the Markdown
  // separator row (`|---|---|`) and blank rows are skipped, so its "Status"
  // cell position resolves statusCol correctly even if the separator row
  // appears first. Tables with extra/missing columns still map correctly.
  let inProgressSection = false;
  let statusCol = 3; // standard GSD position; overridden by the header row.
  let sawHeader = false;
  for (const line of lines) {
    if (PROGRESS_HEADING.test(line)) {
      inProgressSection = true;
      sawHeader = false;
      continue;
    }
    if (inProgressSection && H2_ANY.test(line)) {
      inProgressSection = false;
      continue;
    }
    if (inProgressSection) {
      if (!sawHeader) {
        const headerCells = splitTableCells(line);
        if (headerCells && isHeaderRow(headerCells)) {
          statusCol = findStatusColumn(headerCells);
          sawHeader = true;
        }
        // Separator/blank `|`-rows are not headers — keep looking. The header
        // row is never a data row (no digit-prefixed phase cell), so fall
        // through — parseProgressRow returns undefined for it.
      }
      const row = parseProgressRow(line, statusCol);
      if (row) {
        data.phases.push({
          number: row.number,
          name: row.name,
          milestoneLabel: row.milestoneLabel,
          done: row.done,
          // WR-04: collapsed phases have no `### Phase N:` detail section to
          // navigate to. headerLine 0 is an intentional "no detail header"
          // sentinel — provider.ts omits the openRoadmap command argument
          // for it, so clicking a collapsed phase opens ROADMAP.md without
          // a (wrong) scroll target.
          headerLine: 0,
          endLine: 0,
        });
      }
    }
  }

  // Populate each milestone's phase-number list from grouped phases.
  // CR-01: join on the version token (milestoneKey) — the Progress table's
  // milestone column ("v1.0") and the Milestones bullet label
  // ("v1.0 Foundation") never match by full-string equality.
  if (data.milestones) {
    for (const ms of data.milestones) {
      const key = milestoneKey(ms.label);
      ms.phases = data.phases
        .filter((p) => milestoneKey(p.milestoneLabel ?? '') === key)
        .map((p) => p.number);
    }
  }

  return data;
}

export function parseRoadmap(text: string): RoadmapData {
  const lines = splitLines(text);

  // Pass 1: collect done phase numbers AND detect whether any detail headers exist.
  const done = new Set<string>();
  let hasDetailHeaders = false;
  for (const line of lines) {
    const m = DONE_BULLET.exec(line);
    if (m) {
      done.add(m[1]);
    }
    if (!hasDetailHeaders && PHASE_HEADER.test(line)) {
      hasDetailHeaders = true;
    }
  }

  // Collapsed roadmap: zero `### Phase N:` headers — source phases from Progress table.
  if (!hasDetailHeaders) {
    return parseCollapsedRoadmap(lines);
  }

  const data: RoadmapData = { phases: [] };

  // Expanded roadmap: a `## Milestones` section, when present, still populates milestones.
  const expandedMilestones = parseMilestonesSection(lines);
  if (expandedMilestones !== undefined) {
    data.milestones = expandedMilestones;
  }

  // Pass 2: walk lines.
  let current: RoadmapPhase | undefined;
  let collectingSuccess = false;
  // Track the most recent `## Milestone vX.Y ...` H2 section so each phase
  // detail block under it inherits the milestone label. Without this, expanded
  // ROADMAPs render every phase under the synthetic "Other" milestone (#4).
  let currentMilestoneLabel: string | undefined;

  const closeCurrent = (endIdx: number): void => {
    if (current) {
      current.endLine = endIdx;
      data.phases.push(current);
      current = undefined;
      collectingSuccess = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!current && data.projectName === undefined) {
      const h1 = H1.exec(line);
      if (h1) {
        data.projectName = h1[1].replace(ROADMAP_PREFIX, '');
      }
    }

    // A `## Milestone vX.Y ...` H2 closes any open phase and updates the
    // milestone label inherited by subsequent `### Phase N:` blocks.
    const ms = MILESTONE.exec(line);
    if (ms) {
      closeCurrent(i);
      if (data.milestoneLabel === undefined) {
        data.milestoneLabel = ms[1];
      }
      currentMilestoneLabel = ms[1];
      continue;
    }

    const ph = PHASE_HEADER.exec(line);
    if (ph) {
      closeCurrent(i);
      current = {
        number: ph[1],
        name: ph[2],
        done: done.has(ph[1]),
        headerLine: i + 1,
        endLine: lines.length,
        milestoneLabel: currentMilestoneLabel,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (collectingSuccess) {
      const item = SUCCESS_ITEM.exec(line);
      if (item) {
        current.successCriteria = current.successCriteria ?? [];
        current.successCriteria.push(item[1]);
        continue;
      }
      // Blank line or next directive ends collection.
      if (line.length === 0 || DIRECTIVE.test(line)) {
        collectingSuccess = false;
      }
    }

    const g = GOAL.exec(line);
    if (g) {
      current.goal = g[1];
      continue;
    }
    const mo = MODE.exec(line);
    if (mo) {
      current.mode = mo[1];
      continue;
    }
    const d = DEPENDS_ON.exec(line);
    if (d) {
      current.dependsOn = d[1];
      continue;
    }
    const r = REQUIREMENTS.exec(line);
    if (r) {
      current.requirements = r[1].split(/,\s*/);
      continue;
    }
    if (SUCCESS_HEADER.test(line)) {
      collectingSuccess = true;
      current.successCriteria = [];
      continue;
    }
  }

  closeCurrent(lines.length);

  // Infer milestoneLabel for phases that weren't assigned by an H2 header.
  // ROADMAPs without `## Milestone vX.Y` sections (e.g. mcp_omni_connect)
  // express the phase→milestone link via the bullet description, like
  // `**v3.2 ...** — Phases 33–38`. Without this pass, every detail phase
  // falls into the synthetic "Other" bucket in the tree view (#4).
  if (data.milestones && data.milestones.length > 0) {
    const ranges = data.milestones.map((ms) => {
      const m = ms.description ? PHASE_RANGE.exec(ms.description) : null;
      return m ? { label: ms.label, start: parseFloat(m[1]), end: parseFloat(m[2]) } : null;
    });
    for (const phase of data.phases) {
      if (phase.milestoneLabel !== undefined) {
        continue;
      }
      const n = parseFloat(phase.number);
      const hit = ranges.find((r) => r !== null && n >= r.start && n <= r.end);
      if (hit) {
        phase.milestoneLabel = hit.label;
      }
    }
  }

  return data;
}
