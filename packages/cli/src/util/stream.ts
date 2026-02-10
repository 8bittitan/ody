import { log } from '@clack/prompts';

export type StreamOptions = {
  shouldPrint?: boolean;
  onChunk?: (accumulated: string) => boolean | void;
};

export namespace Stream {
  export async function toOutput(stream: ReadableStream, options: StreamOptions = {}) {
    const { shouldPrint = false, onChunk } = options;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let output = '';

    for await (const chunk of stream) {
      const raw = decoder.decode(chunk, { stream: true });
      const trimmed = raw.trim();

      if (shouldPrint && trimmed !== '') {
        log.message(trimmed);
      }

      output += raw;

      if (onChunk) {
        const shouldStop = onChunk(output);

        if (shouldStop) {
          break;
        }
      }
    }

    return output;
  }
}
