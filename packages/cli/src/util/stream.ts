import { log } from '@clack/prompts';

export type StreamChunk = {
  chunk: string;
  lines: string[];
  partialLine: string;
};

export type StreamOptions = {
  shouldPrint?: boolean;
  capture?: boolean;
  onChunk?: (data: StreamChunk) => boolean | void;
};

export namespace Stream {
  export async function toOutput(stream: ReadableStream, options: StreamOptions = {}) {
    const { shouldPrint = false, capture = false, onChunk } = options;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const capturedChunks: string[] = [];
    let lineBuffer = '';
    let shouldStop = false;

    const processChunk = (chunk: string) => {
      if (chunk === '') {
        return false;
      }

      const trimmed = chunk.trim();

      if (shouldPrint && trimmed !== '') {
        log.message(trimmed);
      }

      if (capture) {
        capturedChunks.push(chunk);
      }

      if (onChunk) {
        lineBuffer += chunk;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? '';

        if (onChunk({ chunk, lines, partialLine: lineBuffer })) {
          return true;
        }
      }

      return false;
    };

    for await (const chunk of stream) {
      const decodedChunk = decoder.decode(chunk, { stream: true });

      if (processChunk(decodedChunk)) {
        shouldStop = true;
        break;
      }
    }

    if (!shouldStop) {
      processChunk(decoder.decode());
    }

    return capture ? capturedChunks.join('') : '';
  }
}
