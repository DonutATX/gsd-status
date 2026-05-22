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
