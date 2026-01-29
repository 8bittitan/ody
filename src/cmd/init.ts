import { defineCommand } from 'citty';
import { exists, mkdir } from 'fs/promises';
import path from 'path';

import { getAvailableBackends } from '../backends/util';
import { Config } from '../lib/config';
import { logger } from '../lib/logger';
import { BASE_DIR, ODY_FILE } from '../util/constants';

export const initCmd = defineCommand({
  meta: {
    name: 'init',
    description: 'Initializes and sets up Ody for the current project',
  },
  args: {
    backend: {
      alias: 'b',
      required: false,
      description: 'Agent harness to use (claude, opencode, codex)',
      type: 'string',
    },
    dir: {
      alias: 'd',
      required: false,
      default: BASE_DIR,
      description: 'Directory to store Ody configuration and files',
      type: 'string',
    },
    maxIterations: {
      alias: 'i',
      required: false,
      default: '3',
      description: 'Max number of loops to run (tasks to complete)',
      type: 'string',
    },
    model: {
      alias: 'm',
      required: false,
      description: 'Model name to use for the selected provider',
      type: 'string',
    },
    provider: {
      alias: 'p',
      required: false,
      description: 'Provider name to use for API requests',
      type: 'string',
    },
    shouldCommit: {
      alias: 'c',
      required: false,
      default: false,
      description: 'If the agent should create commits after each task completion',
      type: 'boolean',
    },
  },
  async run({ args }) {
    const outDir = path.join(process.cwd(), args.dir);

    logger.start('Initializing Ody in', outDir);

    if (!(await exists(outDir))) {
      await mkdir(outDir);
    }

    let backend = args.backend;

    const availableBackends = getAvailableBackends();

    const isBackendAvailable = backend && availableBackends.find((b) => b.value === backend);

    if (!isBackendAvailable) {
      if (backend) {
        logger.warn('Selected backend is not available on your system:', backend);
      }

      const choice = await logger.prompt('Please select which backend to use: ', {
        required: true,
        options: availableBackends,
        cancel: 'null',
        type: 'select',
      });

      if (!choice) {
        logger.fatal('Must provide a backend to use.');
        process.exit(1);
      }

      backend = choice;
      logger.log('');
    }

    if (!backend) {
      logger.fatal('Must provide a backend to use.');
      process.exit(1);
    }

    const configInput: {
      backend: string;
      maxIterations: number;
      shouldCommit: boolean;
      provider?: string;
      model?: string;
    } = {
      backend,
      maxIterations: parseInt(args.maxIterations, 10),
      shouldCommit: args.shouldCommit,
    };

    if (args.provider) {
      configInput.provider = args.provider;
    }

    if (args.model) {
      configInput.model = args.model;
    }

    const configToSave = JSON.stringify(Config.parse(configInput), null, 2);

    await Bun.write(path.join(outDir, ODY_FILE), configToSave);

    logger.success('Initialized');
  },
});
