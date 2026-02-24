import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { GitHubImportIssue, ImportSource, JiraImportTicket } from '@/types/ipc';
import { useEffect, useMemo, useRef, useState } from 'react';

type ImportData =
  | {
      source: 'jira';
      formatted: string;
      ticket: JiraImportTicket;
    }
  | {
      source: 'github';
      formatted: string;
      owner: string;
      repo: string;
      issue: GitHubImportIssue;
    };

type ImportSettings = {
  jiraProfile: string;
  githubProfile: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveSettings = (config: Record<string, unknown> | null): ImportSettings => {
  const jiraConfig = isObject(config?.jira) ? config.jira : null;
  const githubConfig = isObject(config?.github) ? config.github : null;

  return {
    jiraProfile: typeof jiraConfig?.profile === 'string' ? jiraConfig.profile : 'default',
    githubProfile: typeof githubConfig?.profile === 'string' ? githubConfig.profile : 'default',
  };
};

export const useImport = ({
  config,
  onComplete,
}: {
  config: Record<string, unknown> | null;
  onComplete: () => Promise<unknown>;
}) => {
  const [source, setSource] = useState<ImportSource>('jira');
  const [input, setInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptPreview, setPromptPreview] = useState('');
  const [streamOutput, setStreamOutput] = useState('');
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [missingCredentials, setMissingCredentials] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  const settings = useMemo(() => resolveSettings(config), [config]);

  useEffect(() => {
    const onOutput = api.agent.onOutput((chunk) => {
      if (!isGeneratingRef.current) {
        return;
      }

      setStreamOutput((prev) => `${prev}${chunk}`);
    });

    const finish = () => {
      if (!isGeneratingRef.current) {
        return;
      }

      isGeneratingRef.current = false;
      setIsGenerating(false);
      void onComplete();
    };

    const onAgentComplete = api.agent.onComplete(() => {
      finish();
    });

    const onAgentStopped = api.agent.onStopped(() => {
      finish();
    });

    return () => {
      onOutput();
      onAgentComplete();
      onAgentStopped();
    };
  }, [onComplete]);

  const checkCredentials = async (nextSource: ImportSource) => {
    try {
      const auth = await api.auth.list();
      const profile = nextSource === 'jira' ? settings.jiraProfile : settings.githubProfile;
      const entries = nextSource === 'jira' ? auth.jira : auth.github;
      const hasProfile = Object.prototype.hasOwnProperty.call(entries, profile);

      if (hasProfile) {
        setMissingCredentials(null);
        return true;
      }

      setMissingCredentials(`No ${nextSource} credentials found for profile "${profile}".`);
      return false;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to read credentials';
      toast.error('Failed to verify credentials', { description: message });
      throw cause;
    }
  };

  const fetchData = async () => {
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
      throw new Error('Ticket or issue reference is required');
    }

    const hasCredentials = await checkCredentials(source);
    if (!hasCredentials) {
      return null;
    }

    setIsFetching(true);

    try {
      setPromptPreview('');

      if (source === 'jira') {
        const response = await api.import.fetchJira({ input: trimmedInput });
        const nextData: ImportData = {
          source: 'jira',
          ticket: response.ticket,
          formatted: response.formatted,
        };
        setImportData(nextData);
        return nextData;
      }

      const response = await api.import.fetchGitHub({ input: trimmedInput });
      const nextData: ImportData = {
        source: 'github',
        issue: response.issue,
        owner: response.owner,
        repo: response.repo,
        formatted: response.formatted,
      };
      setImportData(nextData);
      return nextData;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to fetch import data';
      toast.error('Failed to fetch import data', { description: message });
      throw cause;
    } finally {
      setIsFetching(false);
    }
  };

  const previewPrompt = async () => {
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
      throw new Error('Ticket or issue reference is required');
    }

    const hasCredentials = await checkCredentials(source);
    if (!hasCredentials) {
      return '';
    }

    setIsPromptLoading(true);

    try {
      const result = await api.agent.importDryRun({ source, input: trimmedInput });
      setPromptPreview(result.prompt);
      return result.prompt;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to build prompt preview';
      toast.error('Failed to build prompt preview', { description: message });
      throw cause;
    } finally {
      setIsPromptLoading(false);
    }
  };

  const generateTask = async () => {
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
      throw new Error('Ticket or issue reference is required');
    }

    const hasCredentials = await checkCredentials(source);
    if (!hasCredentials) {
      return { started: false };
    }

    setPromptPreview('');
    setStreamOutput('');
    setIsGenerating(true);
    isGeneratingRef.current = true;

    let result;

    try {
      result =
        source === 'jira'
          ? await api.agent.importFromJira({ input: trimmedInput })
          : await api.agent.importFromGitHub({ input: trimmedInput });
    } catch (cause) {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      const message = cause instanceof Error ? cause.message : 'Unable to start task generation';
      toast.error('Failed to start generation', { description: message });
      throw cause;
    }

    if (!result.started) {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }

    return result;
  };

  const resetImport = () => {
    setImportData(null);
    setPromptPreview('');
    setStreamOutput('');
  };

  return {
    source,
    setSource,
    input,
    setInput,
    isFetching,
    isGenerating,
    isPromptLoading,
    importData,
    promptPreview,
    streamOutput,
    missingCredentials,
    settings,
    fetchData,
    previewPrompt,
    generateTask,
    resetImport,
  };
};
