import { strict as assert } from 'node:assert';
import { parseRoadmap } from '../../parsers/roadmap.js';
import { parseState } from '../../parsers/state.js';

const LIMIT_MS = 100;

describe('PARS-05 — stress / catastrophic backtracking guard', () => {
  it('parseRoadmap completes in <100ms on pathological input', () => {
    const parts: string[] = [];
    parts.push('#'.repeat(50_000));
    parts.push('\n');
    for (let i = 0; i < 500; i++) {
      parts.push(`### Phase 1: ${'x'.repeat(200)}\n`);
    }
    for (let i = 0; i < 500; i++) {
      parts.push(`- [x] **Phase ${i}: ${'y'.repeat(50)}\n`);
    }
    parts.push('*'.repeat(50_000));
    const input = parts.join('');

    const t0 = performance.now();
    const data = parseRoadmap(input);
    const dt = performance.now() - t0;

    assert.ok(Array.isArray(data.phases), 'expected phases array');
    assert.ok(dt < LIMIT_MS, `parseRoadmap took ${dt.toFixed(2)}ms (limit ${LIMIT_MS}ms)`);
  });

  it('parseState completes in <100ms on pathological input', () => {
    const parts: string[] = [];
    parts.push('---\n');
    for (let i = 0; i < 500; i++) {
      parts.push(`key_${i}: ${'v'.repeat(200)}\n`);
    }
    parts.push('---\n');
    for (let i = 0; i < 1000; i++) {
      parts.push(`Phase: ${i}.${i} of 9999 (${'n'.repeat(100)})\n`);
    }
    parts.push('*'.repeat(50_000));
    const input = parts.join('');

    const t0 = performance.now();
    const data = parseState(input);
    const dt = performance.now() - t0;

    assert.equal(typeof data, 'object');
    assert.ok(dt < LIMIT_MS, `parseState took ${dt.toFixed(2)}ms (limit ${LIMIT_MS}ms)`);
  });
});
