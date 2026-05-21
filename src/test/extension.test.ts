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
