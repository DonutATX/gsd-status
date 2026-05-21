/**
 * vscode module interception hook for bare Mocha runs.
 *
 * When required by Mocha (via .mocharc.cjs), installs a Module._resolveFilename
 * hook that redirects require('vscode') to the minimal stub in vscode-stub.js.
 * This lets StateController and extension.ts load under plain Node without an
 * Extension Development Host.
 *
 * Must be loaded before any test file that transitively imports a vscode-dependent
 * module — .mocharc.cjs `require` array handles this ordering.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import * as path from 'node:path';

// CJS __dirname is available at runtime; TypeScript strips the type declaration.
declare const __dirname: string;

// Resolve stub path relative to this file's compiled location (out/test/setup/).
const stubPath = path.join(__dirname, 'vscode-stub.js');

// Access Node's module internals to intercept vscode resolution.
// Module._resolveFilename is a Node CJS internal; not in @types/node but stable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NodeModule = require('module') as { _resolveFilename: (...args: unknown[]) => string };
const original = NodeModule._resolveFilename.bind(NodeModule);

NodeModule._resolveFilename = function (...args: unknown[]): string {
  const request = args[0];
  if (request === 'vscode') {
    return stubPath;
  }
  return original(...args);
};
