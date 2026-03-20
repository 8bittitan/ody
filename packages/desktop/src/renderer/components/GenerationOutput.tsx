import { AnsiLogViewer } from './AnsiLogViewer';

type GenerationOutputProps = {
  outputHtmlChunks: string[];
  isGenerating: boolean;
  onOpenTaskBoard: () => void;
};

export const GenerationOutput = ({
  outputHtmlChunks,
  isGenerating,
  onOpenTaskBoard,
}: GenerationOutputProps) => {
  return (
    <AnsiLogViewer
      title="Generation output"
      htmlChunks={outputHtmlChunks}
      error={null}
      isRunning={isGenerating}
      emptyTitle="No output yet"
      emptyDescription="Start generation to stream output here."
      loadingLabel="Waiting for agent output"
      actionLabel="Open Task Board"
      onAction={onOpenTaskBoard}
      className="bg-panel/92 border-edge flex h-full flex-col rounded-lg border p-4 backdrop-blur-sm"
      bodyClassName="min-h-0 flex-1 overflow-auto"
      preClassName="bg-background border-edge min-h-full rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200"
    />
  );
};
