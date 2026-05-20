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
