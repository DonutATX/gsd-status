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

  it('phase TreeItem: label is prefixed with the phase number ("<number>: <name>")', () => {
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const phaseNodes = children.slice(1) as Extract<GsdTreeItem, { kind: 'phase' }>[];
    for (const node of phaseNodes) {
      const item = provider.getTreeItem(node);
      assert.equal(item.label, `${node.phase.number}: ${node.phase.name}`);
    }
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
// PANL-08: Milestone-grouped tree
// ---------------------------------------------------------------------------

describe('GsdTreeProvider — milestone-grouped tree (PANL-08)', () => {
  // Two-milestone roadmap where phase 2 is active (milestone "v1.0" is active,
  // milestone "v2.0" is pending). All v1.0 phases are not done; v2.0 phases are
  // also pending.
  function makeMilestoneState(activePhase = '2'): GsdState {
    return {
      kind: 'ok',
      roadmap: {
        projectName: 'Test Project',
        milestones: [
          { label: 'v1.0 Alpha', phases: ['1', '2'], description: 'Phases 1-2' },
          { label: 'v2.0 Beta', phases: ['3'], description: 'Phase 3' },
        ],
        phases: [
          {
            number: '1',
            name: 'Phase 1: Setup',
            goal: 'Setup goal',
            successCriteria: ['Criterion A'],
            done: true,
            headerLine: 1,
            endLine: 10,
            milestoneLabel: 'v1.0 Alpha',
          },
          {
            number: '2',
            name: 'Phase 2: Parsers',
            goal: 'Parse goal',
            successCriteria: [],
            done: false,
            headerLine: 11,
            endLine: 25,
            milestoneLabel: 'v1.0 Alpha',
          },
          {
            number: '3',
            name: 'Phase 3: Controller',
            goal: undefined,
            successCriteria: [],
            done: false,
            headerLine: 26,
            endLine: 40,
            milestoneLabel: 'v2.0 Beta',
          },
        ],
      },
      state: {
        phaseNumber: activePhase,
        recentEntries: [
          { text: 'Did something', timestamp: '2026-05-22', raw: 'Last activity: 2026-05-22 — Did something' },
        ],
      },
    };
  }

  // Milestone state where all v1.0 phases are done (for check-all icon test)
  function makeAllDoneMilestoneState(): GsdState {
    const s = makeMilestoneState('3');
    if (s.kind === 'ok') {
      s.roadmap.phases[0].done = true;
      s.roadmap.phases[1].done = true;
    }
    return s;
  }

  let provider: GsdTreeProvider;

  beforeEach(() => {
    provider = new GsdTreeProvider();
  });

  afterEach(() => {
    provider.dispose();
  });

  it('getChildren(undefined) with milestones: first child is section node', () => {
    provider.update(makeMilestoneState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    assert.ok(children.length > 0, 'expected children');
    assert.equal(children[0].kind, 'section', 'first child must be section');
  });

  it('getChildren(undefined) with milestones: top-level has one node per milestone after section', () => {
    provider.update(makeMilestoneState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const nonSection = children.slice(1);
    assert.equal(nonSection.length, 2, 'expected 2 milestone nodes');
    assert.ok(nonSection.every(c => c.kind === 'milestone'), 'all non-section top-level nodes must be milestone kind');
  });

  it('getChildren(milestoneNode) returns only phases for that milestone', () => {
    provider.update(makeMilestoneState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const ms1 = children[1] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    const ms2 = children[2] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    assert.equal(ms1.kind, 'milestone');
    const ms1Phases = provider.getChildren(ms1) as GsdTreeItem[];
    const ms2Phases = provider.getChildren(ms2) as GsdTreeItem[];
    assert.equal(ms1Phases.length, 2, 'v1.0 Alpha has 2 phases');
    assert.equal(ms2Phases.length, 1, 'v2.0 Beta has 1 phase');
    assert.ok(ms1Phases.every(c => c.kind === 'phase'), 'milestone children must be phase nodes');
  });

  it('milestone containing active phase has isActive: true', () => {
    provider.update(makeMilestoneState('2'));
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const ms1 = children[1] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    const ms2 = children[2] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    assert.equal(ms1.isActive, true, 'v1.0 Alpha should be active (contains phase 2)');
    assert.equal(ms2.isActive, false, 'v2.0 Beta should not be active');
  });

  it('active milestone TreeItem has Expanded collapsibleState', () => {
    provider.update(makeMilestoneState('2'));
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const activeMilestone = (children.slice(1) as Extract<GsdTreeItem, { kind: 'milestone' }>[])
      .find(n => n.isActive)!;
    const item = provider.getTreeItem(activeMilestone);
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded,
      'active milestone must be Expanded');
  });

  it('non-active milestone TreeItem has Collapsed collapsibleState', () => {
    provider.update(makeMilestoneState('2'));
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const inactiveMilestones = (children.slice(1) as Extract<GsdTreeItem, { kind: 'milestone' }>[])
      .filter(n => !n.isActive);
    for (const ms of inactiveMilestones) {
      const item = provider.getTreeItem(ms);
      assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed,
        `inactive milestone "${ms.label}" must be Collapsed`);
    }
  });

  it('milestone where all phases done: getTreeItem uses ThemeIcon("check-all")', () => {
    provider.update(makeAllDoneMilestoneState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const ms1 = children[1] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    // All v1.0 phases are done
    const item = provider.getTreeItem(ms1);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon, 'iconPath must be ThemeIcon');
    assert.equal((item.iconPath as InstanceType<typeof vscode.ThemeIcon>).id, 'check-all',
      'completed milestone must use check-all icon');
  });

  it('milestone with pending phases: getTreeItem uses ThemeIcon("milestone")', () => {
    provider.update(makeMilestoneState('2'));
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const ms2 = children[2] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    // v2.0 Beta has pending phases
    const item = provider.getTreeItem(ms2);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon, 'iconPath must be ThemeIcon');
    assert.equal((item.iconPath as InstanceType<typeof vscode.ThemeIcon>).id, 'milestone',
      'pending milestone must use milestone icon');
  });

  it('milestone TreeItem has no command (expand/collapse only)', () => {
    provider.update(makeMilestoneState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const ms = children[1] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    const item = provider.getTreeItem(ms);
    assert.equal(item.command, undefined, 'milestone item must have no command');
  });

  it('milestone TreeItem id starts with "milestone-"', () => {
    provider.update(makeMilestoneState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    for (const child of children.slice(1)) {
      const ms = child as Extract<GsdTreeItem, { kind: 'milestone' }>;
      const item = provider.getTreeItem(ms);
      assert.ok(typeof item.id === 'string' && item.id.startsWith('milestone-'),
        `milestone id must start with "milestone-", got "${item.id}"`);
    }
  });

  it('flat fallback: roadmap without milestones returns section + phase nodes', () => {
    provider.update(makeOkState());
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    assert.equal(children[0].kind, 'section', 'first child is section');
    const nonSection = children.slice(1);
    assert.ok(nonSection.length > 0, 'flat layout must have phase nodes');
    assert.ok(nonSection.every(c => c.kind === 'phase'), 'flat layout: all non-section nodes are phase kind');
    assert.ok(!nonSection.some(c => (c as GsdTreeItem).kind === 'milestone'), 'flat layout: no milestone nodes');
  });

  it('active phase node inside milestone still has ThemeIcon("play")', () => {
    provider.update(makeMilestoneState('2'));
    const children = provider.getChildren(undefined) as GsdTreeItem[];
    const ms1 = children[1] as Extract<GsdTreeItem, { kind: 'milestone' }>;
    const msPhases = provider.getChildren(ms1) as GsdTreeItem[];
    const activePhase = (msPhases as Extract<GsdTreeItem, { kind: 'phase' }>[])
      .find(n => n.isActive)!;
    assert.ok(activePhase, 'active phase node must exist inside milestone');
    const item = provider.getTreeItem(activePhase);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon, 'iconPath must be ThemeIcon');
    assert.equal((item.iconPath as InstanceType<typeof vscode.ThemeIcon>).id, 'play',
      'active phase inside milestone must keep play icon');
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

  it('activity ids are content-stable when a new entry shifts indices (WR-04)', () => {
    // Collect the id of the oldest entry under the original state.
    provider.update(makeOkState());
    const section = (provider.getChildren(undefined) as GsdTreeItem[])[0];
    const before = provider.getChildren(section) as GsdTreeItem[];
    const oldestBefore = before[before.length - 1];
    const idBefore = provider.getTreeItem(oldestBefore).id;

    // Prepend a brand-new entry — every existing entry's index now shifts.
    const shifted = makeOkState();
    if (shifted.kind === 'ok') {
      shifted.state.recentEntries = [
        { text: 'Newest entry', timestamp: '2026-05-21', raw: 'Last activity: 2026-05-21 — Newest entry' },
        ...(shifted.state.recentEntries ?? []),
      ];
    }
    provider.update(shifted);
    const sectionAfter = (provider.getChildren(undefined) as GsdTreeItem[])[0];
    const after = provider.getChildren(sectionAfter) as GsdTreeItem[];
    const oldestAfter = after[after.length - 1];
    const idAfter = provider.getTreeItem(oldestAfter).id;

    assert.equal(idAfter, idBefore,
      'the same entry must keep its id even after indices shift');

    // Distinct entries must still get distinct ids.
    const ids = after.map(n => provider.getTreeItem(n).id);
    assert.equal(new Set(ids).size, ids.length, 'activity ids must be unique per entry');
  });

  it('two activity entries with identical raw text receive distinct ids (WR-01)', () => {
    const dupState = makeOkState();
    if (dupState.kind === 'ok') {
      const line = { text: 'Roadmap created', timestamp: '2026-05-21', raw: 'Last activity: 2026-05-21 — Roadmap created' };
      // Two entries with byte-for-byte identical raw text.
      dupState.state.recentEntries = [{ ...line }, { ...line }];
    }
    provider.update(dupState);
    const section = (provider.getChildren(undefined) as GsdTreeItem[])[0];
    const activity = provider.getChildren(section) as GsdTreeItem[];
    assert.equal(activity.length, 2, 'both duplicate entries must be present');

    const ids = activity.map(n => provider.getTreeItem(n).id);
    assert.ok(ids.every(id => typeof id === 'string' && id.length > 0), 'each activity id must be a non-empty string');
    assert.equal(new Set(ids).size, ids.length,
      'content-identical entries must still receive distinct tree ids');
  });
});
