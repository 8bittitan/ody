import { intro, log, outro } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Config } from '../lib/config';

export const configCmd = defineCommand({
  meta: {
    name: 'config',
    description: 'Display the current Ody configuration',
  },
  async run() {
    intro('Ody Configuration');

    let config;

    try {
      config = Config.all();
    } catch {
      log.warn('No configuration found. Run `ody init` to set up your project.');
      outro('Done');
      return;
    }

    log.info(JSON.stringify(config, null, 2));

    outro('Done');
  },
});
