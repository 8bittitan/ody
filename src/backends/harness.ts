export type CommandOptions = {
  model?: string;
  agent?: string;
};

export abstract class Harness {
  abstract buildCommand(prompt: string, opts?: CommandOptions): string[];
  abstract buildOnceCommand(prompt: string, opts?: CommandOptions): string[];
}
