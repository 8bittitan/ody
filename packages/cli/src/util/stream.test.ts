import { log } from '@clack/prompts';
import { describe, expect, mock, spyOn, test } from 'bun:test';

import { Stream } from './stream';

describe('Stream', () => {
  describe('toOutput', () => {
    test('accumulates output from stream chunks', async () => {
      const chunks = ['hello ', 'world'];
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });

      const result = await Stream.toOutput(stream);
      expect(result).toBe('hello world');
    });

    test('calls log.message for each non-empty chunk when shouldPrint is true', async () => {
      const logSpy = spyOn(log, 'message');

      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });

      await Stream.toOutput(stream, { shouldPrint: true });

      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy).toHaveBeenCalledWith('chunk1');
      expect(logSpy).toHaveBeenCalledWith('chunk2');
      expect(logSpy).toHaveBeenCalledWith('chunk3');

      logSpy.mockRestore();
    });

    test('does not call log.message when shouldPrint is false', async () => {
      const logSpy = spyOn(log, 'message');

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('test'));
          controller.close();
        },
      });

      await Stream.toOutput(stream, { shouldPrint: false });

      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    test('does not call log.message for empty chunks', async () => {
      const logSpy = spyOn(log, 'message');

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(''));
          controller.enqueue(new TextEncoder().encode('  '));
          controller.enqueue(new TextEncoder().encode('valid'));
          controller.close();
        },
      });

      await Stream.toOutput(stream, { shouldPrint: true });

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('valid');

      logSpy.mockRestore();
    });

    test('onChunk callback receives accumulated string after each chunk', async () => {
      const onChunkCalls: string[] = [];
      const onChunk = mock((accumulated: string) => {
        onChunkCalls.push(accumulated);
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('a'));
          controller.enqueue(new TextEncoder().encode('b'));
          controller.enqueue(new TextEncoder().encode('c'));
          controller.close();
        },
      });

      await Stream.toOutput(stream, { onChunk });

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunkCalls).toEqual(['a', 'ab', 'abc']);
    });

    test('stops consuming stream when onChunk returns true', async () => {
      const onChunk = mock((accumulated: string) => {
        return accumulated === 'ab';
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('a'));
          controller.enqueue(new TextEncoder().encode('b'));
          controller.enqueue(new TextEncoder().encode('c'));
          controller.close();
        },
      });

      const result = await Stream.toOutput(stream, { onChunk });

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(result).toBe('ab');
    });

    test('returns empty string for empty stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const result = await Stream.toOutput(stream);
      expect(result).toBe('');
    });

    test('returns empty string when stream has only empty chunks', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(''));
          controller.enqueue(new TextEncoder().encode('  '));
          controller.enqueue(new TextEncoder().encode('\n'));
          controller.close();
        },
      });

      const result = await Stream.toOutput(stream);
      expect(result).toBe('  \n');
    });
  });
});
