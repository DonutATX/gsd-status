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
  private _timerDisposable: vscode.Disposable;

  /** Guard against post-dispose timer leaks (T-04-06). */
  private _disposed = false;

  /**
   * Monotonic refresh counter. Each refresh() call captures its own generation;
   * if a newer refresh starts before an older one finishes its await, the older
   * one drops its result so it cannot emit stale state out of order (WR-01).
   */
  private _generation = 0;

  constructor(
    folder: vscode.WorkspaceFolder | { uri: { fsPath: string } } | undefined,
    readFiles?: (base: string) => Promise<{ roadmapText: string; stateText: string }>,
  ) {
    this._folder = folder;
    this._readFiles = readFiles ?? defaultReadFiles;

    // Defense-in-depth (WR-02): refresh() is contracted never to reject, but
    // attach a .catch so any future regression is logged rather than becoming
    // a silent unhandled rejection that crashes the extension host.
    const safeRefresh = (): void => {
      this.refresh().catch((e) => console.error('GSD refresh failed', e));
    };

    if (folder) {
      const pattern = new vscode.RelativePattern(
        folder as vscode.WorkspaceFolder,
        '.planning/{ROADMAP,STATE}.md',
      );
      this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const debouncedRefresh = debounce(safeRefresh, DEBOUNCE_MS);
      this._watcher.onDidChange(debouncedRefresh);
      this._watcher.onDidCreate(debouncedRefresh);
      this._watcher.onDidDelete(debouncedRefresh);
    }

    const id = setInterval(safeRefresh, REFRESH_INTERVAL_MS);
    this._timerDisposable = { dispose: () => clearInterval(id) };
  }

  /**
   * Reads both planning files atomically and emits exactly one GsdState event.
   * Never rejects — all errors are caught and emitted as kind:'error' or kind:'no-project'.
   */
  async refresh(): Promise<void> {
    // Capture this refresh's generation. If a newer refresh starts during our
    // await, our generation will be stale and we drop our result (WR-01).
    const gen = ++this._generation;

    if (!this._folder) {
      this._emitter.fire({ kind: 'no-project' });
      return;
    }

    const base = path.join(this._folder.uri.fsPath, '.planning');

    try {
      const { roadmapText, stateText } = await this._readFiles(base);
      if (gen !== this._generation) return; // superseded by a newer refresh
      const roadmap = parseRoadmap(roadmapText);
      const state = parseState(stateText);
      // The Phase 2 parsers are total — they never throw, even on gibberish
      // (PARS-03). A file that yields zero phases is not a recognizable GSD
      // roadmap, so surface it as an error rather than a degenerate ok state
      // that would render as "All phases done" (success criterion 3 / WSP-04).
      if (roadmap.phases.length === 0) {
        this._emitter.fire({
          kind: 'error',
          message: 'ROADMAP.md has no recognizable GSD phases',
        });
        return;
      }
      this._emitter.fire({ kind: 'ok', roadmap, state });
    } catch (err) {
      if (gen !== this._generation) return; // superseded by a newer refresh
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

  /**
   * Replace the periodic refresh timer with a new one at the given interval.
   * Clamps to a 5-second minimum (T-04-05 — prevents busy-loop DoS).
   * Returns early if already disposed (T-04-06 — prevents leaked timer).
   */
  setRefreshInterval(seconds: number): void {
    if (this._disposed) return;
    // CR-01: Math.max(5, NaN) returns NaN, and setInterval(fn, NaN) is treated
    // as a 0ms interval — defeating the clamp and causing a busy-loop. Coerce
    // any non-finite input to the 30s default before clamping.
    const safe = Number.isFinite(seconds) ? seconds : 30;
    const ms = Math.max(5, safe) * 1000; // defensive clamp; finite + minimum 5s
    this._timerDisposable.dispose(); // clear old interval
    const safeRefresh = (): void => {
      this.refresh().catch((e) => console.error('GSD refresh failed', e));
    };
    const id = setInterval(safeRefresh, ms);
    this._timerDisposable = { dispose: () => clearInterval(id) };
  }

  dispose(): void {
    this._disposed = true;
    this._watcher?.dispose();
    this._timerDisposable.dispose();
    this._emitter.dispose();
  }
}
