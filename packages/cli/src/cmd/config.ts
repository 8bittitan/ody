import { intro, log } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Config } from '../lib/config';

export const configCmd = defineCommand({
  meta: {
    name: 'config',
    description: 'Display the current Ody configuration',
  },
  async run() {
    let config;

    config = Config.all();

    intro('Ody configuration');
    log.message(JSON.stringify(config, null, 2));
  },
});
