import path from 'path';

import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { Harness } from './harness';

export class Codex extends Harness {
  name = 'Codex';
  shouldCommit = Config.get('shouldCommit');

  override buildCommand(prompt: string): string[] {
    return [
      'codex',
      'exec',
      '--full-auto',
      ...(this.shouldCommit ? [] : ['--skip-git-repo-check']),
      `@${path.join(BASE_DIR, TASKS_DIR)} ${prompt}`,
    ];
  }
}
