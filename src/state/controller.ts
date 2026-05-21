/**
 * StateController — vscode-integrated implementation (Plan 03-02).
 *
 * Owns a debounced FileSystemWatcher + 30-second periodic fallback timer.
 * Emits GsdState events via vscode.EventEmitter<GsdState> (replaces hand-rolled
 * listener array from Plan 03-01).
 *
 * Reads ROADMAP.md and STATE.md atomically via Promise.all, emits a single GsdState
 * event per refresh() call. All I/O and parse errors are caught and emitted as
 * kind:'error' or kind:'no-project' — refresh() never rejects (WSP-02, WSP-03, WSP-04).
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseRoadmap } from '../parsers/roadmap.js';
import { parseState } from '../parsers/state.js';
import { debounce } from './debounce.js';
import type { GsdState } from './types.js';

const DEBOUNCE_MS = 300;
const REFRESH_INTERVAL_MS = 30_000;

/**
 * Default file reader: reads ROADMAP.md and STATE.md from base using Promise.all.
 */
async function defaultReadFiles(base: string): Promise<{ roadmapText: string; stateText: string }> {
  const [roadmapText, stateText] = await Promise.all([
    fs.readFile(path.join(base, 'ROADMAP.md'), 'utf8'),
    fs.readFile(path.join(base, 'STATE.md'), 'utf8'),
  ]);
  return { roadmapText, stateText };
}

export class StateController implements vscode.Disposable {
  private readonly _emitter = new vscode.EventEmitter<GsdState>();
  readonly onStateChanged: vscode.Event<GsdState> = this._emitter.event;

  private readonly _folder: vscode.WorkspaceFolder | { uri: { fsPath: string } } | undefined;
  private readonly _readFiles: (base: string) => Promise<{ roadmapText: string; stateText: string }>;
  private readonly _watcher: vscode.FileSystemWatcher | undefined;
  private readonly _timerDisposable: vscode.Disposable;

  constructor(
    folder: vscode.WorkspaceFolder | { uri: { fsPath: string } } | undefined,
    readFiles?: (base: string) => Promise<{ roadmapText: string; stateText: string }>,
  ) {
    this._folder = folder;
    this._readFiles = readFiles ?? defaultReadFiles;

    if (folder) {
      const pattern = new vscode.RelativePattern(
        folder as vscode.WorkspaceFolder,
        '.planning/{ROADMAP,STATE}.md',
      );
      this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const debouncedRefresh = debounce(() => void this.refresh(), DEBOUNCE_MS);
      this._watcher.onDidChange(debouncedRefresh);
      this._watcher.onDidCreate(debouncedRefresh);
      this._watcher.onDidDelete(debouncedRefresh);
    }

    const id = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
    this._timerDisposable = { dispose: () => clearInterval(id) };
  }

  /**
   * Reads both planning files atomically and emits exactly one GsdState event.
   * Never rejects — all errors are caught and emitted as kind:'error' or kind:'no-project'.
   */
  async refresh(): Promise<void> {
    if (!this._folder) {
      this._emitter.fire({ kind: 'no-project' });
      return;
    }

    const base = path.join(this._folder.uri.fsPath, '.planning');

    try {
      const { roadmapText, stateText } = await this._readFiles(base);
      const roadmap = parseRoadmap(roadmapText);
      const state = parseState(stateText);
      this._emitter.fire({ kind: 'ok', roadmap, state });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this._emitter.fire({ kind: 'no-project' });
      } else {
        this._emitter.fire({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  dispose(): void {
    this._watcher?.dispose();
    this._timerDisposable.dispose();
    this._emitter.dispose();
  }
}
