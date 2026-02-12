import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { logger } from '../logger';

describe('logger', () => {
  test('logger is defined', () => {
    expect(logger).toBeDefined();
  });

  test('logger.level equals 4', () => {
    expect(logger.level).toBe(4);
  });

  test('fatal reporter calls process.exit(1) on fatal log', () => {
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      logger.fatal('test fatal message');
    } catch {
      // Expected — our mock throws to prevent actual exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  afterEach(() => {
    // Ensure process.exit is restored even if a test fails
    if ((process.exit as any).mockRestore) {
      (process.exit as any).mockRestore();
    }
  });
});
