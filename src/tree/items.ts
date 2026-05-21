/**
 * GsdTreeItem — discriminated union for all tree node types.
 *
 * Zero vscode imports: these are plain data objects. TreeItem instances
 * are built only inside provider.ts getTreeItem(). This keeps items.ts
 * free of VS Code API coupling and testable under bare Mocha.
 */

import type { RoadmapPhase, StateEntry } from '../parsers/types.js';

export type GsdTreeItem =
  | { kind: 'section';     label: string; id: string }
  | { kind: 'phase';       phase: RoadmapPhase; isActive: boolean }
  | { kind: 'goal';        text: string; phaseId: string }
  | { kind: 'criterion';   text: string; phaseId: string; index: number }
  | { kind: 'activity';    entry: StateEntry; index: number }
  | { kind: 'placeholder'; label: string; id: string };
