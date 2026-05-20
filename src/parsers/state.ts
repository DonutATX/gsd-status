/**
 * parseState — total, deterministic STATE.md parser.
 *
 * Zero vscode imports. Linear regex only. Single-pass body scan.
 * Pulls top-level frontmatter (milestone, milestone_name, status, last_updated, last_activity)
 * and body fields (`Phase: N of M (Name)`, `Last activity: …`). Body wins over frontmatter.
 */

import { splitLines, readFrontmatter, stripQuotes } from './lines.js';
import type { StateData, StateEntry } from './types.js';

const POSITION = /^Phase:\s+(\d+(?:\.\d+)?)\s+of\s+\d+\s+\((.+?)\)\s*$/;
const LAST_ACT = /^Last activity:\s+(.+?)\s*$/;
const ISO_OR_DATE = /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}[^\s"]*)?)/;

function buildEntry(raw: string): StateEntry {
  const m = ISO_OR_DATE.exec(raw);
  return {
    text: raw,
    raw,
    timestamp: m ? m[1] : undefined,
  };
}

export function parseState(text: string): StateData {
  const lines = splitLines(text);
  const fm = readFrontmatter(lines);
  const data: StateData = {};

  const milestone = fm.get('milestone');
  if (milestone !== undefined) {
    data.milestone = stripQuotes(milestone);
  }
  const milestoneName = fm.get('milestone_name');
  if (milestoneName !== undefined) {
    data.milestoneName = stripQuotes(milestoneName);
  }
  const status = fm.get('status');
  if (status !== undefined) {
    data.status = stripQuotes(status);
  }
  const lastUpdated = fm.get('last_updated');
  if (lastUpdated !== undefined) {
    data.lastUpdated = stripQuotes(lastUpdated);
  }

  // Body scan.
  let bodyLastActivity: string | undefined;
  for (const line of lines) {
    const p = POSITION.exec(line);
    if (p && data.phaseNumber === undefined) {
      data.phaseNumber = p[1];
      data.phaseName = p[2];
      continue;
    }
    const la = LAST_ACT.exec(line);
    if (la && bodyLastActivity === undefined) {
      bodyLastActivity = la[1];
    }
  }

  if (bodyLastActivity !== undefined) {
    data.lastEntry = buildEntry(bodyLastActivity);
  } else {
    const fmLastActivity = fm.get('last_activity');
    if (fmLastActivity !== undefined) {
      // stripQuotes returns string when given string; fall back to the raw
      // frontmatter value if it ever widens to undefined. Avoids unsafe cast.
      const stripped = stripQuotes(fmLastActivity) ?? fmLastActivity;
      data.lastEntry = buildEntry(stripped);
    }
  }

  return data;
}
