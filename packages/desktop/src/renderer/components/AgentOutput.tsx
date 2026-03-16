import { toAnsiHtml } from '@/lib/ansi';
import { TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

type AgentOutputProps = {
  output: string;
  error: string | null;
  isRunning?: boolean;
  onClear: () => void;
};

export const AgentOutput = ({ output, error, isRunning = false, onClear }: AgentOutputProps) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outputHtml = useMemo(() => toAnsiHtml(output), [output]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    setAutoScroll(distance <= 24);
  };

  useEffect(() => {
    if (!autoScroll || !containerRef.current) {
      return;
    }

    const target = containerRef.current;
    target.scrollTop = target.scrollHeight;
  }, [autoScroll, outputHtml]);

  return (
    <section className="bg-panel/90 border-edge flex min-h-0 flex-1 flex-col rounded-lg border">
      <header className="border-edge flex items-center justify-between border-b px-3 py-2">
        <span className="text-mid text-xs font-medium">Log View</span>

        <button
          type="button"
          className="text-mid border-edge hover:text-light rounded border px-2 py-1 text-xs"
          onClick={onClear}
        >
          Clear
        </button>
      </header>

      {error ? (
        <div className="text-red bg-red-bg border-red/35 border-b px-3 py-2 text-xs">{error}</div>
      ) : null}

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto p-3" onScroll={handleScroll}>
        {outputHtml.length > 0 ? (
          <pre
            className="text-light font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: outputHtml }}
          />
        ) : isRunning ? (
          <LoadingSpinner size="md" label="Waiting for first output" />
        ) : (
          <EmptyState
            icon={<TerminalSquare className="size-4" />}
            title="No agent output"
            description="No agent output. Start a run to see output here."
          />
        )}
      </div>
    </section>
  );
};
