import { describe, expect, spyOn, test } from 'bun:test';

import { getRandomValidatorPlaceholder } from './inputPrompt';

describe('inputPrompt', () => {
  describe('getRandomValidatorPlaceholder', () => {
    const EXPECTED_COMMANDS: string[] = [
      'bun run lint',
      'make test',
      'npm run typecheck',
      'pylint',
      'go test ./...',
      'rubocop --lint',
    ];

    test('returns a string', () => {
      const result = getRandomValidatorPlaceholder();
      expect(typeof result).toBe('string');
    });

    test('returns one of the expected placeholder commands', () => {
      const result = getRandomValidatorPlaceholder();
      expect(EXPECTED_COMMANDS).toContain(result);
    });

    test('returns only values from the expected set when called repeatedly', () => {
      const results = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const result = getRandomValidatorPlaceholder();
        expect(EXPECTED_COMMANDS).toContain(result);
        results.add(result);
      }

      for (const result of results) {
        expect(EXPECTED_COMMANDS).toContain(result);
      }
    });

    test('returns first element when Math.random returns 0', () => {
      const randomSpy = spyOn(Math, 'random').mockReturnValue(0);

      const result = getRandomValidatorPlaceholder();
      expect(result).toBe('bun run lint');

      randomSpy.mockRestore();
    });

    test('returns last element when Math.random returns value near 1', () => {
      const randomSpy = spyOn(Math, 'random').mockReturnValue(0.99);

      const result = getRandomValidatorPlaceholder();
      expect(result).toBe('rubocop --lint');

      randomSpy.mockRestore();
    });

    test('returns correct element for middle index', () => {
      const randomSpy = spyOn(Math, 'random').mockReturnValue(0.5);

      const result = getRandomValidatorPlaceholder();
      const expectedIndex = Math.floor(0.5 * EXPECTED_COMMANDS.length);
      expect(result).toBe(EXPECTED_COMMANDS[expectedIndex]!);

      randomSpy.mockRestore();
    });

    test('returns all possible values over many calls', () => {
      const results = new Set<string>();

      for (let i = 0; i < 200; i++) {
        results.add(getRandomValidatorPlaceholder());
      }

      expect(results.size).toBe(EXPECTED_COMMANDS.length);
      for (const cmd of EXPECTED_COMMANDS) {
        expect(results.has(cmd)).toBe(true);
      }
    });
  });
});
