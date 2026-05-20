/**
 * parseRoadmap — total, deterministic ROADMAP.md parser.
 *
 * Zero vscode imports. Linear regex only (no nested quantifiers, no `.*` followed by `.*`).
 * Two-pass scan: (1) collect done phase numbers from `- [x] **Phase N:` bullets,
 * (2) walk lines to extract H1 / milestone / phase headers and per-phase fields.
 */

import { splitLines } from './lines.js';
import type { RoadmapData, RoadmapPhase } from './types.js';

const DONE_BULLET = /^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/;
const H1 = /^#\s+(.+?)\s*$/;
const ROADMAP_PREFIX = /^Roadmap:\s*/;
const MILESTONE = /^##\s+Milestone\s+(v\d+(?:\.\d+)?[^\r\n]*)$/;
const PHASE_HEADER = /^###\s+Phase\s+(\d+(?:\.\d+)?):\s+(.+?)\s*$/;
const GOAL = /^\*\*Goal\*\*:\s*(.+?)\s*$/;
const MODE = /^\*\*Mode:\*\*\s*(.+?)\s*$/;
const DEPENDS_ON = /^\*\*Depends on\*\*:\s*(.+?)\s*$/;
const REQUIREMENTS = /^\*\*Requirements\*\*:\s*(.+?)\s*$/;
const SUCCESS_HEADER = /^\*\*Success Criteria\*\*/;
const SUCCESS_ITEM = /^\s+\d+\.\s+(.+?)\s*$/;
const DIRECTIVE = /^\*\*/;

export function parseRoadmap(text: string): RoadmapData {
  const lines = splitLines(text);

  // Pass 1: collect done phase numbers.
  const done = new Set<string>();
  for (const line of lines) {
    const m = DONE_BULLET.exec(line);
    if (m) {
      done.add(m[1]);
    }
  }

  const data: RoadmapData = { phases: [] };

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
