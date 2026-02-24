import { api } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useConfigEditor = (configEditorPath: string | null) => {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await api.editor.snapshot(path);
      setFilePath(snapshot.filePath);
      setContent(snapshot.content);
      setSavedContent(snapshot.content);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configEditorPath) {
      setFilePath(null);
      setContent('');
      setSavedContent('');
      setError(null);
      return;
    }

    void loadConfig(configEditorPath);
  }, [configEditorPath, loadConfig]);

  const save = useCallback(async () => {
    if (!filePath) {
      return { ok: false, reason: 'No config file selected.' };
    }

    try {
      JSON.parse(content);
    } catch {
      const reason = 'Config JSON is invalid. Fix syntax errors before saving.';
      setError(reason);
      return { ok: false, reason };
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.editor.save(filePath, content);
      setSavedContent(content);
      return { ok: true };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      return { ok: false, reason: message };
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

  return {
    filePath,
    fileName,
    content,
    savedContent,
    isDirty: content !== savedContent,
    isLoading,
    isSaving,
    error,
    setContent,
    save,
  };
};
