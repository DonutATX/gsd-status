import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(item);
  // IN-04: track disposal so a late-resolving updateStatusBar() doesn't
  // touch a disposed StatusBarItem. Phase 3's file watcher will reuse this.
  const lifecycle = { disposed: false };
  context.subscriptions.push({ dispose: () => { lifecycle.disposed = true; } });
  item.text = 'GSD: No project';
  item.show();

  // Fire-and-forget — never block activate()
  void updateStatusBar(item, lifecycle);
}

export function deactivate(): void {
  // No-op: context.subscriptions disposes the StatusBarItem.
}

async function updateStatusBar(
  item: vscode.StatusBarItem,
  lifecycle: { disposed: boolean }
): Promise<void> {
  // IN-04: defensive guard. Wrap the whole body so any throw during shutdown
  // (e.g., write to a disposed item) is swallowed rather than surfacing as
  // an unhandled rejection from the fire-and-forget call in activate().
  try {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      if (lifecycle.disposed) return;
      item.text = 'GSD: No project';
      return;
    }

    const roadmapPath = path.join(folder.uri.fsPath, '.planning', 'ROADMAP.md');
    let content: string;
    try {
      content = await fs.readFile(roadmapPath, 'utf8');
    } catch {
      if (lifecycle.disposed) return;
      item.text = 'GSD: No project';
      return;
    }

    try {
      const { milestone, phase } = parseLite(content);
      if (lifecycle.disposed) return;
      item.text = `$(pulse) ${milestone} › ${phase}`;
    } catch {
      if (lifecycle.disposed) return;
      item.text = 'GSD: Parse error';
    }
  } catch {
    // Last-resort guard — never let activate()'s fire-and-forget reject.
  }
}

function parseLite(md: string): { milestone: string; phase: string } {
  // Milestone: prefer first "## Milestone vX.Y" header; else first H1 with
  // "Roadmap:" prefix and/or "— Roadmap" suffix stripped; else literal "GSD".
  let milestone = 'GSD';
  const milestoneHeader = md.match(/^##\s+Milestone\s+v\d+\.\d+[^\n]*$/m);
  if (milestoneHeader) {
    milestone = milestoneHeader[0].replace(/^##\s+/, '').trim();
  } else {
    const h1 = md.match(/^#\s+(.+)$/m);
    if (h1) {
      let label = h1[1].trim();
      label = label.replace(/^Roadmap:\s*/, '');
      label = label.replace(/\s*—\s*Roadmap\s*$/, '');
      label = label.trim();
      if (label.length > 0) {
        milestone = label;
      }
    }
  }

  // Active phase: first "### Phase N: ..." section header whose phase number
  // is NOT marked done. Done-detection consults both the bullet-list
  // checkbox row ("- [x] **Phase N: ...") AND inline markers on the header
  // line itself ("✅" / "[x]"). WR-01: the bullet-list scan is required
  // because GSD ROADMAP.md tracks completion on the bullet, not the header.
  // This bumps parseLite to ~45 LOC — Phase 2 replaces it with a proper parser.
  const lines = md.split(/\r?\n/);
  const doneNumbers = new Set<string>();
  for (const line of lines) {
    const b = line.match(/^- \[[xX✅]\]\s+\*\*Phase\s+(\d+(?:\.\d+)?)/);
    if (b) doneNumbers.add(b[1]);
  }
  let phase: string | null = null;
  for (const line of lines) {
    const m = line.match(/^###\s+(Phase\s+(\d+(?:\.\d+)?):\s+.+?)\s*$/);
    if (!m) continue;
    if (doneNumbers.has(m[2])) continue;
    if (line.includes('✅')) continue;
    if (/\[x\]/i.test(line)) continue;
    phase = m[1].trim();
    break;
  }

  if (!phase) {
    throw new Error('No active phase found');
  }

  return { milestone: milestone.trim(), phase };
}
