import { describe, expect, test } from 'bun:test';

import { normalizeOptionalPromptValue } from '../init';

describe('normalizeOptionalPromptValue', () => {
  test('preserves cancelled prompt results as non-string sentinels', () => {
    const cancelledPrompt = Symbol('cancelled');

    expect(typeof normalizeOptionalPromptValue(cancelledPrompt)).toBe('symbol');
  });

  test('keeps blank input as an empty string', () => {
    expect(normalizeOptionalPromptValue('')).toBe('');
    expect(normalizeOptionalPromptValue('   ')).toBe('');
  });

  test('trims successful prompt input', () => {
    expect(normalizeOptionalPromptValue('  codex  ')).toBe('codex');
  });
});
