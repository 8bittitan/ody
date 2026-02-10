import path from 'path';

import { BASE_DIR, PRD_FILE } from '../util/constants';
import { Harness, type CommandOptions } from './harness';

export class Opencode extends Harness {
  name = 'OpenCode';

  buildCommand(prompt: string, opts: CommandOptions = {}) {
    return [
      'opencode',
      ...(opts.agent ? ['--agent', opts.agent] : []),
      ...(opts.model ? ['-m', opts.model] : []),
      'run',
      `@${path.join(BASE_DIR, PRD_FILE)} ${prompt}`,
    ];
  }

  override buildOnceCommand(prompt: string, opts: CommandOptions = {}): string[] {
    return [
      'opencode',
      ...(opts.agent ? ['--agent', opts.agent] : []),
      ...(opts.model ? ['-m', opts.model] : []),
      '--prompt',
      `@${path.join(BASE_DIR, PRD_FILE)} ${prompt}`,
    ];
  }
}
