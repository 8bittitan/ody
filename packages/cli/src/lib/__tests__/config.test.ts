import { log } from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ZodError } from 'zod';

import { Config } from '../config';

describe('Config', () => {
  describe('parse — valid input', () => {
    test('parses a full valid config', () => {
      const raw = { backend: 'claude', maxIterations: 5 };
      const result = Config.parse(raw);

      expect(result.backend).toBe('claude');
      expect(result.maxIterations).toBe(5);
    });

    test('applies defaults for optional fields', () => {
      const raw = { backend: 'claude', maxIterations: 5 };
      const result = Config.parse(raw);

      expect(result.shouldCommit).toBe(false);
      expect(result.tasksDir).toBe('tasks');
      expect(result.notify).toBe(false);
      expect(result.skipPermissions).toBe(true);
    });

    test('maxIterations: 0 is valid', () => {
      const raw = { backend: 'claude', maxIterations: 0 };
      const result = Config.parse(raw);

      expect(result.maxIterations).toBe(0);
    });

    test('each valid backend succeeds', () => {
      for (const backend of ['opencode', 'claude', 'codex']) {
        const result = Config.parse({ backend, maxIterations: 1 });
        expect(result.backend).toBe(backend);
      }
    });

    test('valid notify variants are accepted', () => {
      const variants = [true, false, 'all', 'individual'] as const;

      for (const notify of variants) {
        const result = Config.parse({ backend: 'claude', maxIterations: 1, notify });
        expect(result.notify).toBe(notify);
      }
    });

    test('optional fields can be omitted', () => {
      const raw = { backend: 'claude', maxIterations: 1 };
      const result = Config.parse(raw);

      expect(result.model).toBeUndefined();
      // validatorCommands has a .default([]) so it resolves to [] when omitted
      expect(result.validatorCommands).toEqual([]);
    });

    test('model and validatorCommands are preserved when provided', () => {
      const raw = {
        backend: 'claude',
        maxIterations: 1,
        model: 'gpt-4',
        validatorCommands: ['bun lint', 'bun test'],
      };
      const result = Config.parse(raw);

      expect(result.model).toBe('gpt-4');
      expect(result.validatorCommands).toEqual(['bun lint', 'bun test']);
    });

    test('agent field defaults to build when omitted', () => {
      const raw = { backend: 'claude', maxIterations: 1 };
      const result = Config.parse(raw);

      expect(result.agent).toBe('build');
    });

    test('agent field preserves custom value', () => {
      const raw = { backend: 'claude', maxIterations: 1, agent: 'custom' };
      const result = Config.parse(raw);

      expect(result.agent).toBe('custom');
    });
  });

  describe('parse — invalid input', () => {
    test('missing backend throws ZodError', () => {
      expect(() => Config.parse({ maxIterations: 5 })).toThrow(ZodError);
    });

    test('missing maxIterations throws ZodError', () => {
      expect(() => Config.parse({ backend: 'claude' })).toThrow(ZodError);
    });

    test('invalid backend value throws ZodError', () => {
      expect(() => Config.parse({ backend: 'invalid-backend', maxIterations: 5 })).toThrow(
        ZodError,
      );
    });

    test('negative maxIterations throws ZodError', () => {
      expect(() => Config.parse({ backend: 'claude', maxIterations: -1 })).toThrow(ZodError);
    });

    test('float maxIterations throws ZodError', () => {
      expect(() => Config.parse({ backend: 'claude', maxIterations: 1.5 })).toThrow(ZodError);
    });

    test('empty string backend throws ZodError', () => {
      expect(() => Config.parse({ backend: '', maxIterations: 5 })).toThrow(ZodError);
    });

    test('empty object throws ZodError', () => {
      expect(() => Config.parse({})).toThrow(ZodError);
    });

    test('invalid notify value throws ZodError', () => {
      expect(() =>
        Config.parse({ backend: 'claude', maxIterations: 1, notify: 'invalid' }),
      ).toThrow(ZodError);
    });
  });

  describe('access guards — all() and get()', () => {
    let logSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      logSpy = spyOn(log, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    // Note: These tests work because Config.load() has not been called
    // in this test process with valid local/global config files present.
    // The Config namespace's internal `config` variable is undefined until
    // a successful load() call sets it.
    //
    // We re-import a fresh module to guarantee the guard path is exercised.
    test('Config.all() throws when config is not loaded', async () => {
      // Re-import to get a fresh module with undefined config state
      const freshModule = await import('../config');
      // Access the Config namespace from the fresh import
      const FreshConfig = freshModule.Config;

      expect(() => FreshConfig.all()).toThrow('Config not loaded');
    });

    test('Config.get() throws when config is not loaded', async () => {
      const freshModule = await import('../config');
      const FreshConfig = freshModule.Config;

      const spy = spyOn(log, 'error').mockImplementation(() => {});

      try {
        expect(() => FreshConfig.get('backend')).toThrow('Config not loaded');
        expect(spy).toHaveBeenCalledWith('Must `.load` configuration first');
      } finally {
        spy.mockRestore();
      }
    });
  });
});
