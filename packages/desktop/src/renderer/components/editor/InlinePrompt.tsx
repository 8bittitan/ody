import { Loader2, Sparkles, TriangleAlert } from 'lucide-react';

type InlinePromptProps = {
  open: boolean;
  instruction: string;
  output: string;
  error: string | null;
  isRunning: boolean;
  selection: { from: number; to: number } | null;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export const InlinePrompt = ({
  open,
  instruction,
  output,
  error,
  isRunning,
  selection,
  onInstructionChange,
  onSubmit,
  onCancel,
}: InlinePromptProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="bg-background/96 border-edge absolute inset-x-4 bottom-4 z-20 rounded-lg border p-3 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-light inline-flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="text-primary size-3.5" />
          AI Inline Edit
        </p>
        <p className="text-dim text-[11px]">
          {selection ? `Selection ${selection.from}-${selection.to}` : 'Whole file'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={instruction}
          disabled={isRunning}
          onChange={(event) => {
            onInstructionChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder="Describe the edit..."
          className="bg-panel border-edge text-light placeholder:text-dim flex-1 rounded-md border px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={onCancel}
          disabled={isRunning}
          className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-xs disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isRunning}
          className="bg-primary text-primary-foreground hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs disabled:opacity-50"
        >
          {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {isRunning ? 'Editing...' : 'Run'}
        </button>
      </div>

      {error ? (
        <p className="text-red mt-2 inline-flex items-center gap-1.5 text-xs">
          <TriangleAlert className="size-3.5" />
          {error}
        </p>
      ) : null}

      {isRunning || output.trim().length > 0 ? (
        <pre className="bg-panel border-edge text-mid mt-2 max-h-36 overflow-auto rounded-md border p-2 text-[11px] whitespace-pre-wrap">
          {output.trim().length > 0 ? output : 'Waiting for model output...'}
        </pre>
      ) : null}
    </div>
  );
};
