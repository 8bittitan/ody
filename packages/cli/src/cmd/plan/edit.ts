import { log, outro, select, isCancel } from '@clack/prompts';
import { defineCommand } from 'citty';
import path from 'node:path';

import { Backend } from '../../backends/backend';
import { buildEditPlanPrompt } from '../../builders/editPlanPrompt';
import { Config } from '../../lib/config';
import { Stream } from '../../util/stream';
import { resolveTasksDir, parseTitle } from '../../util/task';

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
    verbose: {
      default: false,
      description: "Enable verbose logging, streaming the agent's work in progress",
      type: 'boolean',
    },
  },
  async run({ args }) {
    const tasksDir = resolveTasksDir();

    const glob = new Bun.Glob('*.code-task.md');
    const taskFiles = Array.from(glob.scanSync({ cwd: tasksDir }));

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      return;
    }

    const options: { value: string; label: string }[] = [];

    for (const filename of taskFiles) {
      const content = await Bun.file(path.join(tasksDir, filename)).text();
      const title = parseTitle(content);
      options.push({ value: filename, label: `${title}  (${filename})` });
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
    const fileContent = await Bun.file(filePath).text();

    const editPrompt = buildEditPlanPrompt({ filePath, fileContent });

    if (args['dry-run']) {
      log.info(editPrompt);
      outro('Dry run complete');
      return;
    }

    const backend = new Backend(Config.get('backend'));

    log.info('Running editor agent');

    const proc = Bun.spawn({
      cmd: backend.buildCommand(editPrompt),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await Promise.all([
      Stream.toOutput(proc.stdout, { shouldPrint: args.verbose }),
      Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
    ]);

    const exitCode = await proc.exited;

    if (exitCode > 0) {
      log.error('Failed to edit task');
      return;
    }

    log.success('Edit complete');
    outro('Task plan updated');
  },
});
