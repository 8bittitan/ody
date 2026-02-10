import path from 'path';

import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { Harness } from './harness';

export class Claude extends Harness {
  name = 'Claude Code';

  override buildCommand(prompt: string): string[] {
    const skipPermissions = Config.get('skipPermissions') ?? true;

    const cmd = ['claude'];

    if (skipPermissions) {
      cmd.push('--dangerously-skip-permissions');
    }

    cmd.push(
      '--verbose',
      '--output-format',
      'stream-json',
      '-p',
      `@${path.join(BASE_DIR, TASKS_DIR)} ${prompt}`,
    );

    return cmd;
  }

  override buildOnceCommand(prompt: string): string[] {
    return [
      'claude',
      '--permission-mode',
      'acceptEdits',
      `@${path.join(BASE_DIR, TASKS_DIR)} ${prompt}`,
    ];
  }
}
