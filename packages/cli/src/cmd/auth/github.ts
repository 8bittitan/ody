import { intro, isCancel, log, outro, password } from '@clack/prompts';
import { Auth } from '@internal/auth';
import { defineCommand } from 'citty';

export const githubAuthCmd = defineCommand({
  meta: {
    name: 'github',
    description: 'Configure GitHub authentication credentials',
  },
  args: {
    profile: {
      type: 'string',
      default: 'default',
      description: 'Named profile for storing credentials',
    },
  },
  async run({ args }) {
    const profile = args.profile;

    intro(`Configuring GitHub credentials for profile: ${profile}`);

    const token = await password({
      message: 'Enter your GitHub personal access token',
      validate(value) {
        if (!value || value.trim().length === 0) {
          return 'Access token is required';
        }
      },
    });

    if (isCancel(token)) {
      outro('Authentication cancelled.');
      return;
    }

    try {
      await Auth.setGitHub(profile, { token });
    } catch (err) {
      log.error(`Failed to save credentials: ${String(err)}`);
      return;
    }

    log.success(`Credentials saved under profile "${profile}"`);
    outro('GitHub authentication configured successfully.');
  },
});
