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

    try {
      config = Config.all();
    } catch {
      log.warn('No configuration found. Run `ody init` to set up your project.');
      return;
    }

    intro('Ody configuration');
    log.message(JSON.stringify(config, null, 2));
  },
});
