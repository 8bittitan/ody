import { defineCommand } from 'citty';

export const planCmd = defineCommand({
  meta: {
    name: 'plan',
    description: 'Plan upcoming work',
  },
  args: {
    ['dry-run']: {
      default: false,
      description: 'Run as dry run, without sending prompt to agent',
      type: 'boolean',
      alias: 'd',
    },
    verbose: {
      default: false,
      description: "Enable verbose logging, streaming the agent's work in progress",
      type: 'boolean',
    },
  },
  subCommands: {
    compact: () => import('./compact').then((m) => m.compactCmd),
    new: () => import('./new').then((m) => m.newCmd),
    edit: () => import('./edit').then((m) => m.editCmd),
    list: () => import('./list').then((m) => m.listCmd),
  },
});
