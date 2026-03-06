import { intro, log, outro, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Installation } from '../lib/installation';

type UpdateArgs = {
  check: boolean;
};

type UpdateSpinner = {
  start(message: string): void;
  stop(message: string): void;
};

type UpdateDeps = {
  intro: (message: string) => void;
  log: Pick<typeof log, 'error' | 'info' | 'success'>;
  outro: (message: string) => void;
  spinner: () => UpdateSpinner;
  installation: typeof Installation;
  exit: typeof process.exit;
  setExitCode: (code: number) => void;
};

const defaultDeps: UpdateDeps = {
  intro,
  log,
  outro,
  spinner,
  installation: Installation,
  exit: process.exit.bind(process),
  setExitCode(code) {
    process.exitCode = code;
  },
};

export async function runUpdate(args: UpdateArgs, deps: UpdateDeps = defaultDeps) {
  deps.intro('ody update');

  const currentVersion = deps.installation.currentVersion();
  const s = deps.spinner();

  s.start('Checking for updates');

  let latestVersion: string | undefined = undefined;

  try {
    latestVersion = await deps.installation.checkLatest();
  } catch (err) {
    s.stop(String(err));
    deps.exit(1);
    return;
  }

  s.stop('Finished checking for updates');

  if (!deps.installation.needsUpdate(latestVersion)) {
    deps.log.success(`Already up to date (v${currentVersion})`);
    deps.outro('No update needed');
    return;
  }

  deps.log.info(`New version available: v${currentVersion} → v${latestVersion}`);

  if (args.check) {
    deps.outro(`Run \`ody update\` to install v${latestVersion}`);
    return;
  }

  s.start('Updating...');

  try {
    await deps.installation.update();
  } catch (err) {
    s.stop('Update failed');
    deps.log.error(String(err));
    deps.setExitCode(1);
    return;
  }

  s.stop(`Updated to v${latestVersion}`);
  deps.outro('Update complete');
}

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
    await runUpdate(args);
  },
});
