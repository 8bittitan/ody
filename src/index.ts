import { defineCommand, runMain } from 'citty';

import { initCmd } from './cmd/init';
import { runCmd } from './cmd/run';
import { taskCmd } from './cmd/task';

const ody = defineCommand({
  meta: {
    name: 'Ody',
    description: 'Agentic orchestrator',
  },
  subCommands: {
    init: initCmd,
    run: runCmd,
    task: taskCmd,
  },
});

runMain(ody);
