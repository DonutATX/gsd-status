import * as vscode from 'vscode';
import { StateController } from './state/controller.js';

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

  context.subscriptions.push(
    controller.onStateChanged(state => {
      if (lifecycle.disposed) return;
      switch (state.kind) {
        case 'ok': {
          const milestone = state.roadmap.milestoneLabel ?? state.roadmap.projectName ?? 'GSD';
          const active = state.roadmap.phases.find(p => !p.done);
          const phase = active ? `Phase ${active.number}: ${active.name}` : 'All phases done';
          item.text = `$(pulse) ${milestone} › ${phase}`;
          break;
        }
        case 'no-project':
          item.text = 'GSD: No project';
          break;
        case 'error':
          item.text = '$(error) GSD: Error';
          item.tooltip = 'Error parsing GSD files';
          break;
      }
    })
  );

  void controller.refresh();
}

export function deactivate(): void {
  // No-op: context.subscriptions disposes all registered resources.
}
