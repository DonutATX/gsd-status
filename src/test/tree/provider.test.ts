/**
 * Unit tests for GsdTreeProvider.
 *
 * Tests are grouped by requirement:
 *   PANL-02: Phase list with active-phase distinction
 *   PANL-03: Phase expansion (goal + criteria children)
 *   PANL-04: Recent Activity section
 *   PANL-07: Stable identity + onDidChangeTreeData on update()
 *
 * Uses bare Mocha + vscode-stub (no Extension Development Host).
 */

import { strict as assert } from 'node:assert';
import { GsdTreeProvider } from '../../tree/provider.js';
import type { GsdState } from '../../state/types.js';
import type { GsdTreeItem } from '../../tree/items.js';

// vscode is provided globally via the .mocharc.cjs require hook.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode') as typeof import('vscode');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOkState(overrides?: { phaseNumber?: string }): GsdState {
  return {
    kind: 'ok',
    roadmap: {
      projectName: 'Test Project',
      milestoneLabel: 'v1.0',
      phases: [
        {
          number: '1',
          name: 'Phase 1: Setup',
          goal: 'Get the project started',
          successCriteria: ['Scaffold created', 'TypeScript compiles'],
          done: true,
          headerLine: 1,
          endLine: 10,
        },
        {
          number: '2',
          name: 'Phase 2: Parsers',
          goal: 'Parse planning files',
          successCriteria: ['ROADMAP.md parsed', 'STATE.md parsed', 'Tests pass'],
          done: false,
          headerLine: 11,
          endLine: 25,
        },
        {
          number: '3',
          name: 'Phase 3: Controller',
          goal: undefined,
          successCriteria: [],
          done: false,
          headerLine: 26,
          endLine: 40,
        },
      ],
    },
    state: {
      phaseNumber: overrides?.phaseNumber ?? '2',
      recentEntries: [
        { text: 'Completed 01-02-PLAN.md', timestamp: '2026-05-20', raw: 'Last activity: 2026-05-20 — Completed 01-02-PLAN.md' },
        { text: 'Completed 01-01-PLAN.md', timestamp: '2026-05-19', raw: 'Last activity: 2026-05-19 — Completed 01-01-PLAN.md' },
        { text: 'Project initialized', timestamp: '2026-05-18', raw: 'Last activity: 2026-05-18 — Project initialized' },
      ],
    },
  };
}

function makeNoProjectState(): GsdState {
  return { kind: 'no-project' };
}

function makeErrorState(): GsdState {
  return { kind: 'error', message: 'Parse error: unexpected token' };
}

// ---------------------------------------------------------------------------
// Helper: count onDidChangeTreeData fires
// ---------------------------------------------------------------------------

function watchChanges(provider: GsdTreeProvider): { count: number; dispose(): void } {
  const tracker = { count: 0, dispose: () => undefined as void };
  const sub = provider.onDidChangeTreeData(() => { tracker.count++; });
  tracker.dispose = () => sub.dispose();
  return tracker;
}

// ---------------------------------------------------------------------------
// PANL-02: Phase list structure
// ---------------------------------------------------------------------------

describe('GsdTreeProvider — getChildren (PANL-02)', () => {
  let provider: GsdTreeProvider;

  before(() => {
    provider = new GsdTreeProvider();
    provider.update(makeOkState());
  });

  after(() => {
    provider.dispose();
  });

  it('getChildren(undefined) with ok state: first element is a section node', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    assert.ok(children.length > 0, 'expected at least one child');
    assert.equal(children[0].kind, 'section', 'first child must be a section node');
  });

  it('getChildren(undefined) with ok state: section node is Recent Activity', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const section = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    assert.equal(section.label, 'Recent Activity');
  });

  it('getChildren(undefined) with ok state: remaining children are phase nodes in roadmap order', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseChildren = children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[];
    assert.equal(phaseChildren.length, 3, 'expected 3 phase nodes');
    assert.ok(phaseChildren.every(c => c.kind === 'phase'), 'all remaining children must be phase nodes');
    assert.equal(phaseChildren[0].phase.number, '1');
    assert.equal(phaseChildren[1].phase.number, '2');
    assert.equal(phaseChildren[2].phase.number, '3');
  });

  it('exactly one phase node has isActive === true — the active phase', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseNodes = children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[];
    const activeNodes = phaseNodes.filter(n => n.isActive);
    assert.equal(activeNodes.length, 1, 'exactly one phase must be active');
    assert.equal(activeNodes[0].phase.number, '2', 'active phase must match state.phaseNumber');
  });

  it('non-active phases have isActive === false', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseNodes = children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[];
    const inactive = phaseNodes.filter(n => !n.isActive);
    assert.equal(inactive.length, 2, 'two phases should be inactive');
  });

  it('getChildren(undefined) with no-project state: returns empty array', () => {
    const p = new GsdTreeProvider();
    p.update(makeNoProjectState());
    const children = p.getChildren(undefined) as GsdTreeItem[];
    assert.deepEqual(children, []);
    p.dispose();
  });

  it('getChildren(undefined) with error state: returns single placeholder', () => {
    const p = new GsdTreeProvider();
    p.update(makeErrorState());
    const children = p.getChildren(undefined) as GsdTreeItem[];
    assert.equal(children.length, 1);
    assert.equal(children[0].kind, 'placeholder');
    const ph = children[0] as Extract<GsdTreeItem, { kind: 'placeholder' }>;
    assert.equal(ph.label, 'Error reading GSD files');
    p.dispose();
  });
});

// ---------------------------------------------------------------------------
// PANL-02 continued: getTreeItem for phase nodes
// ---------------------------------------------------------------------------

describe('GsdTreeProvider — getTreeItem for phase nodes (PANL-02)', () => {
  let provider: GsdTreeProvider;

  before(() => {
    provider = new GsdTreeProvider();
    provider.update(makeOkState());
  });

  after(() => {
    provider.dispose();
  });

  it('active phase: iconPath is ThemeIcon("play")', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const item = provider.getTreeItem(activePhase);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon, 'iconPath must be ThemeIcon');
    assert.equal((item.iconPath as InstanceType<typeof vscode.ThemeIcon>).id, 'play');
  });

  it('done phase: iconPath is ThemeIcon("pass-filled")', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const donePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.phase.done)!;
    const item = provider.getTreeItem(donePhase);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon, 'iconPath must be ThemeIcon');
    assert.equal((item.iconPath as InstanceType<typeof vscode.ThemeIcon>).id, 'pass-filled');
  });

  it('pending phase: iconPath is ThemeIcon("circle-outline")', () => {
    // Phase 3 is pending: not done, not active
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const pendingPhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => !n.isActive && !n.phase.done)!;
    const item = provider.getTreeItem(pendingPhase);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon, 'iconPath must be ThemeIcon');
    assert.equal((item.iconPath as InstanceType<typeof vscode.ThemeIcon>).id, 'circle-outline');
  });

  it('active phase: collapsibleState is Expanded', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const item = provider.getTreeItem(activePhase);
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });

  it('non-active phases: collapsibleState is Collapsed', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const inactivePhases = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .filter(n => !n.isActive);
    for (const phase of inactivePhases) {
      const item = provider.getTreeItem(phase);
      assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed,
        `phase ${phase.phase.number} should be Collapsed`);
    }
  });

  it('phase TreeItem: id equals "phase-<number>"', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseNode = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])[0];
    const item = provider.getTreeItem(phaseNode);
    assert.equal(item.id, `phase-${phaseNode.phase.number}`);
  });

  it('phase TreeItem: command is gsd.openRoadmap with headerLine argument', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseNode = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])[0];
    const item = provider.getTreeItem(phaseNode);
    assert.ok(item.command, 'phase item must have a command');
    assert.equal(item.command!.command, 'gsd.openRoadmap');
    assert.deepEqual(item.command!.arguments, [phaseNode.phase.headerLine]);
  });
});

// ---------------------------------------------------------------------------
// PANL-03: Phase expansion (goal + criteria children)
// ---------------------------------------------------------------------------

describe('GsdTreeProvider — getChildren for phase nodes (PANL-03)', () => {
  let provider: GsdTreeProvider;

  before(() => {
    provider = new GsdTreeProvider();
    provider.update(makeOkState());
  });

  after(() => {
    provider.dispose();
  });

  it('expanding phase with goal: first child is a goal node', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    // Phase 2 (active) has a goal
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const phaseChildren = provider.getChildren(activePhase) as GsdTreeItem[];
    assert.ok(phaseChildren.length > 0, 'active phase should have children');
    assert.equal(phaseChildren[0].kind, 'goal', 'first child of phase must be goal node');
  });

  it('expanding phase with goal: goal node text matches phase.goal', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const phaseChildren = provider.getChildren(activePhase) as GsdTreeItem[];
    const goalNode = phaseChildren[0] as Extract<GsdTreeItem, { kind: 'goal' }>;
    assert.equal(goalNode.text, activePhase.phase.goal);
  });

  it('expanding phase: criteria children follow the goal', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const phaseChildren = provider.getChildren(activePhase) as GsdTreeItem[];
    const criteriaNodes = phaseChildren.slice(1) as Extract<GsdTreeItem, { kind: 'criterion' }>[];
    assert.equal(criteriaNodes.length, activePhase.phase.successCriteria!.length);
    assert.ok(criteriaNodes.every(c => c.kind === 'criterion'), 'all remaining children must be criterion nodes');
  });

  it('expanding phase without goal: no goal node, only criteria', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    // Phase 3 has no goal and no criteria
    const noGoalPhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.phase.number === '3')!;
    const phaseChildren = provider.getChildren(noGoalPhase) as GsdTreeItem[];
    const goalNodes = phaseChildren.filter(c => c.kind === 'goal');
    assert.equal(goalNodes.length, 0, 'phase without goal must have no goal node');
  });

  it('goal child: getTreeItem returns None collapsibleState (leaf)', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const phaseChildren = provider.getChildren(activePhase) as GsdTreeItem[];
    const goalNode = phaseChildren[0] as Extract<GsdTreeItem, { kind: 'goal' }>;
    const item = provider.getTreeItem(goalNode);
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  it('criterion child: getTreeItem returns None collapsibleState (leaf)', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activePhase = (children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    const phaseChildren = provider.getChildren(activePhase) as GsdTreeItem[];
    const criterionNode = phaseChildren[1] as Extract<GsdTreeItem, { kind: 'criterion' }>;
    const item = provider.getTreeItem(criterionNode);
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });
});

// ---------------------------------------------------------------------------
// PANL-04: Recent Activity section
// ---------------------------------------------------------------------------

describe('GsdTreeProvider — getChildren for Recent Activity section (PANL-04)', () => {
  let provider: GsdTreeProvider;

  before(() => {
    provider = new GsdTreeProvider();
    provider.update(makeOkState());
  });

  after(() => {
    provider.dispose();
  });

  it('section node children are activity nodes', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = provider.getChildren(sectionNode) as GsdTreeItem[];
    assert.ok(activityChildren.length > 0, 'section should have activity children');
    assert.ok(activityChildren.every(c => c.kind === 'activity'), 'all children must be activity nodes');
  });

  it('section returns up to recentActivityCount entries (default 5)', () => {
    // fixture has 3 entries, default limit is 5 — should return all 3
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = provider.getChildren(sectionNode) as GsdTreeItem[];
    assert.equal(activityChildren.length, 3, 'should return all 3 entries (under default limit of 5)');
  });

  it('section respects recentActivityCount limit', () => {
    const p = new GsdTreeProvider();
    p.setRecentCount(2);
    p.update(makeOkState());
    const children = p.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = p.getChildren(sectionNode) as GsdTreeItem[];
    assert.equal(activityChildren.length, 2, 'should return at most 2 entries');
    p.dispose();
  });

  it('setRecentCount clamps zero / negative / non-integer to a sane value (WR-02)', () => {
    // 0 → fallback 5: all 3 fixture entries shown.
    const pZero = new GsdTreeProvider();
    pZero.setRecentCount(0);
    pZero.update(makeOkState());
    const zeroSection = (pZero.getChildren(undefined) as GsdTreeItem[])[0];
    assert.equal((pZero.getChildren(zeroSection) as GsdTreeItem[]).length, 3,
      '0 must fall back, not show an empty panel');
    pZero.dispose();

    // negative → fallback 5: slice(0, -1) would have dropped the last entry.
    const pNeg = new GsdTreeProvider();
    pNeg.setRecentCount(-1);
    pNeg.update(makeOkState());
    const negSection = (pNeg.getChildren(undefined) as GsdTreeItem[])[0];
    assert.equal((pNeg.getChildren(negSection) as GsdTreeItem[]).length, 3,
      'negative must fall back, not drop entries');
    pNeg.dispose();

    // float → floored: 2.7 becomes 2.
    const pFloat = new GsdTreeProvider();
    pFloat.setRecentCount(2.7);
    pFloat.update(makeOkState());
    const floatSection = (pFloat.getChildren(undefined) as GsdTreeItem[])[0];
    assert.equal((pFloat.getChildren(floatSection) as GsdTreeItem[]).length, 2,
      'a float must be floored to an integer limit');
    pFloat.dispose();
  });

  it('section returns placeholder when recentEntries is empty/undefined', () => {
    const p = new GsdTreeProvider();
    p.update({
      kind: 'ok',
      roadmap: { phases: [] },
      state: { recentEntries: [] },
    });
    // For ok state with no phases, use a minimal state
    const p2 = new GsdTreeProvider();
    const stateWithNoActivity: GsdState = {
      kind: 'ok',
      roadmap: {
        phases: [{
          number: '1', name: 'Phase 1', goal: 'Test', successCriteria: [],
          done: false, headerLine: 1, endLine: 5,
        }],
      },
      state: { recentEntries: undefined },
    };
    p2.update(stateWithNoActivity);
    const children = p2.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = p2.getChildren(sectionNode) as GsdTreeItem[];
    assert.equal(activityChildren.length, 1);
    assert.equal(activityChildren[0].kind, 'placeholder');
    const ph = activityChildren[0] as Extract<GsdTreeItem, { kind: 'placeholder' }>;
    assert.equal(ph.label, 'No recent activity');
    p.dispose();
    p2.dispose();
  });

  it('activity TreeItem: command is gsd.openState', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = provider.getChildren(sectionNode) as GsdTreeItem[];
    const activityNode = activityChildren[0] as Extract<GsdTreeItem, { kind: 'activity' }>;
    const item = provider.getTreeItem(activityNode);
    assert.ok(item.command, 'activity item must have a command');
    assert.equal(item.command!.command, 'gsd.openState');
  });

  it('activity TreeItem: description holds entry timestamp', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = provider.getChildren(sectionNode) as GsdTreeItem[];
    const activityNode = activityChildren[0] as Extract<GsdTreeItem, { kind: 'activity' }>;
    const item = provider.getTreeItem(activityNode);
    assert.equal(item.description, activityNode.entry.timestamp);
  });

  it('activity TreeItem: collapsibleState is None (leaf)', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const activityChildren = provider.getChildren(sectionNode) as GsdTreeItem[];
    const activityNode = activityChildren[0];
    const item = provider.getTreeItem(activityNode);
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });
});

// ---------------------------------------------------------------------------
// PANL-07: update() + onDidChangeTreeData + stable ids
// ---------------------------------------------------------------------------

describe('GsdTreeProvider — update() and onDidChangeTreeData (PANL-07)', () => {
  let provider: GsdTreeProvider;

  beforeEach(() => {
    provider = new GsdTreeProvider();
  });

  afterEach(() => {
    provider.dispose();
  });

  it('update(state) fires onDidChangeTreeData exactly once', () => {
    const tracker = watchChanges(provider);
    provider.update(makeOkState());
    assert.equal(tracker.count, 1, 'onDidChangeTreeData must fire exactly once per update');
    tracker.dispose();
  });

  it('calling update() twice fires the event twice total', () => {
    const tracker = watchChanges(provider);
    provider.update(makeOkState());
    provider.update(makeNoProjectState());
    assert.equal(tracker.count, 2, 'two updates must fire event twice');
    tracker.dispose();
  });

  it('every phase node has a deterministic id: "phase-<number>"', () => {
    provider.update(makeOkState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseNodes = children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[];
    for (const node of phaseNodes) {
      const item = provider.getTreeItem(node);
      assert.equal(item.id, `phase-${node.phase.number}`,
        `phase ${node.phase.number} must have deterministic id`);
    }
  });

  it('calling update() with same state produces same ids (stability)', () => {
    provider.update(makeOkState());
    const children1 = provider.getChildren(undefined) as GsdTreeItem[];
    const ids1 = (children1.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .map(n => provider.getTreeItem(n).id);

    provider.update(makeOkState());
    const children2 = provider.getChildren(undefined) as GsdTreeItem[];
    const ids2 = (children2.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .map(n => provider.getTreeItem(n).id);

    assert.deepEqual(ids1, ids2, 'ids must be stable across updates with same state');
  });

  it('section node has deterministic id "recent-activity-section"', () => {
    provider.update(makeOkState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const sectionNode = children[0] as Extract<GsdTreeItem, { kind: 'section' }>;
    const item = provider.getTreeItem(sectionNode);
    assert.equal(item.id, 'recent-activity-section');
  });
});
