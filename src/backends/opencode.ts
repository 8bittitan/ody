import path from 'path';

import { BASE_DIR, PRD_FILE } from '../util/constants';
import { Harness } from './harness';

export class Opencode extends Harness {
  name = 'OpenCode';

  buildCommand(prompt: string) {
    return [
      'opencode',
      '--agent',
      'build',
      '-m',
      'openai/gpt-5.2-codex',
      '-f',
      path.join(BASE_DIR, PRD_FILE),
      'run',
      prompt,
    ];
  }

  override buildOnceCommand(prompt: string): string[] {
    return [
      'opencode',
      '--agent',
      'build',
      '-m',
      'openai/gpt-5.2-codex',
      '--prompt',
      `@${path.join(BASE_DIR, PRD_FILE)} ${prompt}`,
    ];
  }
}
