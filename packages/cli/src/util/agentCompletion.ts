import type { StreamChunk } from './stream';

export const COMPLETE_MARKER = '<woof>COMPLETE</woof>';

export type MarkerDetectionResult = {
  hasStrictMatch: boolean;
};

export function createCompletionMarkerDetector() {
  let partialLine = '';
  let hasStrictMatch = false;

  const inspectLine = (line: string) => {
    const trimmedLine = line.trim();

    if (trimmedLine === COMPLETE_MARKER) {
      hasStrictMatch = true;
    }
  };

  return {
    onChunk(data: StreamChunk) {
      for (const line of data.lines) {
        inspectLine(line);
      }

      partialLine = data.partialLine;
    },
    finalize(): MarkerDetectionResult {
      inspectLine(partialLine);

      return {
        hasStrictMatch,
      };
    },
  };
}

type ValidateCompletionOptions = {
  requireMarker?: boolean;
};

export function validateAgentCompletion(
  exitCode: number,
  markerDetection: MarkerDetectionResult,
  options: ValidateCompletionOptions = {},
) {
  const { requireMarker = false } = options;

  if (exitCode !== 0) {
    throw new Error(`Process exit failure: backend exited with code ${exitCode}`);
  }

  if (requireMarker && !markerDetection.hasStrictMatch) {
    throw new Error(`Completion marker missing: expected standalone ${COMPLETE_MARKER}`);
  }
}
