import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseState } from '../../parsers/state.js';

const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'parsers', 'fixtures');

function load(name: string): string {
  return readFileSync(path.join(FIXTURES, name), 'utf8');
}

describe('parseState — canonical', () => {
  const data = parseState(load('canonical-state.md'));

  it('captures milestone label from frontmatter', () => {
    assert.equal(data.milestone, 'v1.0');
  });

  it('captures milestone_name', () => {
    assert.equal(data.milestoneName, 'milestone');
  });

  it('captures status', () => {
    assert.equal(data.status, 'planning');
  });

  it('captures last_updated with quotes stripped', () => {
    assert.equal(data.lastUpdated, '2026-05-20T20:31:23.470Z');
  });

  it('parses Phase position number', () => {
    assert.equal(data.phaseNumber, '1');
  });

  it('parses Phase position name', () => {
    assert.equal(data.phaseName, 'Scaffold + Minimal Status Bar');
  });

  it('captures last entry raw text matching Roadmap created', () => {
    assert.ok(data.lastEntry, 'lastEntry should be set');
    assert.match(data.lastEntry!.raw, /Completed 01-02-PLAN|Roadmap created/);
  });

  it('extracts ISO date from last entry timestamp', () => {
    assert.equal(data.lastEntry?.timestamp, '2026-05-20');
  });
});

describe('parseState — robustness (PARS-03)', () => {
  it('returns {} for empty string', () => {
    assert.deepEqual(parseState(''), {});
  });

  it('returns {} for empty.md fixture', () => {
    assert.deepEqual(parseState(load('empty.md')), {});
  });

  it('never throws on malformed-state.md', () => {
    assert.doesNotThrow(() => parseState(load('malformed-state.md')));
  });

  it('supports decimal phase numbers', () => {
    const d = parseState('Phase: 2.1 of 6 (Decimal phase)\n');
    assert.equal(d.phaseNumber, '2.1');
    assert.equal(d.phaseName, 'Decimal phase');
  });

  it('falls back to frontmatter last_activity when body Last activity is absent', () => {
    const d = parseState('---\nlast_activity: 2026-05-20 — fallback\n---\n');
    assert.equal(d.lastEntry?.text, '2026-05-20 — fallback');
  });

  it('prefers body Last activity line over frontmatter last_activity', () => {
    const text =
      '---\nlast_activity: 2026-05-20 — frontmatter wins?\n---\n\nLast activity: 2026-05-21 — body wins\n';
    const d = parseState(text);
    assert.equal(d.lastEntry?.text, '2026-05-21 — body wins');
  });
});

describe('parseState — recentEntries (PANL-04)', () => {
  it('Test 1 (canonical, single body entry): recentEntries has length 1 and matches lastEntry', () => {
    const data = parseState(load('canonical-state.md'));
    assert.ok(data.recentEntries, 'recentEntries should be set');
    assert.equal(data.recentEntries!.length, 1);
    assert.deepEqual(data.recentEntries![0], data.lastEntry);
  });

  it('Test 2 (multi-entry body): recentEntries has length 3 ordered as they appear in file', () => {
    const data = parseState(load('multi-entry-state.md'));
    assert.ok(data.recentEntries, 'recentEntries should be set');
    assert.equal(data.recentEntries!.length, 3);
    assert.match(data.recentEntries![0].raw, /Completed 05-01-PLAN/);
    assert.match(data.recentEntries![1].raw, /Completed 04-03-PLAN/);
    assert.match(data.recentEntries![2].raw, /Completed 04-02-PLAN/);
    assert.ok(data.recentEntries![0].text, 'first entry text should be populated');
    assert.ok(data.recentEntries![1].text, 'second entry text should be populated');
    assert.ok(data.recentEntries![2].text, 'third entry text should be populated');
  });

  it('Test 3 (lastEntry unchanged): lastEntry deep-equals recentEntries[0] for multi-entry fixture', () => {
    const data = parseState(load('multi-entry-state.md'));
    assert.ok(data.lastEntry, 'lastEntry should be set');
    assert.ok(data.recentEntries, 'recentEntries should be set');
    assert.deepEqual(data.lastEntry, data.recentEntries![0]);
  });

  it('Test 4 (frontmatter fallback): recentEntries has length 1 and matches lastEntry when no body entries', () => {
    const text = '---\nlast_activity: 2026-05-20 — fallback entry\n---\n\nNo activity lines here.\n';
    const data = parseState(text);
    assert.ok(data.recentEntries, 'recentEntries should be set via frontmatter fallback');
    assert.equal(data.recentEntries!.length, 1);
    assert.deepEqual(data.recentEntries![0], data.lastEntry);
  });

  it('Test 5 (no activity at all): recentEntries is undefined when neither body nor frontmatter has activity', () => {
    const text = '---\nmilestone: v1.0\n---\n\nNo activity anywhere.\n';
    const data = parseState(text);
    assert.equal(data.recentEntries, undefined);
    assert.equal(data.lastEntry, undefined);
  });
});
