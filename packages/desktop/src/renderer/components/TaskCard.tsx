import { Button } from '@/components/ui/button';
import type { TaskSummary } from '@/types/ipc';
import { CheckCircle2, Pencil, Play, StopCircle, Trash2 } from 'lucide-react';

type TaskCardProps = {
  task: TaskSummary;
  outputPreview?: string;
  isRunning?: boolean;
  onClick?: (task: TaskSummary) => void;
  onRun: (task: TaskSummary) => void;
  onEdit: (task: TaskSummary) => void;
  onDelete: (task: TaskSummary) => void;
  onStop?: () => void;
};

const getLabelClassName = (label: string) => {
  const value = label.toLowerCase();

  if (value.includes('security')) {
    return 'border-red/25 bg-red-bg text-red';
  }

  if (value.includes('api')) {
    return 'border-blue/25 bg-blue-bg text-blue';
  }

  if (value.includes('feature')) {
    return 'border-green/25 bg-green-bg text-green';
  }

  if (value.includes('database')) {
    return 'border-amber/25 bg-amber-bg text-amber';
  }

  return 'border-primary/25 bg-accent-bg text-primary';
};

export const TaskCard = ({
  task,
  outputPreview,
  isRunning,
  onClick,
  onRun,
  onEdit,
  onDelete,
  onStop,
}: TaskCardProps) => {
  const isInProgress = task.status === 'in_progress';
  const isCompleted = task.status === 'completed';

  return (
    <article
      className={[
        'group animate-fade-up bg-panel rounded-lg border p-3',
        isInProgress ? 'border-primary/40 shadow-[0_0_0_1px_rgb(0_245_212/12%)]' : 'border-edge',
        isCompleted ? 'opacity-70' : '',
        onClick ? 'cursor-pointer' : '',
      ].join(' ')}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-light text-sm leading-snug font-semibold">{task.title}</h3>
        {isCompleted ? <CheckCircle2 className="text-green mt-0.5 size-4 shrink-0" /> : null}
      </div>

      {task.description.length > 0 ? (
        <p className="text-mid mt-2 line-clamp-4 text-xs leading-relaxed">{task.description}</p>
      ) : null}

      {task.labels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <span
              key={`${task.filePath}-${label}`}
              className={[
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
                getLabelClassName(label),
              ].join(' ')}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {isInProgress ? (
        <div className="bg-background/65 border-edge mt-3 rounded border p-2">
          <p className="text-dim mb-1 text-[10px] tracking-[0.12em] uppercase">Live output</p>
          <pre className="text-light max-h-20 overflow-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
            {outputPreview || 'Waiting for agent output...'}
          </pre>
          {onStop ? (
            <Button
              variant="outline"
              size="sm"
              className="text-amber dark:border-amber/35 hover:bg-amber-bg mt-2"
              onClick={(event) => {
                event.stopPropagation();
                onStop?.();
              }}
              disabled={!isRunning}
            >
              <StopCircle className="size-4" />
              Stop
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isCompleted ? (
        <div className="mt-3 flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <Button
            variant="primary-outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onRun(task);
            }}
          >
            <Play className="size-3" />
            Run
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
          >
            <Pencil className="size-3" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task);
            }}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
        </div>
      ) : null}

      <div className="text-dim mt-3 flex items-center justify-between text-[11px]">
        <span>{task.complexity ?? 'Unspecified'}</span>
        <span>{task.created ?? 'No date'}</span>
      </div>
    </article>
  );
};
