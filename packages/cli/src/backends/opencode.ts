import path from 'path';

import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { Harness, type CommandOptions } from './harness';

export class Opencode extends Harness {
  name = 'OpenCode';

  buildCommand(prompt: string, opts: CommandOptions = {}) {
    return [
      'opencode',
      ...(opts.agent ? ['--agent', opts.agent] : []),
      ...(opts.model ? ['-m', opts.model] : []),
      'run',
      `@${path.join(BASE_DIR, TASKS_DIR)} ${prompt}`,
    ];
  }
}
