import { intro, log, outro } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Auth } from '../../lib/auth';
import { Config } from '../../lib/config';

function maskToken(token: string): string {
  if (token.length <= 6) {
    return '******';
  }

  return '******' + token.slice(-6);
}

export const listAuthCmd = defineCommand({
  meta: {
    name: 'list',
    description: 'List configured authentication credentials',
  },
  async run() {
    intro('Authentication credentials');

    const store = await Auth.load();

    let jiraConfig: { baseUrl?: string; profile?: string } | undefined;

    try {
      await Config.load();
      const jira = Config.get('jira');

      if (jira) {
        jiraConfig = jira;
      }
    } catch {
      // Config may not exist; auth is a skippable command
    }

    const activeProfile = jiraConfig?.profile ?? 'default';
    const jiraProfiles = store.jira;

    if (!jiraProfiles || Object.keys(jiraProfiles).length === 0) {
      log.warn('No credentials configured. Run `ody auth jira` to set up authentication.');
      outro('Done');
      return;
    }

    log.info('Jira');

    for (const [profileName, credentials] of Object.entries(jiraProfiles)) {
      const isActive = profileName === activeProfile;
      const activeLabel = isActive ? ' (active)' : '';
      const masked = maskToken(credentials.apiToken);

      let message = `  Profile: ${profileName}${activeLabel}\n`;
      message += `  Email:   ${credentials.email}\n`;
      message += `  Token:   ${masked}`;

      if (isActive && jiraConfig?.baseUrl) {
        message += `\n  BaseURL: ${jiraConfig.baseUrl}`;
      }

      log.message(message);
    }

    outro('Done');
  },
});
