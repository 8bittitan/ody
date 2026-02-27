import { Harness, type CommandOptions } from './harness';

export class Codex extends Harness {
  name = 'Codex';

  override buildCommand(prompt: string, opts: CommandOptions = {}): string[] {
    return ['codex', 'exec', '--yolo', ...(opts.model ? ['-m', opts.model] : []), prompt];
  }

  override buildInteractiveCommand(prompt: string, opts: CommandOptions = {}): string[] {
    return ['codex', ...(opts.model ? ['-m', opts.model] : []), prompt];
  }
}
