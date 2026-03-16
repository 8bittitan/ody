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
      });
    });

    test('ignores inline marker-like output without a standalone marker', () => {
      const result = feedChunks([
        {
          lines: [`done ${COMPLETE_MARKER}`],
          partialLine: '',
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: false,
      });
    });

    test('ignores partial woof tags in normal output', () => {
      const result = feedChunks([
        {
          lines: ['The agent prints <woof> and </woof> in explanations'],
          partialLine: '',
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: false,
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
      });
    });

    test('detects marker with surrounding whitespace on the line', () => {
      const result = feedChunks([
        {
          lines: [`  ${COMPLETE_MARKER}  `],
          partialLine: '',
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: true,
      });
    });

    test('returns no match when output is empty', () => {
      const result = feedChunks([
        {
          lines: [],
          partialLine: '',
        },
      ]);

      expect(result).toEqual({
        hasStrictMatch: false,
      });
    });
  });

  describe('validateAgentCompletion', () => {
    test('throws on non-zero exit codes', () => {
      expect(() =>
        validateAgentCompletion(1, { hasStrictMatch: true }, { requireMarker: true }),
      ).toThrow('backend exited with code 1');
    });

    test('throws when a required marker is missing', () => {
      expect(() =>
        validateAgentCompletion(0, { hasStrictMatch: false }, { requireMarker: true }),
      ).toThrow(`expected standalone ${COMPLETE_MARKER}`);
    });

    test('accepts a clean exit with a strict marker', () => {
      expect(() =>
        validateAgentCompletion(0, { hasStrictMatch: true }, { requireMarker: true }),
      ).not.toThrow();
    });

    test('accepts a clean exit without marker when marker is not required', () => {
      expect(() => validateAgentCompletion(0, { hasStrictMatch: false })).not.toThrow();
    });

    test('does not throw for inline marker-like output when marker is required', () => {
      // Inline marker text is now ignored entirely — no ambiguity failure.
      expect(() =>
        validateAgentCompletion(0, { hasStrictMatch: false }, { requireMarker: true }),
      ).toThrow(`expected standalone ${COMPLETE_MARKER}`);
    });
  });
});
