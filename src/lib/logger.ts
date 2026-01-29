import { createConsola } from 'consola';

export const logger = createConsola({
  level: 4,
}).addReporter({
  log(l) {
    if (l.type === 'fatal') {
      process.exit(1);
    }
  },
});
