import { defineCommand } from 'citty';

export const taskCmd = defineCommand({
  meta: {
    name: 'task',
    description: 'Manage Ody tasks',
  },
  subCommands: {
    compact: () => import('./compact').then((m) => m.compactCmd),
    edit: () => import('./edit').then((m) => m.editCmd),
    list: () => import('./list').then((m) => m.listCmd),
  },
});
