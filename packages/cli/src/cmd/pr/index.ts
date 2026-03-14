import { defineCommand } from 'citty';

export const prCmd = defineCommand({
  meta: {
    name: 'pr',
    description: 'Manage pull requests',
  },
  subCommands: {
    resolve: () => import('./resolve').then((m) => m.resolveCmd),
    review: () => import('./review').then((m) => m.reviewCmd),
  },
});
