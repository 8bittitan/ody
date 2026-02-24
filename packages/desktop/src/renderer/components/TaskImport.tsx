import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useImport } from '@/hooks/useImport';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { Import } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

type TaskImportProps = {
  config: Record<string, unknown> | null;
  onOpenAuth: () => void;
  onOpenTaskBoard: () => void;
};

export const TaskImport = ({ config, onOpenAuth, onOpenTaskBoard }: TaskImportProps) => {
  const { refreshTasks } = useTasks();
  const { success, warning, error, accent } = useNotifications();
  const {
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
  } = useImport({
    config,
    onComplete: refreshTasks,
  });

  const handleFetch = async () => {
    try {
      const result = await fetchData();

      if (result) {
        const reference =
          result.source === 'jira'
            ? result.ticket.key
            : `${result.owner}/${result.repo}#${result.issue.number}`;
        success({ title: 'Import data fetched', description: reference });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error({ title: 'Fetch failed', description: message });
    }
  };

  const handlePreviewPrompt = async () => {
    try {
      const prompt = await previewPrompt();

      if (prompt.length > 0) {
        accent({ title: 'Prompt preview generated' });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error({ title: 'Prompt preview failed', description: message });
    }
  };

  const handleGenerateTask = async () => {
    try {
      const result = await generateTask();

      if (!result.started) {
        warning({ title: 'Agent is already running' });
        return;
      }

      accent({ title: 'Generating task from imported data' });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error({ title: 'Task generation failed', description: message });
    }
  };

  return (
    <section className="bg-panel/92 border-edge h-full overflow-y-auto rounded-lg border p-4 backdrop-blur-sm">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <p className="text-dim text-xs tracking-[0.08em] uppercase">Source</p>
            <RadioGroup
              value={source}
              onValueChange={(value) => {
                if (value !== 'jira' && value !== 'github') {
                  return;
                }

                setSource(value);
                resetImport();
              }}
              className="flex gap-4"
            >
              <label className="text-mid flex items-center gap-2 text-sm">
                <RadioGroupItem value="jira" /> Jira
              </label>
              <label className="text-mid flex items-center gap-2 text-sm">
                <RadioGroupItem value="github" /> GitHub
              </label>
            </RadioGroup>
          </div>
          <Badge variant="outline" className="border-primary/35 text-primary w-fit">
            Profile: {source === 'jira' ? settings.jiraProfile : settings.githubProfile}
          </Badge>
        </div>

        <label className="block space-y-1">
          <span className="text-dim text-xs">
            {source === 'jira'
              ? 'Ticket key or URL (PROJ-123 or https://.../browse/PROJ-123)'
              : 'Issue reference (owner/repo#123 or https://github.com/.../issues/123)'}
          </span>
          <Input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            placeholder={source === 'jira' ? 'PROJ-123' : 'owner/repo#123'}
            disabled={isFetching || isGenerating}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void handleFetch();
            }}
            disabled={isFetching || isGenerating}
          >
            {isFetching ? 'Fetching...' : 'Fetch'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void handlePreviewPrompt();
            }}
            disabled={isPromptLoading || isGenerating}
          >
            {isPromptLoading ? 'Building prompt...' : 'Preview Prompt'}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void handleGenerateTask();
            }}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Task'}
          </Button>
        </div>

        {missingCredentials ? (
          <div className="border-amber/40 bg-amber-bg/40 rounded-md border p-3 text-sm">
            <p className="text-amber">{missingCredentials}</p>
            <Button
              size="xs"
              variant="link"
              className="text-amber mt-1 h-auto p-0"
              onClick={onOpenAuth}
            >
              Configure credentials
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-dim text-xs tracking-[0.08em] uppercase">Fetched Preview</p>
          <div className="bg-background border-edge min-h-32 rounded-md border p-3 text-sm">
            {isFetching ? (
              <LoadingSpinner size="sm" label="Fetching task data" />
            ) : !importData ? (
              <EmptyState
                icon={<Import className="size-4" />}
                title="No import data"
                description="Fetch a Jira ticket or GitHub issue to preview the task context."
              />
            ) : importData.source === 'jira' ? (
              <div className="space-y-3">
                <div>
                  <p className="text-light font-medium">{importData.ticket.summary}</p>
                  <p className="text-mid text-xs">{importData.ticket.key}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{importData.ticket.status || 'unknown status'}</Badge>
                  <Badge variant="outline">{importData.ticket.priority || 'no priority'}</Badge>
                  {importData.ticket.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
                <p className="text-mid whitespace-pre-wrap">
                  {importData.ticket.description || 'No description.'}
                </p>
                {importData.ticket.comments.length > 0 ? (
                  <ul className="text-mid list-disc space-y-1 pl-5">
                    {importData.ticket.comments.map((comment) => (
                      <li key={comment}>{comment}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-mid">No comments.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-light font-medium">{importData.issue.title}</p>
                  <p className="text-mid text-xs">
                    {importData.owner}/{importData.repo}#{importData.issue.number}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{importData.issue.state || 'unknown state'}</Badge>
                  {importData.issue.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
                <p className="text-mid whitespace-pre-wrap">
                  {importData.issue.body || 'No description.'}
                </p>
                {importData.issue.comments.length > 0 ? (
                  <ul className="text-mid list-disc space-y-1 pl-5">
                    {importData.issue.comments.map((comment) => (
                      <li key={comment}>{comment}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-mid">No comments.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {promptPreview.trim().length > 0 ? (
          <div className="space-y-1">
            <p className="text-dim text-xs tracking-[0.08em] uppercase">Prompt Preview</p>
            <pre className="bg-background border-edge max-h-52 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
              {promptPreview}
            </pre>
          </div>
        ) : null}

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-dim text-xs tracking-[0.08em] uppercase">Generation Output</p>
            <Button size="xs" variant="link" className="h-auto p-0" onClick={onOpenTaskBoard}>
              Open Task Board
            </Button>
          </div>
          <pre className="bg-background border-edge max-h-56 min-h-28 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
            {streamOutput.trim().length > 0
              ? streamOutput
              : isGenerating
                ? 'Waiting for first output...'
                : 'No output yet.'}
          </pre>
        </div>
      </div>
    </section>
  );
};
