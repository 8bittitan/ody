import { defineCommand } from 'citty';

export const authCmd = defineCommand({
  meta: {
    name: 'auth',
    description: 'Manage authentication credentials',
  },
  subCommands: {
    jira: () => import('./jira').then((m) => m.jiraAuthCmd),
  },
});
