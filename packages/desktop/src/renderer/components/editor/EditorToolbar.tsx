import { Save, TerminalSquare, Undo2, WandSparkles } from 'lucide-react';

type EditorToolbarProps = {
  fileName: string | null;
  isDirty: boolean;
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAiEdit: () => void;
  onOpenTerminal: () => void;
  showAiEdit?: boolean;
  showOpenTerminal?: boolean;
};

export const EditorToolbar = ({
  fileName,
  isDirty,
  isSaving,
  canUndo,
  canRedo,
  onBack,
  onSave,
  onUndo,
  onRedo,
  onAiEdit,
  onOpenTerminal,
  showAiEdit = true,
  showOpenTerminal = true,
}: EditorToolbarProps) => {
  return (
    <header className="bg-panel border-edge flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-mid hover:text-light hover:bg-background border-edge rounded-md border px-2.5 py-1.5 text-xs"
        >
          Back
        </button>
        <div className="min-w-0">
          <p className="text-light truncate text-sm font-medium">
            {fileName ?? 'No task selected'}
          </p>
          <p className="text-dim text-xs">{isDirty ? 'Unsaved changes' : 'All changes saved'}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="bg-primary text-primary-foreground hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="text-mid hover:text-light hover:bg-background border-edge inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 className="size-3.5" />
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="text-mid hover:text-light hover:bg-background border-edge rounded-md border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Redo
        </button>
        {showAiEdit ? (
          <button
            type="button"
            onClick={onAiEdit}
            className="text-mid hover:text-light hover:bg-background border-edge inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs"
          >
            <WandSparkles className="size-3.5" />
            AI Edit
          </button>
        ) : null}
        {showOpenTerminal ? (
          <button
            type="button"
            onClick={onOpenTerminal}
            className="text-mid hover:text-light hover:bg-background border-edge inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs"
          >
            <TerminalSquare className="size-3.5" />
            Open in Terminal
          </button>
        ) : null}
      </div>
    </header>
  );
};
