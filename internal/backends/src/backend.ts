import type { OdyConfig } from '@internal/config';

import { Claude } from './claude';
import { Codex } from './codex';
import type { Harness } from './harness';
import { Opencode } from './opencode';

export class Backend {
  name: string;
  private harness: Harness;
  private config: Pick<OdyConfig, 'agent' | 'model' | 'skipPermissions'>;

  constructor(
    selectedBackend: string,
    config: Pick<OdyConfig, 'agent' | 'model' | 'skipPermissions'>,
  ) {
    if (selectedBackend === 'claude') {
      this.harness = new Claude();
    } else if (selectedBackend === 'codex') {
      this.harness = new Codex();
    } else {
      this.harness = new Opencode();
    }

    this.name = selectedBackend;
    this.config = config;
  }

  buildCommand(prompt: string, model?: string) {
    const fallbackModel = typeof this.config.model === 'string' ? this.config.model : undefined;

    return this.harness.buildCommand(prompt, {
      model: model ?? fallbackModel,
      agent: this.config.agent ?? 'build',
      skipPermissions: this.config.skipPermissions ?? true,
    });
  }

  buildInteractiveCommand(prompt: string, model?: string) {
    return this.harness.buildInteractiveCommand(prompt, {
      model,
      agent: this.config.agent ?? 'build',
      skipPermissions: this.config.skipPermissions ?? true,
    });
  }
}
