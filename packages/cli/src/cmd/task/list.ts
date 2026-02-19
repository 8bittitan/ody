import { log, outro } from '@clack/prompts';
import { defineCommand } from 'citty';
import { exists } from 'node:fs/promises';
import path from 'node:path';

import {
  getTaskFilesInTasksDir,
  mapWithConcurrency,
  parseFrontmatter,
  parseTitle,
  resolveTasksDir,
} from '../../util/task';

const TASK_READ_CONCURRENCY = 8;

export const listCmd = defineCommand({
  meta: {
    name: 'list',
    description: 'List pending tasks',
  },
  async run() {
    const tasksDir = resolveTasksDir();

    if (!(await exists(tasksDir))) {
      log.error(`${tasksDir} not found.`);
      return;
    }

    const taskFiles = await getTaskFilesInTasksDir();

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      return;
    }

    const pendingTaskData = await mapWithConcurrency(
      taskFiles,
      TASK_READ_CONCURRENCY,
      async (filename) => {
        const content = await Bun.file(path.join(tasksDir, filename)).text();
        const frontmatter = parseFrontmatter(content);

        if (frontmatter.status !== 'pending') {
          return null;
        }

        const title = parseTitle(content);
        return { title, filename };
      },
    );

    const pending = pendingTaskData.filter((task): task is { title: string; filename: string } =>
      Boolean(task),
    );

    if (pending.length === 0) {
      log.info('No pending tasks.');
      return;
    }

    log.info(`Found ${pending.length} pending task(s):`);

    for (const task of pending) {
      log.message(`  - ${task.title}  (${task.filename})`);
    }

    outro('Done');
  },
});
