import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area';
import { toAnsiHtml } from '@/lib/ansi';
import { useMemo } from 'react';

type GenerationOutputProps = {
  streamOutput: string;
  isGenerating: boolean;
  onOpenTaskBoard: () => void;
};

export const GenerationOutput = ({
  streamOutput,
  isGenerating,
  onOpenTaskBoard,
}: GenerationOutputProps) => {
  const streamOutputHtml = useMemo(() => toAnsiHtml(streamOutput), [streamOutput]);

  return (
    <section className="bg-panel/92 border-edge flex h-full flex-col rounded-lg border p-4 backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-dim text-xs">Generation output</p>
        <button
          type="button"
          className="text-mid hover:text-light text-xs"
          onClick={onOpenTaskBoard}
        >
          Open Task Board
        </button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <ScrollAreaContent>
            {streamOutput.trim().length > 0 ? (
              <pre
                className="bg-background border-edge min-h-full rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200"
                dangerouslySetInnerHTML={{ __html: streamOutputHtml }}
              />
            ) : (
              <pre className="bg-background border-edge min-h-full rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
                {isGenerating ? 'Waiting for agent output...' : 'No output yet.'}
              </pre>
            )}
          </ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
      </ScrollArea>
    </section>
  );
};
