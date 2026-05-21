import { strict as assert } from 'node:assert';
import { relativeTime } from '../../state/relativeTime.js';

describe('relativeTime — <60s bucket', () => {
  it('returns "just now" for a timestamp 30 seconds ago', () => {
    const ts = new Date(Date.now() - 30_000).toISOString();
    assert.equal(relativeTime(ts), 'just now');
  });

  it('returns "just now" for a timestamp 1 second ago', () => {
    const ts = new Date(Date.now() - 1_000).toISOString();
    assert.equal(relativeTime(ts), 'just now');
  });
});

describe('relativeTime — <60m bucket', () => {
  it('returns "5m ago" for a timestamp 5 minutes ago', () => {
    const ts = new Date(Date.now() - 5 * 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), '5m ago');
  });

  it('returns "1m ago" for a timestamp 1 minute ago', () => {
    const ts = new Date(Date.now() - 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), '1m ago');
  });
});

describe('relativeTime — <24h bucket', () => {
  it('returns "2h ago" for a timestamp 2 hours ago', () => {
    const ts = new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), '2h ago');
  });

  it('returns "1h ago" for a timestamp 1 hour ago', () => {
    const ts = new Date(Date.now() - 60 * 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), '1h ago');
  });
});

describe('relativeTime — >=24h bucket', () => {
  it('returns "1 days ago" for a timestamp 1 day ago', () => {
    const ts = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), '1 days ago');
  });

  it('returns "3 days ago" for a timestamp 3 days ago', () => {
    const ts = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), '3 days ago');
  });
});

describe('relativeTime — edge cases', () => {
  it('returns "unknown" for undefined', () => {
    assert.equal(relativeTime(undefined), 'unknown');
  });

  it('returns "unknown" for empty string', () => {
    assert.equal(relativeTime(''), 'unknown');
  });

  it('returns "unknown" for non-parseable string', () => {
    assert.equal(relativeTime('not-a-date'), 'unknown');
  });

  it('returns "unknown" for a future timestamp (negative diff)', () => {
    const ts = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
    assert.equal(relativeTime(ts), 'unknown');
  });
});
