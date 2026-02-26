import { api } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SelectionRange = {
  from: number;
  to: number;
};

type EditorMode = 'edit' | 'prompt' | 'review';

const INLINE_FILE_SIZE_LIMIT_BYTES = 500 * 1024;

export const useEditor = (selectedTaskPath: string | null) => {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [snapshotContent, setSnapshotContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [inlineSelection, setInlineSelection] = useState<SelectionRange | null>(null);
  const [inlineInstruction, setInlineInstruction] = useState('');
  const [inlineOutput, setInlineOutput] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isInlineRunning, setIsInlineRunning] = useState(false);
  const [reviewOriginalContent, setReviewOriginalContent] = useState('');
  const [reviewProposedContent, setReviewProposedContent] = useState('');

  const loadTask = useCallback(async (taskPath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const task = await api.tasks.read(taskPath);
      setFilePath(task.filePath);
      setContent(task.content);
      setSavedContent(task.content);
      setEditorMode('edit');
      setInlineSelection(null);
      setInlineInstruction('');
      setInlineOutput('');
      setInlineError(null);
      setIsInlineRunning(false);
      setReviewOriginalContent('');
      setReviewProposedContent('');

      const snapshot = await api.editor.snapshot(task.filePath);
      setSnapshotContent(snapshot.content);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTaskPath) {
      setFilePath(null);
      setContent('');
      setSavedContent('');
      setSnapshotContent('');
      setError(null);
      setEditorMode('edit');
      setInlineSelection(null);
      setInlineInstruction('');
      setInlineOutput('');
      setInlineError(null);
      setIsInlineRunning(false);
      setReviewOriginalContent('');
      setReviewProposedContent('');
      return;
    }

    loadTask(selectedTaskPath);
  }, [loadTask, selectedTaskPath]);

  const save = useCallback(async () => {
    if (!filePath) {
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.editor.save(filePath, content);
      setSavedContent(content);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [content, filePath]);

  const fileName = useMemo(() => {
    if (!filePath) {
      return null;
    }

    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.at(-1) ?? filePath;
  }, [filePath]);

  const isLargeFile = useMemo(
    () => new TextEncoder().encode(content).length > INLINE_FILE_SIZE_LIMIT_BYTES,
    [content],
  );

  const beginInlinePrompt = useCallback(
    (selection: SelectionRange | null) => {
      if (!filePath) {
        return { ok: false, reason: 'No task selected.' };
      }

      if (isLargeFile) {
        return { ok: false, reason: 'Inline AI edit is limited to files under 500KB.' };
      }

      setInlineSelection(selection);
      setInlineError(null);
      setInlineOutput('');
      setEditorMode('prompt');

      return { ok: true };
    },
    [filePath, isLargeFile],
  );

  const submitInlineEdit = useCallback(async () => {
    if (!filePath) {
      return { ok: false, reason: 'No task selected.' };
    }

    const instruction = inlineInstruction.trim();
    if (instruction.length === 0) {
      setInlineError('Enter an instruction before running AI edit.');
      return { ok: false, reason: 'Instruction is required.' };
    }

    if (isLargeFile) {
      const reason = 'Inline AI edit is limited to files under 500KB.';
      setInlineError(reason);
      return { ok: false, reason };
    }

    setInlineOutput('');
    setInlineError(null);
    setReviewOriginalContent(content);
    setReviewProposedContent('');
    setIsInlineRunning(true);

    const result = await api.agent.editInline({
      filePath,
      fileContent: content,
      selection: inlineSelection,
      instruction,
    });

    if (!result.started) {
      setIsInlineRunning(false);
      setInlineError('Agent is already running. Stop the current run and retry.');
      return { ok: false, reason: 'Agent is busy.' };
    }

    return { ok: true };
  }, [content, filePath, inlineInstruction, inlineSelection, isLargeFile]);

  const cancelInlineEdit = useCallback(async () => {
    if (isInlineRunning) {
      await api.agent.stop(true);
    }

    setIsInlineRunning(false);
    setInlineError(null);
    setInlineOutput('');
    setInlineInstruction('');
    setInlineSelection(null);
    setReviewOriginalContent('');
    setReviewProposedContent('');
    setEditorMode('edit');
  }, [isInlineRunning]);

  const rejectInlineEdit = useCallback(() => {
    setInlineError(null);
    setInlineOutput('');
    setInlineInstruction('');
    setInlineSelection(null);
    setReviewOriginalContent('');
    setReviewProposedContent('');
    setEditorMode('edit');
  }, []);

  const acceptInlineEdit = useCallback(async () => {
    if (!filePath) {
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.editor.save(filePath, reviewProposedContent);
      setContent(reviewProposedContent);
      setSavedContent(reviewProposedContent);
      setSnapshotContent(reviewProposedContent);
      setInlineError(null);
      setInlineOutput('');
      setInlineInstruction('');
      setInlineSelection(null);
      setReviewOriginalContent('');
      setReviewProposedContent('');
      setEditorMode('edit');
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setInlineError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [filePath, reviewProposedContent]);

  useEffect(() => {
    const unbindOutput = api.agent.onOutput((chunk) => {
      setInlineOutput((prev) => (isInlineRunning ? `${prev}${chunk}` : prev));
    });

    const unbindEditResult = api.agent.onEditResult((nextContent) => {
      if (!isInlineRunning) {
        return;
      }

      setIsInlineRunning(false);
      setInlineError(null);
      setReviewProposedContent(nextContent);
      setEditorMode('review');
    });

    const unbindVerifyFailed = api.agent.onVerifyFailed((message) => {
      if (!isInlineRunning) {
        return;
      }

      setIsInlineRunning(false);
      setInlineError(message);
    });

    const unbindStopped = api.agent.onStopped(() => {
      if (!isInlineRunning) {
        return;
      }

      setIsInlineRunning(false);
      setInlineError('AI edit cancelled.');
      setEditorMode('prompt');
    });

    return () => {
      unbindOutput();
      unbindEditResult();
      unbindVerifyFailed();
      unbindStopped();
    };
  }, [isInlineRunning]);

  return {
    filePath,
    fileName,
    content,
    savedContent,
    snapshotContent,
    isDirty: content !== savedContent,
    isLoading,
    isSaving,
    error,
    editorMode,
    inlineSelection,
    inlineInstruction,
    inlineOutput,
    inlineError,
    isInlineRunning,
    reviewOriginalContent,
    reviewProposedContent,
    isLargeFile,
    setContent,
    setInlineInstruction,
    setReviewProposedContent,
    save,
    reload: loadTask,
    beginInlinePrompt,
    submitInlineEdit,
    cancelInlineEdit,
    rejectInlineEdit,
    acceptInlineEdit,
  };
};
