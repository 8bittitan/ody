import { Config, type OdyConfig } from '../lib/config';
import { Claude } from './claude';
import { Codex } from './codex';
import type { Harness } from './harness';
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

  buildCommand(prompt: string, model?: string) {
    const fallbackModel = typeof this.config.model === 'string' ? this.config.model : undefined;

    return this.harness.buildCommand(prompt, {
      model: model ?? fallbackModel,
      agent: this.config.agent ?? 'build',
    });
  }

  buildInteractiveCommand(prompt: string, model?: string) {
    return this.harness.buildInteractiveCommand(prompt, {
      model,
      agent: this.config.agent ?? 'build',
    });
  }
}
