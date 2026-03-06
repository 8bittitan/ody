import type { StreamChunk } from './stream';

export const COMPLETE_MARKER = '<woof>COMPLETE</woof>';

export type MarkerDetectionResult = {
  hasStrictMatch: boolean;
  hasAmbiguousMention: boolean;
};

export function createCompletionMarkerDetector() {
  let partialLine = '';
  let hasStrictMatch = false;
  let hasAmbiguousMention = false;

  const inspectLine = (line: string) => {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      return;
    }

    if (trimmedLine === COMPLETE_MARKER) {
      hasStrictMatch = true;
      return;
    }

    if (line.includes(COMPLETE_MARKER) || line.includes('<woof>') || line.includes('</woof>')) {
      hasAmbiguousMention = true;
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
        hasAmbiguousMention: hasAmbiguousMention && !hasStrictMatch,
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

  if (markerDetection.hasAmbiguousMention) {
    throw new Error(
      `Marker ambiguity: found marker-like output without standalone ${COMPLETE_MARKER}`,
    );
  }

  if (requireMarker && !markerDetection.hasStrictMatch) {
    throw new Error(`Completion marker missing: expected standalone ${COMPLETE_MARKER}`);
  }
}
