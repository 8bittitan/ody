import path from 'node:path';

import { log, outro, select, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../../backends/backend';
import { buildEditPlanPrompt } from '../../builders/editPlanPrompt';
import { Config } from '../../lib/config';
import {
  getTaskFilesInTasksDir,
  mapWithConcurrency,
  parseFrontmatter,
  parseTitle,
  resolveTasksDir,
} from '../../util/task';

const TASK_READ_CONCURRENCY = 8;

export const editCmd = defineCommand({
  meta: {
    name: 'edit',
    description: 'Edit an existing task plan',
  },
  args: {
    ['dry-run']: {
      default: false,
      description: 'Run as dry run, without sending prompt to agent',
      type: 'boolean',
      alias: 'd',
    },
  },
  async run({ args }) {
    const tasksDir = resolveTasksDir();

    const taskFiles = await getTaskFilesInTasksDir();

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      return;
    }

    const taskOptions = await mapWithConcurrency(
      taskFiles,
      TASK_READ_CONCURRENCY,
      async (filename) => {
        const content = await Bun.file(path.join(tasksDir, filename)).text();
        const frontmatter = parseFrontmatter(content);

        if (frontmatter.status !== 'pending') {
          return null;
        }

        const title = parseTitle(content);
        return { value: filename, label: `${title}  (${filename})` };
      },
    );

    const options = taskOptions.filter((task): task is { value: string; label: string } =>
      Boolean(task),
    );

    if (options.length === 0) {
      log.info('No pending tasks to edit.');
      return;
    }

    const selected = await select({
      message: 'Select a task plan to edit',
      options,
    });

    if (isCancel(selected)) {
      outro('Edit cancelled.');
      return;
    }

    const filePath = path.join(tasksDir, selected);
    const editPrompt = buildEditPlanPrompt({ filePath });

    if (args['dry-run']) {
      log.info(editPrompt);
      outro('Dry run complete');
      return;
    }

    const config = Config.all();
    const backend = new Backend(config.backend);
    const model = Config.resolveModel('edit', config);

    log.info('Opening editor agent in interactive mode');

    const proc = Bun.spawn({
      cmd: backend.buildInteractiveCommand(editPrompt, model),
      stdio: ['inherit', 'inherit', 'inherit'],
    });

    const exitCode = await proc.exited;

    if (exitCode > 0) {
      log.error('Failed to edit task');
      return;
    }

    outro('Finished with edit');
  },
});
