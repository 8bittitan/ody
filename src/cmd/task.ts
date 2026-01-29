import { defineCommand } from 'citty';
import { exists, mkdir } from 'fs/promises';
import path from 'path';

import { logger } from '../lib/logger';
import { BASE_DIR, PRD_FILE } from '../util/constants';

type Task = {
  category: string;
  description: string;
  steps: string[];
  passes: boolean;
};

const taskNewCmd = defineCommand({
  meta: {
    name: 'new',
    description: 'Create a new task in .ody/prd.json',
  },
  args: {
    category: {
      description: 'Task category (defaults to functional)',
      type: 'string',
      default: 'functional',
    },
  },
  async run({ args }) {
    logger.start('Creating new task');

    const description = await logger.prompt('Task description:', {
      required: true,
      type: 'text',
    });

    if (!description) {
      logger.fatal('Task description is required.');
      return;
    }

    let stepCount = 0;

    while (true) {
      const rawCount = await logger.prompt('How many steps?', {
        required: true,
        type: 'text',
      });

      const parsed = Number.parseInt(String(rawCount), 10);

      if (!Number.isNaN(parsed) && parsed > 0) {
        stepCount = parsed;
        break;
      }

      logger.warn('Please enter a positive integer for the step count.');
    }

    const steps: string[] = [];

    for (let i = 0; i < stepCount; i += 1) {
      const step = await logger.prompt(`Step ${i + 1}:`, {
        required: true,
        type: 'text',
      });

      if (!step) {
        logger.fatal('Step description is required.');
        return;
      }

      steps.push(String(step));
    }

    const task: Task = {
      category: String(args.category || 'functional'),
      description: String(description),
      steps,
      passes: false,
    };

    const prdDir = path.join(process.cwd(), BASE_DIR);
    const prdPath = path.join(prdDir, PRD_FILE);

    try {
      if (!(await exists(prdDir))) {
        await mkdir(prdDir);
      }

      let tasks: unknown = [];

      if (await exists(prdPath)) {
        const input = await Bun.file(prdPath).text();

        if (input.trim().length > 0) {
          const parsed = JSON.parse(input);

          if (!Array.isArray(parsed)) {
            logger.fatal('Expected .ody/prd.json to contain an array of tasks.');
            return;
          }

          tasks = parsed;
        }
      }

      const nextTasks = [...(tasks as Task[]), task];

      await Bun.write(prdPath, JSON.stringify(nextTasks, null, 2));

      logger.success('Task added to .ody/prd.json');
    } catch (err) {
      logger.fatal(err);
    }
  },
});

export const taskCmd = defineCommand({
  meta: {
    name: 'task',
    description: 'Task utilities for .ody/prd.json',
  },
  subCommands: {
    new: taskNewCmd,
  },
});
