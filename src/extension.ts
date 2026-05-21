import * as vscode from 'vscode';
import * as path from 'node:path';
import { StateController } from './state/controller.js';
import { buildOkTooltip, buildErrorTooltip } from './state/tooltip.js';
import { GsdTreeProvider } from './tree/provider.js';

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(item);
  // IN-04: track disposal so a late-fired onStateChanged callback doesn't
  // touch a disposed StatusBarItem (RESEARCH.md Pitfall 5).
  const lifecycle = { disposed: false };
  context.subscriptions.push({ dispose: () => { lifecycle.disposed = true; } });
  item.text = 'GSD: No project';
  item.show();

  const folder = vscode.workspace.workspaceFolders?.[0];
  const controller = new StateController(folder);
  context.subscriptions.push(controller);

  // Compute planning base path from workspace folder (if any).
  const planningBase = folder
    ? path.join(folder.uri.fsPath, '.planning')
    : undefined;

  // Helper: open a file inside .planning/, show info message if absent.
  async function openFile(filename: string): Promise<void> {
    if (!planningBase) {
      vscode.window.showInformationMessage(`GSD: ${filename} not found in .planning/`);
      return;
    }
    const uri = vscode.Uri.file(path.join(planningBase, filename));
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch {
      vscode.window.showInformationMessage(`GSD: ${filename} not found in .planning/`);
    }
  }

  // Register all commands BEFORE assigning item.command (anti-pattern: assign before register).
  context.subscriptions.push(
    vscode.commands.registerCommand('gsd.refresh', () => { void controller.refresh(); }),
    vscode.commands.registerCommand('gsd.openRoadmap', () => { void openFile('ROADMAP.md'); }),
    vscode.commands.registerCommand('gsd.openState', () => { void openFile('STATE.md'); }),
  );

  item.command = 'gsd.openState';

  // Tree provider wiring — PANL-01, PANL-05, PANL-06.
  const provider = new GsdTreeProvider();
  const recentCount = vscode.workspace.getConfiguration('gsd', folder?.uri)
    .get<number>('recentActivityCount', 5);
  provider.setRecentCount(recentCount);
  const treeView = vscode.window.createTreeView('gsd.treeView', {
    treeDataProvider: provider,
    showCollapseAll: false,
  });
  context.subscriptions.push(treeView, provider);

  context.subscriptions.push(
    vscode.commands.registerCommand('gsd.refreshTree', () => { void controller.refresh(); }),
  );

  // Second onStateChanged subscription: drive setContext + provider update.
  // Registered BEFORE void controller.refresh() so first event sets gsd.hasProject
  // on initial load (prevents welcome-view flash — RESEARCH.md Pitfall 2).
  context.subscriptions.push(
    controller.onStateChanged(state => {
      if (lifecycle.disposed) return;
      void vscode.commands.executeCommand('setContext', 'gsd.hasProject', state.kind === 'ok');
      provider.update(state);
    }),
  );

  context.subscriptions.push(
    controller.onStateChanged(state => {
      if (lifecycle.disposed) return;
      switch (state.kind) {
        case 'ok': {
          const milestone = state.roadmap.milestoneLabel ?? state.roadmap.projectName ?? 'GSD';
          const active = state.roadmap.phases.find(p => !p.done);
          const phase = active ? `Phase ${active.number}: ${active.name}` : 'All phases done';
          item.text = `$(pulse) ${milestone} › ${phase}`;
          item.tooltip = buildOkTooltip(state.roadmap, state.state);
          break;
        }
        case 'no-project':
          item.text = 'GSD: No project';
          item.tooltip = undefined;
          break;
        case 'error':
          item.text = '$(error) GSD: Error';
          item.tooltip = buildErrorTooltip(state.message);
          break;
      }
    })
  );

  // WR-01: honor a project's configured refresh interval on activation.
  // The controller's constructor starts a timer at the hardcoded 30s default;
  // without this read, a custom gsd.refreshIntervalSeconds is ignored until the
  // user edits the setting. WR-04: scope the read to the controller's folder so
  // a multi-root workspace applies the correct folder's value.
  const initialInterval = vscode.workspace.getConfiguration('gsd', folder?.uri)
    .get<number>('refreshIntervalSeconds', 30);
  controller.setRefreshInterval(initialInterval);

  // Live config reload: restart the periodic timer when the user changes the interval setting.
  // Use the fully-qualified key ('gsd.refreshIntervalSeconds') to avoid spurious restarts
  // when gsd.recentActivityCount changes (Pitfall 6 — RESEARCH.md).
  // gsd.recentActivityCount: Phase 5 will consume; no live action needed in Phase 4.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (lifecycle.disposed) return;
      // WR-04: pass the controller's folder URI so affectsConfiguration and the
      // subsequent read both resolve the value for the folder the controller
      // is bound to (workspaceFolders[0]).
      if (event.affectsConfiguration('gsd.refreshIntervalSeconds', folder?.uri)) {
        const seconds = vscode.workspace.getConfiguration('gsd', folder?.uri)
          .get<number>('refreshIntervalSeconds', 30);
        controller.setRefreshInterval(seconds);
      }
      if (event.affectsConfiguration('gsd.recentActivityCount', folder?.uri)) {
        const count = vscode.workspace.getConfiguration('gsd', folder?.uri)
          .get<number>('recentActivityCount', 5);
        provider.setRecentCount(count);
        void controller.refresh();
      }
    })
  );

  void controller.refresh();
}

export function deactivate(): void {
  // No-op: context.subscriptions disposes all registered resources.
}
