import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAgent } from '@/hooks/useAgent';
import { useEditor } from '@/hooks/useEditor';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useStore } from '@/store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DiffView } from './editor/DiffView';
import { EditorToolbar } from './editor/EditorToolbar';
import { InlinePrompt } from './editor/InlinePrompt';
import { MarkdownEditor, type MarkdownEditorHandle } from './editor/MarkdownEditor';

type TaskEditorProps = {
  onBack: () => void;
};

export const TaskEditor = ({ onBack }: TaskEditorProps) => {
  const { selectedTaskPath, setSelectedTaskPath } = useTasks();
  const activeProjectPath = useStore((state) => state.activeProjectPath);
  const { success, error, info, warning } = useNotifications();
  const { startOnce } = useAgent();
  const {
    fileName,
    content,
    isDirty,
    isLoading,
    isSaving,
    setContent,
    save,
    editorMode,
    inlineSelection,
    inlineInstruction,
    inlineOutput,
    inlineError,
    isInlineRunning,
    reviewOriginalContent,
    reviewProposedContent,
    isLargeFile,
    setInlineInstruction,
    setReviewProposedContent,
    beginInlinePrompt,
    submitInlineEdit,
    cancelInlineEdit,
    rejectInlineEdit,
    acceptInlineEdit,
  } = useEditor(selectedTaskPath);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const leaveEditor = useCallback(() => {
    setSelectedTaskPath(null);
    onBack();
  }, [onBack, setSelectedTaskPath]);

  const saveChanges = useCallback(async () => {
    const ok = await save();

    if (ok) {
      success({ title: 'Task saved', description: fileName ?? undefined });
    } else {
      error({ title: 'Failed to save task' });
    }
  }, [error, fileName, save, success]);

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

  if (!selectedTaskPath) {
    return (
      <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
        <h2 className="text-light text-sm font-medium">Task Editor</h2>
        <p className="text-mid mt-2 text-sm">No task selected from the task board.</p>
        <button
          type="button"
          onClick={onBack}
          className="bg-primary text-primary-foreground hover:bg-accent-hover mt-4 rounded-md px-3 py-2 text-sm"
        >
          Back to tasks
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
          const selection = editorRef.current?.getSelectionRange() ?? null;
          const result = beginInlinePrompt(selection);

          if (!result.ok && result.reason) {
            warning({ title: result.reason });
          }
        }}
        onOpenTerminal={() => {
          if (!activeProjectPath || !selectedTaskPath) {
            warning({ title: 'Select an active project and task first' });
            return;
          }

          void (async () => {
            const result = await startOnce({
              projectDir: activeProjectPath,
              filePath: selectedTaskPath,
            });

            if (!result.started) {
              warning({ title: 'Interactive terminal is already running' });
              return;
            }

            window.dispatchEvent(new CustomEvent('ody:view-run'));
            info({
              title: 'Terminal session started',
              description: 'Switched to Run view for live PTY output.',
            });
          })();
        }}
      />

      <div className="bg-panel border-edge relative min-h-0 flex-1 rounded-md border p-2">
        {isLoading ? (
          <div className="text-dim flex h-full items-center justify-center text-sm">
            Loading task...
          </div>
        ) : editorMode === 'review' ? (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-light text-sm font-medium">Review AI changes</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rejectInlineEdit}
                  className="text-mid hover:text-light border-edge rounded-md border px-3 py-1.5 text-xs"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const ok = await acceptInlineEdit();
                      if (ok) {
                        success({ title: 'AI edit applied' });
                        return;
                      }

                      error({ title: 'Failed to apply AI edit' });
                    })();
                  }}
                  className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-1.5 text-xs"
                >
                  Accept
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <DiffView
                original={reviewOriginalContent}
                proposed={reviewProposedContent}
                onProposedChange={setReviewProposedContent}
              />
            </div>
          </div>
        ) : (
          <>
            <MarkdownEditor
              ref={editorRef}
              value={content}
              readOnly={isInlineRunning}
              highlightedRange={editorMode === 'prompt' ? inlineSelection : null}
              onInlinePrompt={(selection) => {
                const result = beginInlinePrompt(selection);
                if (!result.ok && result.reason) {
                  warning({ title: result.reason });
                }
              }}
              onChange={setContent}
              onHistoryChange={(historyState) => {
                setCanUndo(historyState.canUndo);
                setCanRedo(historyState.canRedo);
              }}
            />
            <InlinePrompt
              open={editorMode === 'prompt'}
              selection={inlineSelection}
              instruction={inlineInstruction}
              output={inlineOutput}
              error={inlineError}
              isRunning={isInlineRunning}
              onInstructionChange={setInlineInstruction}
              onCancel={() => {
                void cancelInlineEdit();
              }}
              onSubmit={() => {
                void (async () => {
                  const result = await submitInlineEdit();

                  if (!result.ok && result.reason) {
                    error({ title: result.reason });
                  }
                })();
              }}
            />
          </>
        )}
      </div>

      {isLargeFile ? (
        <p className="text-mid text-xs">
          Cmd+K inline edit is disabled for files larger than 500KB.
        </p>
      ) : null}

      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="bg-panel border-edge max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits in this task file. Leave now to discard them.
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
