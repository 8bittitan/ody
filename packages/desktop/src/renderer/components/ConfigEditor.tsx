import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConfig } from '@/hooks/useConfig';
import { useConfigEditor } from '@/hooks/useConfigEditor';
import { useNotifications } from '@/hooks/useNotifications';
import { useStore } from '@/store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EditorToolbar } from './editor/EditorToolbar';
import { MarkdownEditor, type MarkdownEditorHandle } from './editor/MarkdownEditor';

type ConfigEditorProps = {
  onBack: () => void;
};

export const ConfigEditor = ({ onBack }: ConfigEditorProps) => {
  const configEditorPath = useStore((state) => state.configEditorPath);
  const { loadConfig } = useConfig();
  const { success, error, warning } = useNotifications();
  const { fileName, content, isDirty, isLoading, isSaving, setContent, save } =
    useConfigEditor(configEditorPath);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const leaveEditor = useCallback(() => {
    void loadConfig();
    onBack();
  }, [loadConfig, onBack]);

  const saveChanges = useCallback(async () => {
    const result = await save();

    if (result.ok) {
      await loadConfig();
      success({ title: 'Config saved', description: fileName ?? undefined });
      return;
    }

    error({
      title: 'Failed to save config',
      description: result.reason,
    });
  }, [error, fileName, loadConfig, save, success]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveChanges();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [saveChanges]);

  useEffect(() => {
    const onSaveRequest: EventListener = () => {
      void saveChanges();
    };

    window.addEventListener('ody:save-editor', onSaveRequest);
    return () => {
      window.removeEventListener('ody:save-editor', onSaveRequest);
    };
  }, [saveChanges]);

  const handleBack = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
      return;
    }

    leaveEditor();
  };

  if (!configEditorPath) {
    return (
      <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
        <h2 className="text-light text-sm font-medium">Config Editor</h2>
        <p className="text-mid mt-2 text-sm">No config file selected from the config view.</p>
        <button
          type="button"
          onClick={onBack}
          className="bg-primary text-primary-foreground hover:bg-accent-hover mt-4 rounded-md px-3 py-2 text-sm"
        >
          Back to config
        </button>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <EditorToolbar
        fileName={fileName}
        isDirty={isDirty}
        isSaving={isSaving}
        canUndo={canUndo}
        canRedo={canRedo}
        onBack={handleBack}
        onSave={() => {
          void saveChanges();
        }}
        onUndo={() => {
          editorRef.current?.undo();
        }}
        onRedo={() => {
          editorRef.current?.redo();
        }}
        onAiEdit={() => {
          warning({ title: 'AI edit is not available for config JSON.' });
        }}
        showAiEdit={false}
      />

      <div className="bg-panel border-edge relative min-h-0 flex-1 rounded-md border p-2">
        {isLoading ? (
          <div className="text-dim flex h-full items-center justify-center text-sm">
            Loading config...
          </div>
        ) : (
          <MarkdownEditor
            ref={editorRef}
            value={content}
            language="json"
            onChange={setContent}
            onHistoryChange={(historyState) => {
              setCanUndo(historyState.canUndo);
              setCanRedo(historyState.canRedo);
            }}
          />
        )}
      </div>

      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="bg-panel border-edge max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits in this config file. Leave now to discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setShowDiscardDialog(false);
              }}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="text-red border-red/35 hover:bg-red-bg rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setShowDiscardDialog(false);
                leaveEditor();
              }}
            >
              Discard changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
