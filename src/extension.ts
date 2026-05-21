import * as vscode from 'vscode';
import * as path from 'node:path';
import { StateController } from './state/controller.js';
import { buildOkTooltip, buildErrorTooltip } from './state/tooltip.js';

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

  // Live config reload: restart the periodic timer when the user changes the interval setting.
  // Use the fully-qualified key ('gsd.refreshIntervalSeconds') to avoid spurious restarts
  // when gsd.recentActivityCount changes (Pitfall 6 — RESEARCH.md).
  // gsd.recentActivityCount: Phase 5 will consume; no live action needed in Phase 4.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (lifecycle.disposed) return;
      if (event.affectsConfiguration('gsd.refreshIntervalSeconds')) {
        const seconds = vscode.workspace.getConfiguration('gsd')
          .get<number>('refreshIntervalSeconds', 30);
        controller.setRefreshInterval(seconds);
      }
    })
  );

  void controller.refresh();
}

export function deactivate(): void {
  // No-op: context.subscriptions disposes all registered resources.
}
