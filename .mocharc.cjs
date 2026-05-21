'use strict';

/**
 * Mocha configuration for bare-Node test runs (no Extension Development Host).
 *
 * The require array tells Mocha to load vscode-mock.js before any test files.
 * vscode-mock.js installs a Module._resolveFilename hook so that
 * require('vscode') resolves to the minimal stub in vscode-stub.js,
 * allowing StateController and other vscode-importing modules to load
 * under plain Mocha without an Extension Development Host.
 */

module.exports = {
  require: ['out/test/setup/vscode-mock.js'],
};
