import { intro, isCancel, log, outro, password, text } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Auth } from '../../lib/auth';

export const jiraAuthCmd = defineCommand({
  meta: {
    name: 'jira',
    description: 'Configure JIRA authentication credentials',
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

    intro(`Configuring JIRA credentials for profile: ${profile}`);

    const email = await text({
      message: 'Enter your JIRA email address',
      validate(value) {
        if (!value || value.trim().length === 0) {
          return 'Email address is required';
        }
      },
    });

    if (isCancel(email)) {
      outro('Authentication cancelled.');
      return;
    }

    const apiToken = await password({
      message: 'Enter your JIRA API token',
      validate(value) {
        if (!value || value.trim().length === 0) {
          return 'API token is required';
        }
      },
    });

    if (isCancel(apiToken)) {
      outro('Authentication cancelled.');
      return;
    }

    try {
      await Auth.setJira(profile, { email, apiToken });
    } catch (err) {
      log.error(`Failed to save credentials: ${String(err)}`);
      return;
    }

    log.success(`Credentials saved under profile "${profile}"`);
    outro('JIRA authentication configured successfully.');
  },
});
