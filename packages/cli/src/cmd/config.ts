import { intro, log, outro } from '@clack/prompts';
import { Config } from '@internal/config';
import { defineCommand } from 'citty';

export const configCmd = defineCommand({
  meta: {
    name: 'config',
    description: 'Display the current Ody configuration',
  },
  async run() {
    const config = Config.all();

    intro('Ody configuration');
    log.message(JSON.stringify(config, null, 2));
    outro();
  },
});
