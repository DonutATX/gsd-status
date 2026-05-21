import { strict as assert } from 'node:assert';
import { debounce } from '../../state/debounce.js';

describe('WAT-02 — debounce coalescing', () => {
  it('three rapid calls within window result in exactly 1 invocation', function (done) {
    this.timeout(500);
    let count = 0;
    const debounced = debounce(() => { count++; }, 50);

    debounced();
    debounced();
    debounced();

    setTimeout(() => {
      try {
        assert.equal(count, 1, `expected 1 invocation, got ${count}`);
        done();
      } catch (err) {
        done(err);
      }
    }, 100);
  });

  it('timer resets on each call — calls at t=0, t=40, t=80 with 80ms window: 0 at t=100, 1 by t=200', function (done) {
    this.timeout(500);
    let count = 0;
    const debounced = debounce(() => { count++; }, 80);

    debounced(); // t=0
    setTimeout(() => { debounced(); }, 40); // t=40 — resets
    setTimeout(() => { debounced(); }, 80); // t=80 — resets

    setTimeout(() => {
      // At t=100, last call was at t=80, timer should not have fired yet
      const countAt100 = count;
      setTimeout(() => {
        try {
          assert.equal(countAt100, 0, `expected 0 invocations at t=100, got ${countAt100}`);
          assert.equal(count, 1, `expected 1 invocation by t=200, got ${count}`);
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    }, 100);
  });

  it('a single call invokes fn exactly once after ms elapses', function (done) {
    this.timeout(300);
    let count = 0;
    const debounced = debounce(() => { count++; }, 50);

    debounced();

    setTimeout(() => {
      try {
        assert.equal(count, 1, `expected 1 invocation after delay, got ${count}`);
        done();
      } catch (err) {
        done(err);
      }
    }, 100);
  });
});
