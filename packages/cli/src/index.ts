import { defineCommand, runMain } from 'citty';

import pkg from '../package.json';
import { Config } from './lib/config';

const ody = defineCommand({
  meta: {
    name: 'Ody',
    description: 'Agentic orchestrator',
    version: pkg.version,
  },
  async setup() {
    await Config.load();
  },
  subCommands: {
    config: () => import('./cmd/config').then((m) => m.configCmd),
    init: () => import('./cmd/init').then((m) => m.initCmd),
    plan: () => import('./cmd/plan').then((m) => m.planCmd),
    run: () => import('./cmd/run').then((m) => m.runCmd),
  },
});

runMain(ody);
