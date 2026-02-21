import { Config } from '../lib/config';
import { Harness, type CommandOptions } from './harness';

export class Claude extends Harness {
  name = 'Claude Code';

  override buildCommand(prompt: string, opts: CommandOptions = {}): string[] {
    const skipPermissions = Config.get('skipPermissions') ?? true;

    return [
      'claude',
      ...(skipPermissions ? ['--dangerously-skip-permissions'] : []),
      '--disallowedTools=TodoWrite,TaskCreate,TaskUpdate,TaskList,TaskGet',
      ...(opts.model ? ['--model', opts.model] : []),
      '--verbose',
      '--output-format',
      'stream-json',
      '-p',
      prompt,
    ];
  }

  override buildInteractiveCommand(prompt: string, opts: CommandOptions = {}): string[] {
    const skipPermissions = Config.get('skipPermissions') ?? true;

    return [
      'claude',
      ...(skipPermissions ? ['--dangerously-skip-permissions'] : []),
      '--disallowedTools=TodoWrite,TaskCreate,TaskUpdate,TaskList,TaskGet',
      ...(opts.model ? ['--model', opts.model] : []),
      prompt,
    ];
  }
}
