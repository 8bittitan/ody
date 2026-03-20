import { AnsiLogViewer } from './AnsiLogViewer';

type AgentOutputProps = {
  outputHtmlChunks: string[];
  error: string | null;
  isRunning?: boolean;
  onClear: () => void;
};

export const AgentOutput = ({
  outputHtmlChunks,
  error,
  isRunning = false,
  onClear,
}: AgentOutputProps) => {
  return (
    <AnsiLogViewer
      title="Log View"
      htmlChunks={outputHtmlChunks}
      error={error}
      isRunning={isRunning}
      onClear={onClear}
      emptyTitle="No agent output"
      emptyDescription="No agent output. Start a run to see output here."
      loadingLabel="Waiting for first output"
      className="bg-panel/90 border-edge flex min-h-0 flex-1 flex-col rounded-lg border"
      bodyClassName="min-h-0 flex-1 overflow-auto p-3"
      preClassName="text-light font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
    />
  );
};
