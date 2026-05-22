/**
 * GsdTreeProvider — TreeDataProvider implementation for the GSD Activity Bar panel.
 *
 * Converts a GsdState snapshot into VS Code tree nodes (GsdTreeItem).
 * Fires onDidChangeTreeData(undefined) on every update() call to request
 * a full tree refresh while preserving user-expanded nodes via stable ids.
 *
 * Plans: PANL-02 (phase list), PANL-03 (phase expansion), PANL-04 (recent activity),
 *        PANL-07 (stable identity, onDidChangeTreeData).
 */

import * as vscode from 'vscode';
import type { GsdState } from '../state/types.js';
import type { StateEntry } from '../parsers/types.js';
import { milestoneKey } from '../parsers/roadmap.js';
import type { GsdTreeItem } from './items.js';

/**
 * Produce a collision-resistant tree id for a milestone node.
 *
 * Lower-cases the label, collapses runs of non-alphanumeric characters to `-`,
 * and trims leading/trailing `-`, then prefixes with `milestone-`.
 * Example: "v1.0 Checklists & Callouts" → "milestone-v1-0-checklists-callouts"
 *
 * Deterministic output preserves the PANL-07 expansion-stability guarantee.
 */
function slugify(label: string): string {
  return `milestone-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * Build collision-deduplicated ids for a list of milestone labels.
 *
 * If two labels produce the same slug (rare in practice — real milestone labels
 * contain version numbers), the 2nd+ collision appends `#N` to avoid VS Code
 * silently dropping a milestone node (RESEARCH Pitfall 4).
 */
function buildMilestoneIds(labels: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const base = slugify(label);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}#${count}`;
  });
}

/**
 * WR-04: build a content-stable id fragment for a Recent Activity entry.
 *
 * Uses the entry timestamp plus a short FNV-1a hash of the raw line, so the
 * id tracks the entry's content rather than its position in the array. Two
 * different entries are extremely unlikely to collide; the same entry always
 * yields the same id across refreshes, which is what VS Code keys reveal and
 * selection on.
 */
function activityId(entry: StateEntry): string {
  let hash = 0x811c9dc5;
  const raw = entry.raw;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const slug = (hash >>> 0).toString(16);
  return `${entry.timestamp ?? ''}-${slug}`;
}

/**
 * WR-01: assign each activity node a tree id, disambiguating any collisions.
 *
 * activityId() is a pure function of entry content, so two STATE.md activity
 * lines with identical raw text produce the identical id. VS Code requires
 * TreeItem.id to be unique within the tree — duplicate ids cause unpredictable
 * selection/reveal and can drop nodes. We append a `#N` counter ONLY to the
 * 2nd+ occurrence of a colliding id, so the common case (every raw differs)
 * keeps fully content-stable ids and only true duplicates pay the positional
 * suffix. This preserves the PANL-07 expansion-preservation goal.
 */
function buildActivityIds(entries: readonly StateEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const base = `activity-${activityId(entry)}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}#${count}`;
  });
}

export class GsdTreeProvider
  implements vscode.TreeDataProvider<GsdTreeItem>, vscode.Disposable
{
  private readonly _emitter = new vscode.EventEmitter<GsdTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._emitter.event;

  private _state: GsdState = { kind: 'no-project' };
  private _recentCount = 5;

  /**
   * Store a new GsdState snapshot and fire a full-tree refresh event.
   */
  update(state: GsdState): void {
    this._state = state;
    this._emitter.fire(undefined);
  }

  /**
   * Set the maximum number of Recent Activity entries to show.
   * Called by extension.ts using the gsd.recentActivityCount setting.
   *
   * WR-02: package.json declares "minimum": 1, but VS Code does not enforce
   * it on programmatic reads — a hand-edited settings.json can supply 0, a
   * negative, or a float. Clamp to a positive integer (fall back to 5) so a
   * bad value never produces a confusing empty/short panel.
   */
  setRecentCount(n: number): void {
    this._recentCount = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
  }

  // ---------------------------------------------------------------------------
  // TreeDataProvider implementation
  // ---------------------------------------------------------------------------

  getTreeItem(element: GsdTreeItem): vscode.TreeItem {
    switch (element.kind) {
      case 'section': {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
        item.id = element.id;
        item.iconPath = new vscode.ThemeIcon('history');
        return item;
      }

      case 'phase': {
        const { phase, isActive } = element;
        // A phase node only has children when it carries a goal or success
        // criteria. Collapsed/archived phases (parsed from a Progress-table
        // row) have neither — give them `None` so VS Code does not render an
        // expand chevron that opens to nothing.
        const hasChildren =
          !!phase.goal || (phase.successCriteria?.length ?? 0) > 0;
        const state = !hasChildren
          ? vscode.TreeItemCollapsibleState.None
          : isActive
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed;
        const item = new vscode.TreeItem(`${phase.number}: ${phase.name}`, state);
        item.id = `phase-${phase.number}`;
        if (isActive) {
          item.iconPath = new vscode.ThemeIcon('play');
        } else if (phase.done) {
          item.iconPath = new vscode.ThemeIcon('pass-filled');
        } else {
          item.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        // WR-04: collapsed-roadmap phases carry headerLine 0 — they have no
        // `### Phase N:` detail section to scroll to. Omit the line argument
        // for those so the command opens ROADMAP.md with no (wrong) jump;
        // expanded phases keep their 1-based headerLine argument.
        item.command = {
          command: 'gsd.openRoadmap',
          title: 'Open Roadmap',
          arguments: phase.headerLine >= 1 ? [phase.headerLine] : [],
        };
        return item;
      }

      case 'goal': {
        const item = new vscode.TreeItem(`Goal: ${element.text}`, vscode.TreeItemCollapsibleState.None);
        item.id = `goal-${element.phaseId}`;
        item.iconPath = new vscode.ThemeIcon('target');
        return item;
      }

      case 'criterion': {
        const item = new vscode.TreeItem(element.text, vscode.TreeItemCollapsibleState.None);
        item.id = `criterion-${element.phaseId}-${element.index}`;
        item.iconPath = new vscode.ThemeIcon('check');
        return item;
      }

      case 'activity': {
        const item = new vscode.TreeItem(element.entry.text, vscode.TreeItemCollapsibleState.None);
        // WR-04 / WR-01: the id is a content-stable hash of the entry (not the
        // array position), pre-computed in _getActivityChildren so that any
        // colliding ids (identical raw text) can be disambiguated across the
        // whole snapshot.
        item.id = element.id;
        item.iconPath = new vscode.ThemeIcon('pulse');
        item.description = element.entry.timestamp;
        item.command = {
          command: 'gsd.openState',
          title: 'Open State',
        };
        return item;
      }

      case 'placeholder': {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.id = element.id;
        return item;
      }

      case 'milestone': {
        const collapsibleState = element.isActive
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed;
        const allDone = element.phases.every(p => p.done);
        const item = new vscode.TreeItem(element.label, collapsibleState);
        item.id = element.id;
        if (element.description) {
          item.description = element.description;
        }
        item.iconPath = new vscode.ThemeIcon(allDone ? 'check-all' : 'milestone');
        // No command — milestone nodes expand/collapse only
        return item;
      }
    }
  }

  getChildren(element?: GsdTreeItem): GsdTreeItem[] {
    // Root: no element — return top-level nodes based on state kind
    if (!element) {
      return this._getRootChildren();
    }

    // Section node: return Recent Activity entries
    if (element.kind === 'section') {
      return this._getActivityChildren();
    }

    // Milestone node: return the phase nodes for this milestone
    if (element.kind === 'milestone') {
      if (this._state.kind !== 'ok') {
        return [];
      }
      const activePhaseNumber = this._state.state.phaseNumber;
      return element.phases.map(
        (phase): GsdTreeItem => ({
          kind: 'phase',
          phase,
          isActive: phase.number === activePhaseNumber,
        }),
      );
    }

    // Phase node: return goal + criteria children
    if (element.kind === 'phase') {
      return this._getPhaseChildren(element);
    }

    // All other nodes are leaves
    return [];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _getRootChildren(): GsdTreeItem[] {
    const state = this._state;

    if (state.kind === 'no-project') {
      return [];
    }

    if (state.kind === 'error') {
      return [{ kind: 'placeholder', label: 'Error reading GSD files', id: 'error-placeholder' }];
    }

    // ok state: [Recent Activity section, ...milestone nodes OR ...phase nodes]
    const section: GsdTreeItem = {
      kind: 'section',
      label: 'Recent Activity',
      id: 'recent-activity-section',
    };

    // Milestone-grouped layout when milestones array is present and non-empty
    if (state.roadmap.milestones && state.roadmap.milestones.length > 0) {
      // WR-01: a synthetic "Other" milestone label is appended only when some
      // phases failed to join any parsed milestone, so its id is computed in
      // the same buildMilestoneIds pass to stay collision-deduplicated.
      const milestoneLabels = state.roadmap.milestones.map(ms => ms.label);
      const assigned = new Set<string>();
      const milestoneNodes: GsdTreeItem[] = state.roadmap.milestones.map(
        (ms): GsdTreeItem => {
          // CR-01: join on the version token — the Progress table milestone
          // column ("v1.0") never equals the Milestones bullet label
          // ("v1.0 Foundation") by full-string comparison.
          const msKey = milestoneKey(ms.label);
          const msPhases = state.roadmap.phases.filter(
            p => milestoneKey(p.milestoneLabel ?? '') === msKey,
          );
          for (const p of msPhases) {
            assigned.add(p.number);
          }
          const isActive = msPhases.some(p => p.number === state.state.phaseNumber);
          return {
            kind: 'milestone',
            label: ms.label,
            // id assigned after the loop, once the full label list is known.
            id: '',
            description: ms.description,
            isActive,
            phases: msPhases,
          };
        },
      );

      // WR-01: collect any phase that joined no milestone (e.g. its
      // milestoneLabel has no `v\d+` token and matches no `## Milestones`
      // bullet). Without this, such phases vanish entirely — the flat
      // fallback is skipped because `milestones` is non-empty. Surface them
      // under a synthetic trailing "Other" milestone so no phase disappears.
      const orphans = state.roadmap.phases.filter(p => !assigned.has(p.number));
      if (orphans.length > 0) {
        milestoneLabels.push('Other');
        milestoneNodes.push({
          kind: 'milestone',
          label: 'Other',
          id: '',
          isActive: orphans.some(p => p.number === state.state.phaseNumber),
          phases: orphans,
        });
      }

      const ids = buildMilestoneIds(milestoneLabels);
      milestoneNodes.forEach((node, i) => {
        if (node.kind === 'milestone') {
          node.id = ids[i];
        }
      });
      return [section, ...milestoneNodes];
    }

    // Flat fallback — no milestones section: existing phase-list layout (Phase 5)
    const phaseNodes: GsdTreeItem[] = state.roadmap.phases.map(
      (phase): GsdTreeItem => ({
        kind: 'phase',
        phase,
        isActive: phase.number === state.state.phaseNumber,
      }),
    );

    return [section, ...phaseNodes];
  }

  private _getActivityChildren(): GsdTreeItem[] {
    if (this._state.kind !== 'ok') {
      return [];
    }

    const entries = this._state.state.recentEntries;
    if (!entries || entries.length === 0) {
      return [{ kind: 'placeholder', label: 'No recent activity', id: 'no-activity-placeholder' }];
    }

    const visible = entries.slice(0, this._recentCount);
    const ids = buildActivityIds(visible);
    return visible.map(
      (entry, index): GsdTreeItem => ({ kind: 'activity', entry, index, id: ids[index] }),
    );
  }

  private _getPhaseChildren(element: Extract<GsdTreeItem, { kind: 'phase' }>): GsdTreeItem[] {
    const { phase } = element;
    const children: GsdTreeItem[] = [];

    if (phase.goal) {
      children.push({ kind: 'goal', text: phase.goal, phaseId: phase.number });
    }

    if (phase.successCriteria && phase.successCriteria.length > 0) {
      for (let i = 0; i < phase.successCriteria.length; i++) {
        children.push({
          kind: 'criterion',
          text: phase.successCriteria[i],
          phaseId: phase.number,
          index: i,
        });
      }
    }

    return children;
  }

  dispose(): void {
    this._emitter.dispose();
  }
}
