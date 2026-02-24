import { Collapsible } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAgent } from '@/hooks/useAgent';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useStore } from '@/store';
import type { TaskSummary } from '@/types/ipc';
import { useMemo, useState } from 'react';

import { AgentOutput } from './AgentOutput';
import { ProgressViewer } from './ProgressViewer';

const getTaskFileName = (taskPath: string) => {
  const normalized = taskPath.replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? taskPath;
};

export const AgentRunner = () => {
  const activeProjectPath = useStore((state) => state.activeProjectPath);
  const { tasks } = useTasks();
  const { config } = useConfig();
  const { accent, warning, error } = useNotifications();
  const {
    isRunning,
    iteration,
    maxIterations,
    output,
    error: runError,
    hasAmbiguousMarker,
    start,
    stop,
    clearOutput,
  } = useAgent();

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedTaskPath, setSelectedTaskPath] = useState<string>('');
  const [runIterations, setRunIterations] = useState(
    typeof config?.maxIterations === 'number' ? config.maxIterations : 1,
  );
  const [runShouldCommit, setRunShouldCommit] = useState(
    typeof config?.shouldCommit === 'boolean' ? config.shouldCommit : false,
  );
  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopMode, setStopMode] = useState<'graceful' | 'force'>('graceful');

  const labels = useMemo(() => {
    const unique = new Set<string>();

    for (const task of tasks) {
      for (const label of task.labels) {
        unique.add(label);
      }
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status !== 'completed'), [tasks]);

  const filteredTasks = useMemo(() => {
    if (!selectedLabel) {
      return pendingTasks;
    }

    return pendingTasks.filter((task) => task.labels.includes(selectedLabel));
  }, [pendingTasks, selectedLabel]);

  const selectedTask = useMemo(
    () => pendingTasks.find((task) => task.filePath === selectedTaskPath) ?? null,
    [pendingTasks, selectedTaskPath],
  );

  const taskFilesForRun = useMemo(() => {
    if (selectedTaskPath.length > 0) {
      return [selectedTaskPath];
    }

    return filteredTasks.map((task) => task.filePath);
  }, [filteredTasks, selectedTaskPath]);

  const openRunConfirm = () => {
    if (!activeProjectPath) {
      warning({ title: 'Select a project first' });
      return;
    }

    if (taskFilesForRun.length === 0) {
      warning({ title: 'No tasks match current filter' });
      return;
    }

    setShowRunConfirm(true);
  };

  const handleStart = async () => {
    if (!activeProjectPath) {
      return;
    }

    const result = await start({
      projectDir: activeProjectPath,
      taskFiles: taskFilesForRun,
      iterations: Math.max(1, runIterations),
    });

    if (!result.started) {
      warning({ title: 'Agent is already running' });
      return;
    }

    accent({
      title: 'Agent run started',
      description: runShouldCommit ? 'Auto-commit is enabled in config.' : undefined,
    });
    setShowRunConfirm(false);
  };

  const handleStop = async () => {
    const force = stopMode === 'force';
    await stop(force);
    setShowStopConfirm(false);

    if (force) {
      error({ title: 'Agent force-stopped', description: 'Partial edits may need review.' });
      return;
    }

    warning({ title: 'Agent stopping gracefully' });
  };

  const runTargetLabel =
    selectedTask?.title ??
    (selectedLabel
      ? `Tasks labeled "${selectedLabel}" (${taskFilesForRun.length})`
      : `All pending tasks (${taskFilesForRun.length})`);

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="bg-panel/90 border-edge rounded-lg border p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <p className="text-dim mb-1 text-xs">Backend</p>
            <p className="text-light font-mono text-sm">{String(config?.backend ?? 'opencode')}</p>
          </div>

          <label className="block">
            <span className="text-dim mb-1 block text-xs">Iteration limit</span>
            <input
              type="number"
              min={1}
              value={runIterations}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                setRunIterations(Number.isNaN(nextValue) ? 1 : Math.max(1, nextValue));
              }}
              className="bg-background border-edge text-light h-8 w-full rounded border px-2 text-sm"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-2 text-sm"
              onClick={openRunConfirm}
              disabled={isRunning}
            >
              Start
            </button>
            <button
              type="button"
              className="text-red border-red/35 hover:bg-red-bg rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setShowStopConfirm(true);
              }}
              disabled={!isRunning}
            >
              Stop
            </button>
          </div>
        </div>

        <Collapsible
          defaultOpen={false}
          label="Filter by label"
          badge={selectedLabel}
          className="mt-3"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={[
                'rounded border px-2 py-1 text-xs',
                selectedLabel === null
                  ? 'border-primary/35 bg-accent-bg text-primary'
                  : 'border-edge text-mid',
              ].join(' ')}
              onClick={() => {
                setSelectedLabel(null);
              }}
            >
              All labels
            </button>
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                className={[
                  'rounded border px-2 py-1 text-xs',
                  selectedLabel === label
                    ? 'border-primary/35 bg-accent-bg text-primary'
                    : 'border-edge text-mid',
                ].join(' ')}
                onClick={() => {
                  setSelectedLabel((prev) => (prev === label ? null : label));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Collapsible>

        <label className="mt-3 block">
          <span className="text-dim mb-1 block text-xs">Specific task (optional)</span>
          <select
            value={selectedTaskPath}
            onChange={(event) => {
              setSelectedTaskPath(event.target.value);
            }}
            className="bg-background border-edge text-light h-8 w-full rounded border px-2 text-sm"
          >
            <option value="">Run current task filter</option>
            {pendingTasks.map((task: TaskSummary) => (
              <option key={task.filePath} value={task.filePath}>
                {task.title}
              </option>
            ))}
          </select>
        </label>

        <p className="text-dim mt-3 text-xs">
          {isRunning
            ? `Iteration ${iteration} of ${maxIterations || '∞'} -- Running...`
            : `Ready. ${taskFilesForRun.length} task${taskFilesForRun.length === 1 ? '' : 's'} selected.`}
        </p>
      </section>

      <AgentOutput
        output={output}
        error={runError}
        hasAmbiguousMarker={hasAmbiguousMarker}
        isRunning={isRunning}
        onClear={() => {
          clearOutput();
          accent({ title: 'Output cleared' });
        }}
      />

      <ProgressViewer iteration={iteration} isRunning={isRunning} />

      <Dialog
        open={showRunConfirm}
        onOpenChange={(open) => {
          setShowRunConfirm(open);
        }}
      >
        <DialogContent className="bg-panel border-edge max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Start agent run</DialogTitle>
            <DialogDescription>Review settings before launching this run.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="border-edge rounded border p-2">
              <p className="text-dim text-xs">Task target</p>
              <p className="text-light mt-1">{runTargetLabel}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border-edge rounded border p-2">
                <p className="text-dim">Backend</p>
                <p className="text-light mt-1 font-mono">{String(config?.backend ?? 'opencode')}</p>
              </div>
              <div className="border-edge rounded border p-2">
                <p className="text-dim">Iterations</p>
                <p className="text-light mt-1">{Math.max(1, runIterations)}</p>
              </div>
            </div>
            <label className="border-edge flex items-center justify-between rounded border p-2 text-xs">
              <span className="text-mid">Auto-commit after run</span>
              <Switch checked={runShouldCommit} onCheckedChange={setRunShouldCommit} size="sm" />
            </label>
            {selectedTask ? (
              <p className="text-dim text-xs">File: {getTaskFileName(selectedTask.filePath)}</p>
            ) : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setShowRunConfirm(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-2 text-sm"
              onClick={() => {
                void handleStart();
              }}
            >
              Start Agent
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showStopConfirm}
        onOpenChange={(open) => {
          setShowStopConfirm(open);
        }}
      >
        <DialogContent className="bg-panel border-edge max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Stop current run?</DialogTitle>
            <DialogDescription>
              Choose how the run should be stopped and whether to allow graceful cleanup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <label className="border-edge flex cursor-pointer items-start gap-2 rounded border p-2">
              <input
                type="radio"
                name="stop-mode"
                checked={stopMode === 'graceful'}
                onChange={() => {
                  setStopMode('graceful');
                }}
              />
              <span>
                <span className="text-light block">Graceful stop</span>
                <span className="text-dim text-xs">Wait for current cycle to finish.</span>
              </span>
            </label>
            <label className="border-red/35 bg-red-bg flex cursor-pointer items-start gap-2 rounded border p-2">
              <input
                type="radio"
                name="stop-mode"
                checked={stopMode === 'force'}
                onChange={() => {
                  setStopMode('force');
                }}
              />
              <span>
                <span className="text-red block">Force stop</span>
                <span className="text-mid text-xs">May leave partial file changes behind.</span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setShowStopConfirm(false);
              }}
            >
              Keep Running
            </button>
            <button
              type="button"
              className="text-red border-red/35 hover:bg-red-bg rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                void handleStop();
              }}
            >
              Stop Agent
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
