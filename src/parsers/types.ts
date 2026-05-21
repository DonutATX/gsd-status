/**
 * Pure types — zero vscode imports.
 *
 * Shared type surface for the ROADMAP.md / STATE.md parsers.
 * Plan 02 (parseRoadmap, parseState) consumes these exports.
 */

export interface RoadmapPhase {
  number: string;
  name: string;
  goal?: string;
  mode?: string;
  dependsOn?: string;
  requirements?: string[];
  successCriteria?: string[];
  done: boolean;
  headerLine: number;
  endLine: number;
}

export interface RoadmapData {
  projectName?: string;
  milestoneLabel?: string;
  phases: RoadmapPhase[];
}

export interface StateEntry {
  text: string;
  timestamp?: string;
  raw: string;
}

export interface StateData {
  milestone?: string;
  milestoneName?: string;
  phaseNumber?: string;
  phaseName?: string;
  lastEntry?: StateEntry;
  lastUpdated?: string;
  status?: string;
  recentEntries?: StateEntry[];
}
