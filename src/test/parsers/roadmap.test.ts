import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseRoadmap } from '../../parsers/roadmap.js';

// __dirname at test time = out/test/parsers; fixtures live under src/test/parsers/fixtures.
const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'parsers', 'fixtures');

function load(name: string): string {
  return readFileSync(path.join(FIXTURES, name), 'utf8');
}

describe('parseRoadmap — canonical', () => {
  const data = parseRoadmap(load('canonical-roadmap.md'));

  it('extracts the project name (strips "Roadmap:" prefix)', () => {
    assert.equal(data.projectName, 'GSD Status — VS Code Extension');
  });

  it('finds exactly 6 phases', () => {
    assert.equal(data.phases.length, 6);
  });

  it('marks Phase 1 as done', () => {
    assert.equal(data.phases[0].done, true);
  });

  it('marks Phase 2 as not done', () => {
    assert.equal(data.phases[1].done, false);
  });

  it('captures Phase 2 goal text', () => {
    assert.match(data.phases[1].goal ?? '', /Pure parser modules/);
  });

  it('captures Phase 2 mode', () => {
    assert.equal(data.phases[1].mode, 'mvp');
  });

  it('parses Phase 2 requirements list', () => {
    assert.deepEqual(data.phases[1].requirements, [
      'PARS-01',
      'PARS-02',
      'PARS-03',
      'PARS-04',
      'PARS-05',
    ]);
  });

  it('captures Phase 2 success criteria (5 items)', () => {
    assert.equal(data.phases[1].successCriteria?.length, 5);
  });

  it('records Phase 1 headerLine as 1-based and points at the header', () => {
    const text = load('canonical-roadmap.md');
    const lines = text.split(/\r?\n/);
    const expected = lines.findIndex((l) => /^### Phase 1:/.test(l)) + 1;
    assert.equal(data.phases[0].headerLine, expected);
  });

  it('milestones is undefined for canonical (expanded) roadmap — flat-fallback signal', () => {
    assert.equal(data.milestones, undefined);
  });
});

describe('parseRoadmap — robustness (PARS-03)', () => {
  it('returns { phases: [] } for empty string', () => {
    assert.deepEqual(parseRoadmap(''), { phases: [] });
  });

  it('returns { phases: [] } for empty.md fixture', () => {
    assert.deepEqual(parseRoadmap(load('empty.md')), { phases: [] });
  });

  it('handles CRLF inline input', () => {
    const data = parseRoadmap('# Title\r\n### Phase 1: Hello\r\n');
    assert.equal(data.phases[0].name, 'Hello');
  });

  it('handles crlf-roadmap.md fixture', () => {
    const data = parseRoadmap(load('crlf-roadmap.md'));
    assert.equal(data.phases.length, 1);
    assert.equal(data.phases[0].name, 'Hello');
  });

  it('handles partial-roadmap.md (two bare phases, undefined goals)', () => {
    const data = parseRoadmap(load('partial-roadmap.md'));
    assert.equal(data.phases.length, 2);
    assert.equal(data.phases[0].goal, undefined);
    assert.equal(data.phases[1].goal, undefined);
  });

  it('supports decimal phase numbers', () => {
    const data = parseRoadmap('### Phase 2.1: x\n');
    assert.equal(data.phases[0].number, '2.1');
  });
});

describe('parseRoadmap — collapsed roadmap (PARS-06, PARS-07)', () => {
  const data = parseRoadmap(load('collapsed-roadmap.md'));

  it('PARS-06: returns a non-empty phases array', () => {
    assert.ok(data.phases.length > 0, 'expected non-empty phases array');
  });

  it('PARS-06: single-phase row has expected number and name', () => {
    const phase5 = data.phases.find((p) => p.number === '5');
    assert.ok(phase5, 'expected phase with number "5"');
    assert.equal(phase5.name, 'Database Layer');
  });

  it('PARS-06: range row has correct number string and is done', () => {
    const rangePhase = data.phases.find((p) => p.number === '1-4');
    assert.ok(rangePhase, 'expected phase with number "1-4"');
    assert.equal(rangePhase.done, true);
  });

  it('PARS-07: every collapsed phase has a milestoneLabel', () => {
    for (const phase of data.phases) {
      assert.ok(
        typeof phase.milestoneLabel === 'string' && phase.milestoneLabel.length > 0,
        `phase ${phase.number} is missing milestoneLabel`,
      );
    }
  });

  it('PARS-07: milestoneLabel matches Progress table column-2 value', () => {
    const phase5 = data.phases.find((p) => p.number === '5');
    assert.ok(phase5, 'expected phase with number "5"');
    assert.equal(phase5.milestoneLabel, 'v1.1');
  });

  it('PARS-07: data.milestones is a non-empty array', () => {
    assert.ok(Array.isArray(data.milestones) && data.milestones.length > 0);
  });

  it('PARS-07: a known milestone has the expected label', () => {
    const ms = data.milestones?.find((m) => m.label === 'v1.0 Foundation');
    assert.ok(ms, 'expected milestone with label "v1.0 Foundation"');
  });

  // CR-01 regression guard: the `## Milestones` bullet labels
  // ("v1.0 Foundation") differ from the Progress-table milestone column
  // ("v1.0"), so a full-string join silently empties every milestone.
  it('CR-01: milestone.phases is populated despite label vs token mismatch', () => {
    const v10 = data.milestones?.find((m) => m.label === 'v1.0 Foundation');
    const v11 = data.milestones?.find((m) => m.label === 'v1.1 Core Features');
    const v12 = data.milestones?.find((m) => m.label === 'v1.2 Polish');
    const v20 = data.milestones?.find((m) => m.label === 'v2.0 Next');
    assert.deepEqual(v10?.phases, ['1-4'], 'v1.0 Foundation must own phase 1-4');
    assert.deepEqual(v11?.phases, ['5', '6'], 'v1.1 Core Features must own phases 5 and 6');
    assert.deepEqual(v12?.phases, ['7'], 'v1.2 Polish must own phase 7');
    assert.deepEqual(v20?.phases, ['8', '9'], 'v2.0 Next must own phases 8 and 9');
  });

  it('CR-01: no milestone has an empty phases list', () => {
    for (const ms of data.milestones ?? []) {
      assert.ok(ms.phases.length > 0, `milestone "${ms.label}" has no phases`);
    }
  });

  // WR-03: status cells use Complete / Shipped / ✅ / Done in the fixture.
  it('WR-03: recognizes Shipped, ✅, and Done as done statuses', () => {
    const byNumber = (n: string) => data.phases.find((p) => p.number === n);
    assert.equal(byNumber('5')?.done, true, '"Shipped" must mean done');
    assert.equal(byNumber('6')?.done, true, '"✅" must mean done');
    assert.equal(byNumber('7')?.done, true, '"Done" must mean done');
    assert.equal(byNumber('1-4')?.done, true, '"Complete" must mean done');
    assert.equal(byNumber('9')?.done, false, '"Not started" must mean not done');
  });
});

describe('parseRoadmap — collapsed roadmap column tolerance (WR-02)', () => {
  const data = parseRoadmap(load('collapsed-roadmap-4col.md'));

  it('WR-02: parses a 4-column Progress table (no "Plans Complete" column)', () => {
    assert.equal(data.phases.length, 2, 'expected both rows of the 4-column table');
  });

  it('WR-02: status cell is read from the correct column in a 4-column table', () => {
    const p12 = data.phases.find((p) => p.number === '1-2');
    const p3 = data.phases.find((p) => p.number === '3');
    assert.equal(p12?.done, true, 'row 1-2 status "Complete" → done');
    assert.equal(p3?.done, false, 'row 3 status "Not started" → not done');
  });

  it('WR-02: milestone column is read correctly in a 4-column table', () => {
    const p12 = data.phases.find((p) => p.number === '1-2');
    assert.equal(p12?.milestoneLabel, 'v1.0');
  });

  it('WR-02 / CR-01: milestone grouping still works for a 4-column table', () => {
    const v10 = data.milestones?.find((m) => m.label === 'v1.0 Foundation');
    assert.deepEqual(v10?.phases, ['1-2']);
  });
});

describe('parseRoadmap — Progress header detection skips separator row (WR-02)', () => {
  // The Markdown separator row (`|---|---|`) is the first `|`-row in this
  // fixture's Progress table. Header detection must skip it and latch onto
  // the real header row, so the "Status" column resolves to index 2 — not
  // the index-3 fallback that would mis-read the "Completed" date column.
  const data = parseRoadmap(load('collapsed-roadmap-separator-first.md'));

  it('WR-02: parses both data rows despite the separator row appearing first', () => {
    assert.equal(data.phases.length, 2, 'expected both Progress data rows');
  });

  it('WR-02: status column resolves correctly when the separator row is first', () => {
    const p12 = data.phases.find((p) => p.number === '1-2');
    const p3 = data.phases.find((p) => p.number === '3');
    assert.equal(p12?.done, true, 'row 1-2 status "Complete" → done (not the date column)');
    assert.equal(p3?.done, false, 'row 3 status "Not started" → not done');
  });

  it('WR-02: milestone column is read correctly when the separator row is first', () => {
    const p12 = data.phases.find((p) => p.number === '1-2');
    assert.equal(p12?.milestoneLabel, 'v1.0');
  });
});

describe('parseRoadmap — collapsed phase-bullet fallback (PARSE-12)', () => {
  // mcp_omni_connect layout: the `## Progress` table's phase cells are bare
  // numbers/ranges (`1–7.2`, `8`) with no `N. Name`, so the table reader yields
  // 0 phases. Phases must instead be sourced from the `## Phases` section's
  // `- [x] **Phase N: Name**` bullets, with milestones inferred from the
  // `Phases X–Y` ranges in the milestone bullets.
  const data = parseRoadmap(load('collapsed-roadmap-phase-bullets.md'));

  it('PARSE-12: sources phases from bullets when the Progress table yields none', () => {
    assert.equal(data.phases.length, 6, 'expected all 6 phase bullets');
  });

  it('PARSE-12: reads number and name from the bullet', () => {
    const p1 = data.phases.find((p) => p.number === '1');
    assert.equal(p1?.name, 'Context Injection');
  });

  it('PARSE-12: parses decimal (inserted) phase numbers', () => {
    assert.ok(data.phases.find((p) => p.number === '7.1'), 'expected phase 7.1');
    assert.ok(data.phases.find((p) => p.number === '7.2'), 'expected phase 7.2');
  });

  it('PARSE-12: reads done-status from the checkbox marker', () => {
    assert.equal(data.phases.find((p) => p.number === '8')?.done, true, '[x] → done');
    assert.equal(data.phases.find((p) => p.number === '9')?.done, false, '[ ] → not done');
  });

  it('PARSE-12: assigns milestoneLabel via the en-dash phase range', () => {
    assert.equal(data.phases.find((p) => p.number === '1')?.milestoneLabel, 'v1.0 Foundation');
    assert.equal(data.phases.find((p) => p.number === '7.2')?.milestoneLabel, 'v1.0 Foundation');
    assert.equal(data.phases.find((p) => p.number === '8')?.milestoneLabel, 'v2.0 Expansion');
  });

  it('PARSE-12: every milestone owns its phases', () => {
    const v1 = data.milestones?.find((m) => m.label === 'v1.0 Foundation');
    const v2 = data.milestones?.find((m) => m.label === 'v2.0 Expansion');
    assert.deepEqual(v1?.phases, ['1', '7.1', '7.2']);
    assert.deepEqual(v2?.phases, ['8', '9']);
  });

  it('PARSE-12: assigns a single-phase milestone via `Phase N` (no range)', () => {
    assert.equal(data.phases.find((p) => p.number === '10')?.milestoneLabel, 'v2.1 Hotfix');
    const v21 = data.milestones?.find((m) => m.label === 'v2.1 Hotfix');
    assert.deepEqual(v21?.phases, ['10']);
  });
});

describe('parseRoadmap — expanded roadmap milestone inheritance (#4)', () => {
  // Expanded ROADMAPs use `## Milestone vX.Y ...` H2 sections to group
  // `### Phase N:` detail blocks. Each phase under such a section must
  // inherit the milestone label so tree-view grouping can join phases to
  // milestone bullets via milestoneKey(). Without this, every phase falls
  // through to the synthetic "Other" milestone (issue #4).
  it('assigns milestoneLabel from the current ## Milestone H2 section', () => {
    const data = parseRoadmap(
      '# Roadmap: Sample\n' +
        '## Milestones\n' +
        '- [x] **v1.0 Foundation** — initial release\n' +
        '- [x] **v2.0 Next** — follow-up\n' +
        '## Milestone v1.0 Foundation\n' +
        '### Phase 1: A\n**Goal:** a\n' +
        '### Phase 2: B\n**Goal:** b\n' +
        '## Milestone v2.0 Next\n' +
        '### Phase 3: C\n**Goal:** c\n',
    );
    const p1 = data.phases.find((p) => p.number === '1');
    const p2 = data.phases.find((p) => p.number === '2');
    const p3 = data.phases.find((p) => p.number === '3');
    assert.equal(p1?.milestoneLabel, 'v1.0 Foundation');
    assert.equal(p2?.milestoneLabel, 'v1.0 Foundation');
    assert.equal(p3?.milestoneLabel, 'v2.0 Next');
  });

  it('leaves milestoneLabel undefined when no ## Milestone H2 precedes the phase', () => {
    const data = parseRoadmap('### Phase 1: A\n**Goal:** a\n');
    assert.equal(data.phases[0].milestoneLabel, undefined);
  });
});

describe('parseRoadmap — in-progress milestone bullets (#4)', () => {
  // Real GSD ROADMAPs (e.g. mcp_omni_connect) mark the active milestone with
  // 🚧 instead of ✅ or [x]. Without 🚧 in MILESTONE_BULLET_PATTERN the active
  // milestone is dropped from the milestones list and its phases land under
  // the synthetic "Other" bucket in the tree view.
  it('includes a 🚧 in-progress milestone in milestones[]', () => {
    const data = parseRoadmap(
      '# Roadmap: Sample\n' +
        '## Milestones\n' +
        '- ✅ **v3.1 Hardening** — Phases 28–32\n' +
        '- 🚧 **v3.2 training_data Service Integration** — Phases 33–38\n',
    );
    const labels = (data.milestones ?? []).map((m) => m.label);
    assert.deepEqual(labels, [
      'v3.1 Hardening',
      'v3.2 training_data Service Integration',
    ]);
  });

  it('infers milestoneLabel from "Phases N–M" in the bullet description when no ## Milestone H2 exists', () => {
    // mcp_omni_connect layout: milestones live only as bullets with
    // `Phases N–M` in the em-dash tail; `### Phase N:` blocks live flat
    // under `## Phase Details` with no milestone parent header.
    const data = parseRoadmap(
      '# Roadmap: Sample\n' +
        '## Milestones\n' +
        '- ✅ **v3.1 Hardening** — Phases 28–32 (shipped)\n' +
        '- 🚧 **v3.2 training_data** — Phases 33–38 (started)\n' +
        '## Phase Details\n' +
        '### Phase 28: Doc\n**Goal:** d\n' +
        '### Phase 29.1: Hotfix\n**Goal:** h\n' +
        '### Phase 33: Discovery\n**Goal:** disc\n' +
        '### Phase 38: CI\n**Goal:** ci\n',
    );
    const find = (n: string) => data.phases.find((p) => p.number === n);
    assert.equal(find('28')?.milestoneLabel, 'v3.1 Hardening');
    assert.equal(find('29.1')?.milestoneLabel, 'v3.1 Hardening');
    assert.equal(find('33')?.milestoneLabel, 'v3.2 training_data');
    assert.equal(find('38')?.milestoneLabel, 'v3.2 training_data');
  });

  it('includes a [ ] unchecked milestone in milestones[]', () => {
    const data = parseRoadmap(
      '## Milestones\n' +
        '- [x] **v1.0 Done** — shipped\n' +
        '- [ ] **v2.0 Planned** — upcoming\n',
    );
    const labels = (data.milestones ?? []).map((m) => m.label);
    assert.deepEqual(labels, ['v1.0 Done', 'v2.0 Planned']);
  });
});

describe('parseRoadmap — directive punctuation styles (WR-01)', () => {
  it('accepts colon-outside style (**Goal**:)', () => {
    const data = parseRoadmap(
      '### Phase 1: A\n**Goal**: outside style\n**Mode**: mvp\n' +
        '**Depends on**: none\n**Requirements**: R-01, R-02\n',
    );
    assert.equal(data.phases[0].goal, 'outside style');
    assert.equal(data.phases[0].mode, 'mvp');
    assert.equal(data.phases[0].dependsOn, 'none');
    assert.deepEqual(data.phases[0].requirements, ['R-01', 'R-02']);
  });

  it('accepts colon-inside style (**Goal:**)', () => {
    const data = parseRoadmap(
      '### Phase 1: A\n**Goal:** inside style\n**Mode:** mvp\n' +
        '**Depends on:** none\n**Requirements:** R-01, R-02\n',
    );
    assert.equal(data.phases[0].goal, 'inside style');
    assert.equal(data.phases[0].mode, 'mvp');
    assert.equal(data.phases[0].dependsOn, 'none');
    assert.deepEqual(data.phases[0].requirements, ['R-01', 'R-02']);
  });

  it('accepts mixed styles across directives in a single phase', () => {
    const data = parseRoadmap(
      '### Phase 1: A\n**Goal**: outside\n**Mode:** inside\n' +
        '**Depends on:** inside\n**Requirements**: R-01\n',
    );
    assert.equal(data.phases[0].goal, 'outside');
    assert.equal(data.phases[0].mode, 'inside');
    assert.equal(data.phases[0].dependsOn, 'inside');
    assert.deepEqual(data.phases[0].requirements, ['R-01']);
  });
});
