/**
 * StateController — pure-Node implementation (zero vscode imports in Plan 03-01).
 *
 * Reads ROADMAP.md and STATE.md atomically via Promise.all, emits a single GsdState
 * event per refresh() call. All I/O and parse errors are caught and emitted as
 * kind:'error' or kind:'no-project' — refresh() never rejects (WSP-02, WSP-03, WSP-04).
 *
 * Plan 03-02 swaps the hand-rolled listener array for vscode.EventEmitter and wires
 * the file watcher + debounce.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseRoadmap } from '../parsers/roadmap.js';
import { parseState } from '../parsers/state.js';
import type { GsdState } from './types.js';

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

export class StateController {
  private readonly _folder: { uri: { fsPath: string } } | undefined;
  private readonly _readFiles: (base: string) => Promise<{ roadmapText: string; stateText: string }>;
  private _listeners: Array<(s: GsdState) => void> = [];

  constructor(
    folder: { uri: { fsPath: string } } | undefined,
    readFiles?: (base: string) => Promise<{ roadmapText: string; stateText: string }>,
  ) {
    this._folder = folder;
    this._readFiles = readFiles ?? defaultReadFiles;
  }

  /**
   * Subscribe to state change events.
   * Returns a disposer that removes the listener when called.
   */
  onStateChanged(listener: (s: GsdState) => void): { dispose(): void } {
    this._listeners.push(listener);
    return {
      dispose: () => {
        const idx = this._listeners.indexOf(listener);
        if (idx !== -1) {
          this._listeners.splice(idx, 1);
        }
      },
    };
  }

  private _emit(state: GsdState): void {
    for (const listener of this._listeners) {
      listener(state);
    }
  }

  /**
   * Reads both planning files atomically and emits exactly one GsdState event.
   * Never rejects — all errors are caught and emitted as kind:'error' or kind:'no-project'.
   */
  async refresh(): Promise<void> {
    if (!this._folder) {
      this._emit({ kind: 'no-project' });
      return;
    }

    const base = path.join(this._folder.uri.fsPath, '.planning');

    try {
      const { roadmapText, stateText } = await this._readFiles(base);
      const roadmap = parseRoadmap(roadmapText);
      const state = parseState(stateText);
      this._emit({ kind: 'ok', roadmap, state });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this._emit({ kind: 'no-project' });
      } else {
        this._emit({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  dispose(): void {
    // Watcher/timer wiring added in Plan 02
    this._listeners = [];
  }
}
