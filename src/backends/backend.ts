import type { Harness } from './harness';

import { Config, type OdyConfig } from '../lib/config';
import { Claude } from './claude';
import { Codex } from './codex';
import { Opencode } from './opencode';

export class Backend {
  name: string;
  private harness: Harness;
  private config: OdyConfig;

  constructor(selectedBackend: string) {
    if (selectedBackend === 'claude') {
      this.harness = new Claude();
    } else if (selectedBackend === 'codex') {
      this.harness = new Codex();
    } else {
      this.harness = new Opencode();
    }

    this.name = selectedBackend;
    this.config = Config.all();
  }

  buildCommand(prompt: string) {
    return this.harness.buildCommand(prompt, {
      model: this.config.model,
    });
  }

  buildOnceCommand(prompt: string) {
    return this.harness.buildOnceCommand(prompt, {
      model: this.config.model,
    });
  }
}
