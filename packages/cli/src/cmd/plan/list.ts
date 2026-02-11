import { log, outro } from '@clack/prompts';
import { defineCommand } from 'citty';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { resolveTasksDir, parseFrontmatter, parseTitle } from '../../util/task';

export const listCmd = defineCommand({
  meta: {
    name: 'list',
    description: 'List pending tasks',
  },
  async run() {
    const tasksDir = resolveTasksDir();

    let files: string[];
    try {
      files = await readdir(tasksDir);
    } catch {
      log.info('No tasks directory found.');
      return;
    }

    const taskFiles = files.filter((f) => f.endsWith('.code-task.md'));

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      return;
    }

    const pending: { title: string; filename: string }[] = [];

    for (const filename of taskFiles) {
      const content = await Bun.file(path.join(tasksDir, filename)).text();
      const frontmatter = parseFrontmatter(content);

      if (frontmatter.status === 'pending') {
        const title = parseTitle(content);
        pending.push({ title, filename });
      }
    }

    if (pending.length === 0) {
      log.info('No pending tasks.');
      return;
    }

    log.info(`Found ${pending.length} pending task(s):\n`);

    for (const task of pending) {
      log.message(`  - ${task.title}  (${task.filename})`);
    }

    outro('Done');

    process.exit(0);
  },
});
