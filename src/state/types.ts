/**
 * Pure GSD state types — zero vscode imports.
 *
 * Discriminated union for the StateController's output.
 * Plan 03-01 (StateController) consumes RoadmapData and StateData from the parsers.
 */

import type { RoadmapData, StateData } from '../parsers/types.js';

/**
 * GsdState represents the outcome of a StateController.refresh() call.
 *
 * - 'ok': both planning files were read and parsed successfully.
 * - 'no-project': the .planning/ folder or its files were not found (ENOENT).
 * - 'error': an unexpected I/O or parse error occurred.
 */
export type GsdState =
  | { kind: 'ok'; roadmap: RoadmapData; state: StateData }
  | { kind: 'no-project' }
  | { kind: 'error'; message: string };
