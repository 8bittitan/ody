import type { Harness } from './harness';

import { Claude } from './claude';
import { Codex } from './codex';
import { Opencode } from './opencode';

export class Backend {
  name: string;
  private harness: Harness;

  constructor(selectedBackend: string) {
    if (selectedBackend === 'claude') {
      this.harness = new Claude();
    } else if (selectedBackend === 'codex') {
      this.harness = new Codex();
    } else {
      this.harness = new Opencode();
    }

    this.name = selectedBackend;
  }

  buildCommand(prompt: string) {
    return this.harness.buildCommand(prompt);
  }

  buildOnceCommand(prompt: string) {
    return this.harness.buildOnceCommand(prompt);
  }
}
