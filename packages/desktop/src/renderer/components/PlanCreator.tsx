import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
import { api } from '@/lib/api';
import type { MutableRefObject } from 'react';
import { useState } from 'react';

type PlanCreatorProps = {
  isGenerating: boolean;
  isGeneratingRef: MutableRefObject<boolean>;
  setIsGenerating: (value: boolean) => void;
  setStreamOutput: (updater: (prev: string) => string) => void;
  resetStream: () => void;
};

export const PlanCreator = ({
  isGenerating,
  isGeneratingRef,
  setIsGenerating,
  resetStream,
}: PlanCreatorProps) => {
  const { accent, warning } = useNotifications();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [description, setDescription] = useState('');
  const [planFilePath, setPlanFilePath] = useState('');
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [isPromptLoading, setIsPromptLoading] = useState(false);

  const beginGeneration = () => {
    setPreviewPrompt('');
    resetStream();
    isGeneratingRef.current = true;
    setIsGenerating(true);
  };

  const handleGenerateSingle = async () => {
    if (description.trim().length === 0) {
      warning({ title: 'Add a task description first' });
      return;
    }

    beginGeneration();
    const result = await api.agent.planNew(description);

    if (!result.started) {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      warning({ title: 'Agent is already running' });
      return;
    }

    accent({ title: 'Generating task file from plan description' });
  };

  const handleGenerateBatch = async () => {
    if (planFilePath.trim().length === 0) {
      warning({ title: 'Choose a planning document first' });
      return;
    }

    beginGeneration();
    const result = await api.agent.planBatch(planFilePath);

    if (!result.started) {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      warning({ title: 'Agent is already running' });
      return;
    }

    accent({ title: 'Generating task files from planning document' });
  };

  const handlePreviewPrompt = async () => {
    if (description.trim().length === 0) {
      warning({ title: 'Add a task description first' });
      return;
    }

    setIsPromptLoading(true);

    try {
      const result = await api.agent.planPreview(description);
      setPreviewPrompt(result.prompt);
    } finally {
      setIsPromptLoading(false);
    }
  };

  return (
    <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'single' | 'batch')}>
        <TabsList className="bg-background border-edge grid w-full grid-cols-2 border">
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-3 space-y-3">
          <label className="block">
            <span className="text-dim mb-1 block text-xs">Task description</span>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              placeholder="Describe the task you want to create"
              className="bg-background border-edge text-light placeholder:text-dim min-h-32 w-full rounded border p-2 text-sm"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-mid hover:text-light border-edge hover:bg-background rounded-md border px-3 py-1.5 text-xs"
              onClick={() => {
                void handlePreviewPrompt();
              }}
              disabled={isPromptLoading || isGenerating}
            >
              {isPromptLoading ? 'Loading prompt...' : 'Preview Prompt'}
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-1.5 text-xs"
              onClick={() => {
                void handleGenerateSingle();
              }}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </TabsContent>

        <TabsContent value="batch" className="mt-3 space-y-3">
          <label className="block">
            <span className="text-dim mb-1 block text-xs">Planning document path</span>
            <input
              value={planFilePath}
              onChange={(event) => {
                setPlanFilePath(event.target.value);
              }}
              placeholder="/absolute/path/to/plan.md"
              className="bg-background border-edge text-light placeholder:text-dim h-9 w-full rounded border px-2 text-sm"
            />
          </label>

          <label className="border-edge bg-background/40 hover:bg-background/70 block cursor-pointer rounded border border-dashed p-3 text-center text-xs">
            <span className="text-mid">Choose markdown file</span>
            <input
              type="file"
              accept=".md,.markdown,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] as (File & { path?: string }) | undefined;

                if (file?.path) {
                  setPlanFilePath(file.path);
                }
              }}
            />
          </label>

          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-1.5 text-xs"
            onClick={() => {
              void handleGenerateBatch();
            }}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Tasks'}
          </button>
        </TabsContent>
      </Tabs>

      {previewPrompt.trim().length > 0 ? (
        <div className="mt-3">
          <p className="text-dim mb-1 text-xs">Prompt preview</p>
          <pre className="bg-background border-edge max-h-52 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
            {previewPrompt}
          </pre>
        </div>
      ) : null}
    </section>
  );
};
