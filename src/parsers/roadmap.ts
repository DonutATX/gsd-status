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
// `- ✅ **label**` or `- [x] **label**`, with an optional em-dash tail.
const MILESTONE_BULLET_PATTERN = /^-\s+(?:✅|\[[xX]\])\s+\*\*(.+?)\*\*(?:\s+—\s+(.+?))?\s*$/;
const PROGRESS_HEADING = /^##\s+Progress\s*$/;
// First cell must start with a digit — naturally excludes the header and
// separator rows (RESEARCH Pitfall 3). Linear: no `.*` followed by `.*`.
const PROGRESS_ROW_PATTERN =
  /^\|\s*(\d+(?:-\d+)?)\.\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|[^|]+\|\s*([^|]+?)\s*\|/;
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

  // `## Progress` table rows → phases.
  let inProgressSection = false;
  for (const line of lines) {
    if (PROGRESS_HEADING.test(line)) {
      inProgressSection = true;
      continue;
    }
    if (inProgressSection && H2_ANY.test(line)) {
      inProgressSection = false;
      continue;
    }
    if (inProgressSection) {
      const m = PROGRESS_ROW_PATTERN.exec(line);
      if (m) {
        data.phases.push({
          number: m[1].trim(),
          name: m[2].trim(),
          milestoneLabel: m[3].trim(),
          done: /^complete$/i.test(m[4].trim()),
          headerLine: 0,
          endLine: 0,
        });
      }
    }
  }

  // Populate each milestone's phase-number list from grouped phases.
  if (data.milestones) {
    for (const ms of data.milestones) {
      ms.phases = data.phases
        .filter((p) => p.milestoneLabel === ms.label)
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

    if (!current) {
      // Top-level: H1 title or milestone heading.
      if (data.projectName === undefined) {
        const h1 = H1.exec(line);
        if (h1) {
          data.projectName = h1[1].replace(ROADMAP_PREFIX, '');
        }
      }
      if (data.milestoneLabel === undefined) {
        const ms = MILESTONE.exec(line);
        if (ms) {
          data.milestoneLabel = ms[1];
        }
      }
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

  return data;
}
