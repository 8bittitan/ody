import { log } from '@clack/prompts';
import { Config } from '@internal/config';
import { defineCommand, runMain } from 'citty';

import pkg from '../package.json';

const ody = defineCommand({
  meta: {
    name: 'Ody',
    description: 'Agentic orchestrator',
    version: pkg.version,
  },
  async setup(ctx) {
    const cmd = ctx.rawArgs[0];

    if (!cmd) {
      return;
    }

    if (Config.shouldSkipConfig(cmd)) {
      return;
    }

    try {
      await Config.load();
    } catch (err) {
      log.error(String(err));
      process.exit(1);
    }
  },
  subCommands: {
    auth: () => import('./cmd/auth').then((m) => m.authCmd),
    compact: () => import('./cmd/compact').then((m) => m.compactCmd),
    config: () => import('./cmd/config').then((m) => m.configCmd),
    init: () => import('./cmd/init').then((m) => m.initCmd),
    plan: () => import('./cmd/plan').then((m) => m.planCmd),
    run: () => import('./cmd/run').then((m) => m.runCmd),
    task: () => import('./cmd/task').then((m) => m.taskCmd),
    update: () => import('./cmd/update').then((m) => m.updateCmd),
  },
});

try {
  await runMain(ody);
} catch (err) {
  log.error(String(err));
} finally {
  process.exit();
}
