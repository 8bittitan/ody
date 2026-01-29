export abstract class Harness {
  abstract buildCommand(prompt: string): string[];
  abstract buildOnceCommand(prompt: string): string[];
}
