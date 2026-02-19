import { log } from '@clack/prompts';
import { describe, expect, mock, spyOn, test } from 'bun:test';

import { Stream } from '../stream';

function createStream(chunks: Array<string | Uint8Array>) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        if (typeof chunk === 'string') {
          controller.enqueue(new TextEncoder().encode(chunk));
          continue;
        }

        controller.enqueue(chunk);
      }

      controller.close();
    },
  });
}

describe('Stream', () => {
  describe('toOutput', () => {
    test('returns empty string by default when capture mode is disabled', async () => {
      const stream = createStream(['hello ', 'world']);

      const result = await Stream.toOutput(stream);
      expect(result).toBe('');
    });

    test('captures full output when capture mode is enabled', async () => {
      const stream = createStream(['hello ', 'world']);

      const result = await Stream.toOutput(stream, { capture: true });
      expect(result).toBe('hello world');
    });

    test('calls log.message for each non-empty chunk when shouldPrint is true', async () => {
      const logSpy = spyOn(log, 'message');
      const stream = createStream(['chunk1', 'chunk2', 'chunk3']);

      await Stream.toOutput(stream, { shouldPrint: true });

      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy).toHaveBeenCalledWith('chunk1');
      expect(logSpy).toHaveBeenCalledWith('chunk2');
      expect(logSpy).toHaveBeenCalledWith('chunk3');

      logSpy.mockRestore();
    });

    test('does not call log.message for empty chunks', async () => {
      const logSpy = spyOn(log, 'message');
      const stream = createStream(['', '  ', 'valid']);

      await Stream.toOutput(stream, { shouldPrint: true });

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('valid');

      logSpy.mockRestore();
    });

    test('onChunk callback receives incremental chunk and line data', async () => {
      const onChunkCalls: Array<{ chunk: string; lines: string[]; partialLine: string }> = [];
      const onChunk = mock((data: { chunk: string; lines: string[]; partialLine: string }) => {
        onChunkCalls.push(data);
      });
      const stream = createStream(['a\nb', 'c\n', 'd']);

      await Stream.toOutput(stream, { onChunk, capture: true });

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunkCalls).toEqual([
        { chunk: 'a\nb', lines: ['a'], partialLine: 'b' },
        { chunk: 'c\n', lines: ['bc'], partialLine: '' },
        { chunk: 'd', lines: [], partialLine: 'd' },
      ]);
    });

    test('stops consuming stream when onChunk returns true', async () => {
      const onChunk = mock((data: { chunk: string }) => {
        return data.chunk === 'b';
      });
      const stream = createStream(['a', 'b', 'c']);

      const result = await Stream.toOutput(stream, { onChunk, capture: true });

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(result).toBe('ab');
    });

    test('preserves UTF-8 decoding and line fragments across chunk boundaries', async () => {
      const encoded = new TextEncoder().encode('A🙂\nB');
      const first = encoded.slice(0, 3);
      const second = encoded.slice(3, 6);
      const third = encoded.slice(6);

      const chunks: string[] = [];
      const linesByChunk: string[][] = [];
      const partials: string[] = [];
      const onChunk = mock((data: { chunk: string; lines: string[]; partialLine: string }) => {
        chunks.push(data.chunk);
        linesByChunk.push(data.lines);
        partials.push(data.partialLine);
      });

      const stream = createStream([first, second, third]);
      const result = await Stream.toOutput(stream, { onChunk, capture: true });

      expect(result).toBe('A🙂\nB');
      expect(chunks).toEqual(['A', '🙂\n', 'B']);
      expect(linesByChunk).toEqual([[], ['A🙂'], []]);
      expect(partials).toEqual(['A', '', 'B']);
    });

    test('returns empty string for empty stream when capture mode is enabled', async () => {
      const stream = createStream([]);

      const result = await Stream.toOutput(stream, { capture: true });
      expect(result).toBe('');
    });
  });
});
