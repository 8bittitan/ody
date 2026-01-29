import path from 'path';

import { BASE_DIR, PRD_FILE } from '../util/constants';
import { Harness } from './harness';

export class Claude extends Harness {
  name = 'Claude Code';

  override buildCommand(prompt: string): string[] {
    return [
      'claude',
      '--dangerously-skip-permissions',
      '--verbose',
      '--output-format',
      'stream-json',
      '-p',
      `@${path.join(BASE_DIR, PRD_FILE)} ${prompt}`,
    ];
  }

  override buildOnceCommand(prompt: string): string[] {
    return [
      'claude',
      '--permission-mode',
      'acceptEdits',
      `@${path.join(BASE_DIR, PRD_FILE)} ${prompt}`,
    ];
  }
}
