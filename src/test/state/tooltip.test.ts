import { strict as assert } from 'node:assert';
import { buildOkTooltip, buildErrorTooltip } from '../../state/tooltip.js';
import type { RoadmapData } from '../../parsers/types.js';
import type { StateData } from '../../parsers/types.js';

const MINIMAL_ROADMAP: RoadmapData = {
  projectName: 'Test Project',
  milestoneLabel: 'v1.0',
  phases: [
    { number: '1', name: 'Setup', goal: 'Initial setup', done: false, headerLine: 1, endLine: 10 },
  ],
};

const MINIMAL_STATE: StateData = {
  lastEntry: { text: 'Completed scaffolding', timestamp: '2026-05-21T10:00:00Z', raw: '' },
};

describe('buildOkTooltip — milestone rendering', () => {
  it('renders milestoneLabel when present', () => {
    const ms = buildOkTooltip(MINIMAL_ROADMAP, MINIMAL_STATE);
    assert.ok(ms.value.includes('v1.0'), 'expected milestoneLabel in tooltip');
  });

  it('falls back to projectName when milestoneLabel is absent', () => {
    const roadmap: RoadmapData = { projectName: 'My Project', phases: MINIMAL_ROADMAP.phases };
    const ms = buildOkTooltip(roadmap, MINIMAL_STATE);
    assert.ok(ms.value.includes('My Project'), 'expected projectName in tooltip');
  });

  it('falls back to "GSD" when both milestoneLabel and projectName are absent', () => {
    const roadmap: RoadmapData = { phases: MINIMAL_ROADMAP.phases };
    const ms = buildOkTooltip(roadmap, MINIMAL_STATE);
    assert.ok(ms.value.includes('GSD'), 'expected "GSD" fallback in tooltip');
  });
});

describe('buildOkTooltip — active phase rendering', () => {
  it('uses first phase with done === false as active phase', () => {
    const roadmap: RoadmapData = {
      milestoneLabel: 'v1.0',
      phases: [
        { number: '1', name: 'Done Phase', done: true, headerLine: 1, endLine: 5 },
        { number: '2', name: 'Active Phase', goal: 'Active goal', done: false, headerLine: 6, endLine: 10 },
      ],
    };
    const ms = buildOkTooltip(roadmap, MINIMAL_STATE);
    assert.ok(ms.value.includes('Active Phase'), 'expected active phase name in tooltip');
    assert.ok(ms.value.includes('Active goal'), 'expected active phase goal in tooltip');
  });

  it('renders "All phases complete" when every phase is done', () => {
    const roadmap: RoadmapData = {
      milestoneLabel: 'v1.0',
      phases: [
        { number: '1', name: 'Setup', done: true, headerLine: 1, endLine: 5 },
      ],
    };
    const ms = buildOkTooltip(roadmap, MINIMAL_STATE);
    assert.ok(ms.value.includes('All phases complete'), 'expected "All phases complete" in tooltip');
  });

  it('renders "(no goal defined)" when active phase has no goal', () => {
    const roadmap: RoadmapData = {
      milestoneLabel: 'v1.0',
      phases: [
        { number: '1', name: 'Setup', done: false, headerLine: 1, endLine: 5 },
      ],
    };
    const ms = buildOkTooltip(roadmap, MINIMAL_STATE);
    assert.ok(ms.value.includes('(no goal defined)'), 'expected "(no goal defined)" in tooltip');
  });
});

describe('buildOkTooltip — last entry rendering', () => {
  it('renders Last Entry section with timestamp and text when lastEntry is present', () => {
    const ms = buildOkTooltip(MINIMAL_ROADMAP, MINIMAL_STATE);
    assert.ok(ms.value.includes('Last Entry'), 'expected "Last Entry" heading');
    assert.ok(ms.value.includes('Completed scaffolding'), 'expected lastEntry.text');
    assert.ok(ms.value.includes('2026-05-21T10:00:00Z'), 'expected absolute timestamp');
  });

  it('omits the Last Entry section entirely when lastEntry is absent', () => {
    const state: StateData = {};
    const ms = buildOkTooltip(MINIMAL_ROADMAP, state);
    assert.ok(!ms.value.includes('Last Entry'), 'expected no "Last Entry" section when lastEntry absent');
  });
});

describe('buildErrorTooltip', () => {
  it('renders "**GSD — Parse Error**" heading', () => {
    const ms = buildErrorTooltip('Something went wrong');
    assert.ok(ms.value.includes('GSD — Parse Error'), 'expected error heading');
  });

  it('renders the actual error message string', () => {
    const ms = buildErrorTooltip('Could not parse ROADMAP.md at line 42');
    assert.ok(ms.value.includes('Could not parse ROADMAP.md at line 42'), 'expected actual error message');
  });
});
