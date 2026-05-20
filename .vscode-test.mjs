import { defineConfig } from '@vscode/test-cli';

// Stub config for Phase 3+ extension-host tests.
// Plan 02-01 only wires the Mocha runner for pure-Node parser tests;
// no extension-host tests exist yet.
export default defineConfig({
  files: 'out/test/host/**/*.test.js'
});
