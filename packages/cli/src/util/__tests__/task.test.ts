import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getTaskFilesInDir, mapWithConcurrency } from '../task';

describe('task file discovery', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ody-task-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('returns empty list when task directory does not exist', async () => {
    const files = await getTaskFilesInDir(path.join(tmpDir, 'missing'));

    expect(files).toEqual([]);
  });

  test('loads only task files in deterministic order', async () => {
    await Bun.write(path.join(tmpDir, 'zeta.code-task.md'), '# Task: Zeta\n');
    await Bun.write(path.join(tmpDir, 'alpha.code-task.md'), '# Task: Alpha\n');
    await Bun.write(path.join(tmpDir, 'notes.md'), '# Notes\n');

    const files = await getTaskFilesInDir(tmpDir);

    expect(files).toEqual(['alpha.code-task.md', 'zeta.code-task.md']);
  });
});

describe('mapWithConcurrency', () => {
  test('preserves input order while running mapper concurrently', async () => {
    const values = [1, 2, 3, 4, 5];

    const results = await mapWithConcurrency(values, 3, async (value) => {
      await Bun.sleep((6 - value) * 2);
      return value * 10;
    });

    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  test('does not exceed provided concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(
      Array.from({ length: 12 }, () => 0),
      4,
      async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Bun.sleep(5);
        inFlight -= 1;
        return null;
      },
    );

    expect(maxInFlight).toBeLessThanOrEqual(4);
  });
});
