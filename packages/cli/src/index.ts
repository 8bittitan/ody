import { defineCommand, runMain } from 'citty';

import { configCmd } from './cmd/config';
import { initCmd } from './cmd/init';
import { planCmd } from './cmd/plan';
import { runCmd } from './cmd/run';
import { Config } from './lib/config';

const ody = defineCommand({
  meta: {
    name: 'Ody',
    description: 'Agentic orchestrator',
  },
  async setup() {
    await Config.load();
  },
  subCommands: {
    config: configCmd,
    init: initCmd,
    plan: planCmd,
    run: runCmd,
  },
});

runMain(ody);
