/**
 * Command wiring smoke tests for activate().
 *
 * Drives activate() with a fake ExtensionContext and an instrumented vscode
 * stub to assert that the three GSD commands are registered and behave
 * correctly (gsd.refresh triggers controller.refresh(); absent-workspace
 * open commands show an info message).
 */

import { strict as assert } from 'node:assert';

// vscode is provided globally via the .mocharc.cjs require hook (vscode-stub.ts).
// We reach into the stub at module level to install spies before calling activate().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode') as typeof import('vscode');

// Import activate from the compiled extension.
import { activate } from '../extension.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal fake ExtensionContext with a real subscriptions array.
 * Resets workspaceFolders to undefined so open-file paths hit the no-folder branch.
 */
function fakeContext(): { subscriptions: { dispose(): void }[] } {
  // Ensure no workspace folder is visible — tests the absent-workspace branch.
  (vscode.workspace as { workspaceFolders: undefined }).workspaceFolders = undefined;
  return { subscriptions: [] };
}

/** Map of command id → registered callback, populated by the spy. */
type CommandMap = Map<string, () => void | Promise<void>>;

/**
 * Replace vscode.commands.registerCommand with a spy that records (id, cb)
 * into the provided map and returns a no-op disposable.
 * Returns a restore function to put the original back after the test.
 */
function spyRegisterCommand(map: CommandMap): () => void {
  const original = (vscode.commands as Record<string, unknown>).registerCommand;
  (vscode.commands as Record<string, unknown>).registerCommand = (
    id: string,
    cb: () => void,
  ): { dispose(): void } => {
    map.set(id, cb);
    return { dispose: () => undefined };
  };
  return () => {
    (vscode.commands as Record<string, unknown>).registerCommand = original;
  };
}

/**
 * Replace vscode.window.showInformationMessage with a spy that records calls.
 * Returns [calls array, restore function].
 */
function spyShowInfoMessage(): [string[], () => void] {
  const calls: string[] = [];
  const original = (vscode.window as Record<string, unknown>).showInformationMessage;
  (vscode.window as Record<string, unknown>).showInformationMessage = (msg: string): void => {
    calls.push(msg);
  };
  const restore = (): void => {
    (vscode.window as Record<string, unknown>).showInformationMessage = original;
  };
  return [calls, restore];
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('activate() — command registration', () => {
  let commandMap: CommandMap;
  let restoreRegister: () => void;
  let infoCalls: string[];
  let restoreInfo: () => void;

  before(() => {
    commandMap = new Map();
    restoreRegister = spyRegisterCommand(commandMap);
    [infoCalls, restoreInfo] = spyShowInfoMessage();
    activate(fakeContext() as unknown as import('vscode').ExtensionContext);
  });

  after(() => {
    restoreRegister();
    restoreInfo();
  });

  it('registers a command with id "gsd.refresh"', () => {
    assert.ok(commandMap.has('gsd.refresh'), 'expected gsd.refresh to be registered');
  });

  it('registers a command with id "gsd.openRoadmap"', () => {
    assert.ok(commandMap.has('gsd.openRoadmap'), 'expected gsd.openRoadmap to be registered');
  });

  it('registers a command with id "gsd.openState"', () => {
    assert.ok(commandMap.has('gsd.openState'), 'expected gsd.openState to be registered');
  });

  it('registers a command with id "gsd.refreshTree" (PANL-06)', () => {
    assert.ok(commandMap.has('gsd.refreshTree'), 'expected gsd.refreshTree to be registered');
  });
});

describe('activate() — command callbacks', () => {
  let commandMap: CommandMap;
  let restoreRegister: () => void;
  let infoCalls: string[];
  let restoreInfo: () => void;

  before(() => {
    commandMap = new Map();
    restoreRegister = spyRegisterCommand(commandMap);
    [infoCalls, restoreInfo] = spyShowInfoMessage();
    activate(fakeContext() as unknown as import('vscode').ExtensionContext);
  });

  after(() => {
    restoreRegister();
    restoreInfo();
  });

  it('invoking gsd.refresh callback does not throw', () => {
    const cb = commandMap.get('gsd.refresh');
    assert.ok(cb, 'gsd.refresh callback must be registered');
    assert.doesNotThrow(() => cb());
  });

  it('invoking gsd.openRoadmap with no workspace folder calls showInformationMessage', async () => {
    const cb = commandMap.get('gsd.openRoadmap');
    assert.ok(cb, 'gsd.openRoadmap callback must be registered');
    infoCalls.length = 0; // reset before assertion
    await cb();
    assert.ok(
      infoCalls.some(m => m.includes('ROADMAP.md') && m.includes('.planning/')),
      `expected info message about ROADMAP.md, got: ${JSON.stringify(infoCalls)}`,
    );
  });

  it('invoking gsd.openState with no workspace folder calls showInformationMessage', async () => {
    const cb = commandMap.get('gsd.openState');
    assert.ok(cb, 'gsd.openState callback must be registered');
    infoCalls.length = 0; // reset before assertion
    await cb();
    assert.ok(
      infoCalls.some(m => m.includes('STATE.md') && m.includes('.planning/')),
      `expected info message about STATE.md, got: ${JSON.stringify(infoCalls)}`,
    );
  });
});

describe('activate() — gsd.openRoadmap honors line argument (WR-01)', () => {
  let commandMap: CommandMap;
  let restoreRegister: () => void;
  let restoreShow: () => void;

  before(() => {
    // Provide a workspace folder so openFile reaches the showTextDocument path.
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
      { uri: { fsPath: '/tmp/ws' }, name: 'ws', index: 0 },
    ];
    commandMap = new Map();
    restoreRegister = spyRegisterCommand(commandMap);
    activate(fakeContextWithFolder() as unknown as import('vscode').ExtensionContext);
  });

  after(() => {
    restoreRegister();
    restoreShow();
    (vscode.workspace as { workspaceFolders: undefined }).workspaceFolders = undefined;
  });

  // fakeContext() forces workspaceFolders = undefined, which defeats this
  // suite. Use a context that preserves the folder set above.
  function fakeContextWithFolder(): { subscriptions: { dispose(): void }[] } {
    return { subscriptions: [] };
  }

  function spyShowTextDocument(): { selections: unknown[]; revealed: unknown[] } {
    const rec = { selections: [] as unknown[], revealed: [] as unknown[] };
    const original = (vscode.window as Record<string, unknown>).showTextDocument;
    (vscode.window as Record<string, unknown>).showTextDocument = async (): Promise<unknown> => {
      const editor = {
        set selection(value: unknown) { rec.selections.push(value); },
        get selection(): unknown { return undefined; },
        revealRange: (range: unknown): void => { rec.revealed.push(range); },
      };
      return editor;
    };
    restoreShow = (): void => {
      (vscode.window as Record<string, unknown>).showTextDocument = original;
    };
    return rec;
  }

  // The gsd.openRoadmap callback fires openFile() with `void` and returns
  // synchronously, so the file-open promise runs detached. flush() drains
  // enough microtask turns for that detached promise chain to settle.
  async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  it('converts a 1-based line to a 0-based editor position', async () => {
    const rec = spyShowTextDocument();
    const cb = commandMap.get('gsd.openRoadmap') as (line?: number) => void;
    assert.ok(cb, 'gsd.openRoadmap callback must be registered');
    // headerLine is 1-based (parser stores `i + 1`); vscode.Position is 0-based.
    cb(11);
    await flush();
    assert.equal(rec.selections.length, 1, 'editor.selection should be set once for a valid line');
    assert.equal(rec.revealed.length, 1, 'editor.revealRange should be called once for a valid line');
    const sel = rec.selections[0] as { active: { line: number } };
    assert.equal(sel.active.line, 10, '1-based line 11 must map to 0-based Position line 10');
  });

  it('a phase header at file line 1 navigates to Position line 0', async () => {
    const rec = spyShowTextDocument();
    const cb = commandMap.get('gsd.openRoadmap') as (line?: number) => void;
    // A `### Phase N:` header at array index 0 yields headerLine 1; the cursor
    // must land ON the header (Position line 0), not one line below it.
    cb(1);
    await flush();
    const sel = rec.selections[0] as { active: { line: number } };
    assert.equal(sel.active.line, 0, 'headerLine 1 must land on the first line of the file');
  });

  it('ignores a zero / negative / non-integer line argument (T-05-07)', async () => {
    const rec = spyShowTextDocument();
    const cb = commandMap.get('gsd.openRoadmap') as (line?: number) => void;
    cb(0);
    cb(-5);
    cb(2.7);
    cb();
    await flush();
    assert.equal(rec.selections.length, 0, 'invalid or absent line must not move the selection');
    assert.equal(rec.revealed.length, 0, 'invalid or absent line must not reveal a range');
  });
});
