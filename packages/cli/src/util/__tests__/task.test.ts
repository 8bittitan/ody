import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getTaskFilesInDir } from '../task';

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
