import { strict as assert } from 'node:assert';
import { StateController } from '../../state/controller.js';
import type { GsdState } from '../../state/types.js';

/** Minimal valid ROADMAP.md content for tests */
const VALID_ROADMAP = `# Roadmap: Test Project
## Milestone v1.0
### Phase 1: Setup
**Goal:** Initial setup
**Mode:** mvp
`;

/** Minimal valid STATE.md content for tests */
const VALID_STATE = `---
milestone: v1.0
phase: "1 of 6 (Setup)"
---
# Project State
`;

/** Helper: collect all events from a StateController refresh */
function collectOne(ctrl: StateController): Promise<GsdState> {
  return new Promise((resolve) => {
    const sub = ctrl.onStateChanged((s) => {
      sub.dispose();
      resolve(s);
    });
  });
}

describe('WSP-03 — refresh fires exactly one ok event with non-empty phases', () => {
  it('readFiles returning valid text fires kind:ok with non-empty phases', async () => {
    const ctrl = new StateController(
      { uri: { fsPath: '/fake/workspace' } },
      async () => ({ roadmapText: VALID_ROADMAP, stateText: VALID_STATE }),
    );
    const eventPromise = collectOne(ctrl);
    await ctrl.refresh();
    const state = await eventPromise;
    assert.equal(state.kind, 'ok', `expected ok, got ${state.kind}`);
    if (state.kind === 'ok') {
      assert.ok(state.roadmap.phases.length > 0, 'expected non-empty phases');
    }
  });
});

describe('WSP-02 — each refresh() fires exactly one event', () => {
  it('calling refresh() increments event counter by exactly 1 each time', async () => {
    let count = 0;
    const ctrl = new StateController(
      { uri: { fsPath: '/fake/workspace' } },
      async () => ({ roadmapText: VALID_ROADMAP, stateText: VALID_STATE }),
    );
    ctrl.onStateChanged(() => { count++; });

    await ctrl.refresh();
    assert.equal(count, 1, `expected 1 event after first refresh, got ${count}`);

    await ctrl.refresh();
    assert.equal(count, 2, `expected 2 events after second refresh, got ${count}`);
  });
});

describe('WSP-04 — errors emitted as state, refresh never throws', () => {
  // Note: the Phase 2 parsers are documented as total (never throw, PARS-03),
  // so a genuine parser-throw branch is unreachable. This test exercises a
  // generic readFiles rejection — the catch block treats any non-ENOENT
  // failure (I/O or otherwise) uniformly as kind:error.
  it('readFiles rejecting with a generic error is caught and emitted as kind:error', async () => {
    const ctrl = new StateController(
      { uri: { fsPath: '/fake/workspace' } },
      async () => { throw new Error('unexpected refresh failure'); },
    );
    const eventPromise = collectOne(ctrl);
    await assert.doesNotReject(() => ctrl.refresh());
    const state = await eventPromise;
    assert.equal(state.kind, 'error');
    if (state.kind === 'error') {
      assert.match(state.message, /unexpected refresh failure/);
    }
  });

  it('unparseable path: gibberish ROADMAP.md (zero phases) emits kind:error', async () => {
    const ctrl = new StateController(
      { uri: { fsPath: '/fake/workspace' } },
      async () => ({ roadmapText: 'asdf gibberish not a roadmap', stateText: VALID_STATE }),
    );
    const eventPromise = collectOne(ctrl);
    await assert.doesNotReject(() => ctrl.refresh());
    const state = await eventPromise;
    assert.equal(state.kind, 'error', `expected error for zero-phase roadmap, got ${state.kind}`);
    if (state.kind === 'error') {
      assert.match(state.message, /no recognizable GSD phases/);
    }
  });

  it('I/O path: readFiles rejection with non-ENOENT emits kind:error', async () => {
    const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
    err.code = 'EACCES';
    const ctrl = new StateController(
      { uri: { fsPath: '/fake/workspace' } },
      async () => { throw err; },
    );
    const eventPromise = collectOne(ctrl);
    await assert.doesNotReject(() => ctrl.refresh());
    const state = await eventPromise;
    assert.equal(state.kind, 'error');
  });
});

describe('no-project path — ENOENT and undefined folder', () => {
  it('readFiles rejection with ENOENT emits kind:no-project', async () => {
    const err = new Error('ENOENT: no such file') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    const ctrl = new StateController(
      { uri: { fsPath: '/fake/workspace' } },
      async () => { throw err; },
    );
    const eventPromise = collectOne(ctrl);
    await assert.doesNotReject(() => ctrl.refresh());
    const state = await eventPromise;
    assert.equal(state.kind, 'no-project');
  });

  it('undefined folder emits kind:no-project without calling readFiles', async () => {
    let readFilesCalled = false;
    const ctrl = new StateController(
      undefined,
      async () => { readFilesCalled = true; return { roadmapText: '', stateText: '' }; },
    );
    const eventPromise = collectOne(ctrl);
    await assert.doesNotReject(() => ctrl.refresh());
    const state = await eventPromise;
    assert.equal(state.kind, 'no-project');
    assert.equal(readFilesCalled, false, 'readFiles should not be called when folder is undefined');
  });
});
