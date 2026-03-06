import { describe, expect, test } from 'bun:test';

import {
  COMPLETE_MARKER,
  createCompletionMarkerDetector,
  validateAgentCompletion,
} from '../agentCompletion';

function feedChunks(chunks: Array<{ lines: string[]; partialLine: string }>) {
  const detector = createCompletionMarkerDetector();

  for (const chunk of chunks) {
    detector.onChunk({
      chunk: '',
      lines: chunk.lines,
      partialLine: chunk.partialLine,
    });
  }

  return detector.finalize();
}

describe('agentCompletion', () => {
  describe('createCompletionMarkerDetector', () => {
    test('detects a standalone completion marker', () => {
      const result = feedChunks([
        {
          lines: ['working'],
          partialLine: COMPLETE_MARKER,
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: true,
        hasAmbiguousMention: false,
      });
    });

    test('detects ambiguous marker-like output without a standalone marker', () => {
      const result = feedChunks([
        {
          lines: [`done ${COMPLETE_MARKER}`],
          partialLine: '',
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: false,
        hasAmbiguousMention: true,
      });
    });

    test('handles marker split across chunk boundaries', () => {
      const result = feedChunks([
        {
          lines: [],
          partialLine: '<woof>COMP',
        },
        {
          lines: [],
          partialLine: COMPLETE_MARKER,
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: true,
        hasAmbiguousMention: false,
      });
    });
  });

  describe('validateAgentCompletion', () => {
    test('throws on non-zero exit codes', () => {
      expect(() =>
        validateAgentCompletion(
          1,
          {
            hasStrictMatch: true,
            hasAmbiguousMention: false,
          },
          { requireMarker: true },
        ),
      ).toThrow('backend exited with code 1');
    });

    test('throws when a required marker is missing', () => {
      expect(() =>
        validateAgentCompletion(
          0,
          {
            hasStrictMatch: false,
            hasAmbiguousMention: false,
          },
          { requireMarker: true },
        ),
      ).toThrow(`expected standalone ${COMPLETE_MARKER}`);
    });

    test('throws on ambiguous marker output', () => {
      expect(() =>
        validateAgentCompletion(
          0,
          {
            hasStrictMatch: false,
            hasAmbiguousMention: true,
          },
          { requireMarker: true },
        ),
      ).toThrow('Marker ambiguity');
    });

    test('accepts a clean exit with a strict marker', () => {
      expect(() =>
        validateAgentCompletion(
          0,
          {
            hasStrictMatch: true,
            hasAmbiguousMention: false,
          },
          { requireMarker: true },
        ),
      ).not.toThrow();
    });
  });
});
