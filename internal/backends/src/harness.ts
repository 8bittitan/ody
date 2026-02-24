export type CommandOptions = {
  model?: string;
  agent?: string;
  skipPermissions?: boolean;
};

export abstract class Harness {
  abstract buildCommand(prompt: string, opts?: CommandOptions): string[];

  buildInteractiveCommand(prompt: string, opts?: CommandOptions): string[] {
    return this.buildCommand(prompt, opts);
  }
}
