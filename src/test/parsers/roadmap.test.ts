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
