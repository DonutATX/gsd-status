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
  /**
   * 1-based line of the `### Phase N:` header in ROADMAP.md, used as the
   * scroll target for the openRoadmap command. WR-04: collapsed-roadmap
   * phases (sourced from the `## Progress` table) have no detail header —
   * they carry the sentinel value `0`, meaning "no navigation target".
   */
  headerLine: number;
  endLine: number;
  milestoneLabel?: string;
}

export interface RoadmapMilestone {
  label: string;
  phases: string[];
  description?: string;
}

export interface RoadmapData {
  projectName?: string;
  milestoneLabel?: string;
  milestones?: RoadmapMilestone[];
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
