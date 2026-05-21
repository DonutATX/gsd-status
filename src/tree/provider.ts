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
import type { GsdTreeItem } from './items.js';

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
   */
  setRecentCount(n: number): void {
    this._recentCount = n;
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
        const state = isActive
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed;
        const item = new vscode.TreeItem(phase.name, state);
        item.id = `phase-${phase.number}`;
        if (isActive) {
          item.iconPath = new vscode.ThemeIcon('play');
        } else if (phase.done) {
          item.iconPath = new vscode.ThemeIcon('pass-filled');
        } else {
          item.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        item.command = {
          command: 'gsd.openRoadmap',
          title: 'Open Roadmap',
          arguments: [phase.headerLine],
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
        item.id = `activity-${element.index}`;
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

    // ok state: [Recent Activity section, ...phase nodes]
    const section: GsdTreeItem = {
      kind: 'section',
      label: 'Recent Activity',
      id: 'recent-activity-section',
    };

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

    return entries.slice(0, this._recentCount).map(
      (entry, index): GsdTreeItem => ({ kind: 'activity', entry, index }),
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
