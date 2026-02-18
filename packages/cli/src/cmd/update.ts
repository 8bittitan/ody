import { intro, log, outro, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Installation } from '../lib/installation';

export const updateCmd = defineCommand({
  meta: {
    name: 'update',
    description: 'Check for and install CLI updates from GitHub Releases',
  },
  args: {
    check: {
      type: 'boolean',
      alias: 'c',
      default: false,
      description: 'Only check whether an update is available without downloading',
    },
  },
  async run({ args }) {
    intro('ody update');

    const currentVersion = Installation.currentVersion();
    const s = spinner();

    s.start('Checking for updates');

    let latestVersion: string | undefined = undefined;

    try {
      latestVersion = await Installation.checkLatest();
    } catch (err) {
      s.stop(String(err));
      process.exit(1);
    }

    s.stop('Finished checking for updates');

    if (!Installation.needsUpdate(latestVersion)) {
      log.success(`Already up to date (v${currentVersion})`);
      outro('No update needed');
      return;
    }

    log.info(`New version available: v${currentVersion} → v${latestVersion}`);

    if (args.check) {
      outro(`Run \`ody update\` to install v${latestVersion}`);
      return;
    }

    s.start('Updating...');

    const err = await Installation.update().catch((err) => err);

    if (err) {
      s.stop('Update failed');
      log.error(String(err));
      outro('Done');
    }

    s.stop(`Updated to v${latestVersion}`);
    outro('Update complete');
  },
});
