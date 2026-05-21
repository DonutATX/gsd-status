/**
 * StateController — pure-Node implementation (zero vscode imports in Plan 03-01).
 *
 * Reads ROADMAP.md and STATE.md atomically, emits a single GsdState event per
 * refresh() call. I/O and parse errors are caught and emitted as kind:'error'.
 * Plan 03-02 swaps the hand-rolled listener array for vscode.EventEmitter.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseRoadmap } from '../parsers/roadmap.js';
import { parseState } from '../parsers/state.js';
import type { GsdState } from './types.js';

/**
 * Reads both planning files from disk for a given base path.
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

  /** Exposed for testing — do not use in production code. */
  readonly onStateChangedListeners: Array<(s: GsdState) => void> = this._listeners;

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

  /** Stub: async refresh — real implementation added in Task 2. */
  async refresh(): Promise<void> {
    // No-op stub
  }

  dispose(): void {
    // Stub: watcher/timer wiring added in Plan 02
    this._listeners = [];
  }
}
