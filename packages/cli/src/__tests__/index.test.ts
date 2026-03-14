import { afterEach, describe, expect, mock, test } from 'bun:test';

import { runCli } from '../index';

describe('runCli', () => {
  afterEach(() => {
    process.exitCode = 0;
    mock.restore();
  });

  test('keeps a successful exit status when runMain completes', async () => {
    await runCli(async () => {});

    expect(process.exitCode).toBeUndefined();
  });

  test('registers the review subcommand', async () => {
    await runCli(async (cmd) => {
      expect(typeof (cmd.subCommands as Record<string, unknown>).review).toBe('function');
    });
  });

  test('registers the resolve subcommand', async () => {
    await runCli(async (cmd) => {
      expect(typeof (cmd.subCommands as Record<string, unknown>).resolve).toBe('function');
    });
  });

  test('sets a failure exit status when runMain throws', async () => {
    await runCli(async () => {
      throw new Error('boom');
    });

    expect(process.exitCode).toBe(1);
  });
});
