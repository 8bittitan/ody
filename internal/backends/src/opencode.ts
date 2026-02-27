import { Harness, type CommandOptions } from './harness';

export class Opencode extends Harness {
  name = 'OpenCode';

  buildCommand(prompt: string, opts: CommandOptions = {}) {
    return [
      'opencode',
      ...(opts.agent ? ['--agent', opts.agent] : []),
      ...(opts.model ? ['-m', opts.model] : []),
      'run',
      prompt,
    ];
  }

  override buildInteractiveCommand(prompt: string, opts: CommandOptions = {}) {
    return [
      'opencode',
      ...(opts.agent ? ['--agent', opts.agent] : []),
      ...(opts.model ? ['-m', opts.model] : []),
      '--prompt',
      prompt,
    ];
  }
}
