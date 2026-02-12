import { describe, expect, test } from 'bun:test';

import { createSequencer } from '../sequencer';

describe('createSequencer', () => {
  test('default initial value starts at 0, first next() returns 1', () => {
    const seq = createSequencer();
    expect(seq.next()).toBe(1);
  });

  test('custom initial value — first next() returns initial + 1', () => {
    const seq = createSequencer(10);
    expect(seq.next()).toBe(11);
  });

  test('multiple sequential calls return incrementing values', () => {
    const seq = createSequencer();
    expect(seq.next()).toBe(1);
    expect(seq.next()).toBe(2);
    expect(seq.next()).toBe(3);
  });

  test('multiple independent sequencers maintain separate state', () => {
    const a = createSequencer();
    const b = createSequencer(100);

    expect(a.next()).toBe(1);
    expect(b.next()).toBe(101);
    expect(a.next()).toBe(2);
    expect(b.next()).toBe(102);
  });

  test('negative initial value works correctly', () => {
    const seq = createSequencer(-5);
    expect(seq.next()).toBe(-4);
    expect(seq.next()).toBe(-3);
  });
});
