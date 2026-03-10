import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area';
import type { TaskSummary } from '@/types/ipc';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useTasks } from '../hooks/useTasks';
import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './ui/button';

type TaskDetailDialogProps = {
  task: TaskSummary | null;
  open: boolean;
  onClose: () => void;
  onEdit: (filePath: string) => void;
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'border-amber/35 bg-amber-bg text-amber',
  in_progress: 'border-primary/35 bg-accent-bg text-primary',
  completed: 'border-green/35 bg-green-bg text-green',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
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

const stripFrontmatterAndTitle = (content: string): string => {
  // Strip YAML frontmatter
  let stripped = content.replace(/^---[\s\S]*?---\s*/, '');
  // Strip the "# Task: ..." title line since the dialog header already shows the title
  stripped = stripped.replace(/^# .+\n*/, '');
  return stripped.trim();
};

const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS = {
  h1: ({ node: _node, ...props }: Record<string, unknown>) => (
    <h1 className="text-light mt-4 mb-2 text-base font-bold first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }: Record<string, unknown>) => (
    <h2 className="text-light mt-4 mb-2 text-sm font-semibold first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }: Record<string, unknown>) => (
    <h3 className="text-light mt-3 mb-1.5 text-xs font-semibold first:mt-0" {...props} />
  ),
  h4: ({ node: _node, ...props }: Record<string, unknown>) => (
    <h4 className="text-light mt-2 mb-1 text-xs font-medium first:mt-0" {...props} />
  ),
  p: ({ node: _node, ...props }: Record<string, unknown>) => (
    <p className="text-light mb-2 text-sm leading-relaxed" {...props} />
  ),
  ul: ({ node: _node, ...props }: Record<string, unknown>) => (
    <ul className="text-light mb-2 list-disc space-y-1 pl-5 text-sm leading-relaxed" {...props} />
  ),
  ol: ({ node: _node, ...props }: Record<string, unknown>) => (
    <ol
      className="text-light mb-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed"
      {...props}
    />
  ),
  li: ({ node: _node, ...props }: Record<string, unknown>) => (
    <li className="text-light" {...props} />
  ),
  a: ({ node: _node, ...props }: Record<string, unknown>) => (
    <a
      className="text-primary decoration-primary/40 hover:decoration-primary underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ node: _node, ...props }: Record<string, unknown>) => (
    <strong className="text-light font-semibold" {...props} />
  ),
  em: ({ node: _node, ...props }: Record<string, unknown>) => (
    <em className="text-light italic" {...props} />
  ),
  blockquote: ({ node: _node, ...props }: Record<string, unknown>) => (
    <blockquote
      className="border-primary/40 text-dim my-2 border-l-2 pl-3 text-sm italic"
      {...props}
    />
  ),
  hr: ({ node: _node, ...props }: Record<string, unknown>) => (
    <hr className="border-edge my-3" {...props} />
  ),
  code: ({
    node: _node,
    className,
    children,
    ...props
  }: Record<string, unknown> & { className?: string; children?: React.ReactNode }) => {
    const isBlock = /language-(\w+)/.exec(className ?? '');

    if (isBlock) {
      return (
        <code className={`font-mono text-[11px] ${className ?? ''}`} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code
        className="bg-accent-bg text-primary rounded px-1 py-0.5 font-mono text-[11px]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ node: _node, ...props }: Record<string, unknown>) => (
    <pre
      className="border-edge bg-panel my-2 overflow-x-auto rounded border p-3 text-sm"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }: Record<string, unknown>) => (
    <div className="my-2 overflow-x-auto">
      <table className="border-edge w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }: Record<string, unknown>) => (
    <thead className="border-edge border-b" {...props} />
  ),
  th: ({ node: _node, ...props }: Record<string, unknown>) => (
    <th
      className="text-light border-edge border px-2 py-1 text-left text-sm font-semibold"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }: Record<string, unknown>) => (
    <td className="text-light border-edge border px-2 py-1 text-sm" {...props} />
  ),
  input: ({
    node: _node,
    ...props
  }: Record<string, unknown> & { type?: string; checked?: boolean }) => {
    if (props.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          disabled
          className="mr-1.5 align-middle"
          checked={props.checked}
          readOnly
        />
      );
    }

    return <input {...props} />;
  },
} as Record<string, React.ComponentType>;

type RenderedMarkdownProps = {
  content: string;
};

const RenderedMarkdown = ({ content }: RenderedMarkdownProps) => {
  const stripped = useMemo(() => stripFrontmatterAndTitle(content), [content]);

  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
      {stripped}
    </Markdown>
  );
};

export const TaskDetailDialog = ({ task, open, onClose, onEdit }: TaskDetailDialogProps) => {
  const { readTask } = useTasks();
  const [content, setContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(
    async (filePath: string) => {
      setIsLoadingContent(true);
      setError(null);
      setContent(null);

      try {
        const result = await readTask(filePath);
        setContent(result.content);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load task content');
      } finally {
        setIsLoadingContent(false);
      }
    },
    [readTask],
  );

  useEffect(() => {
    if (open && task) {
      void fetchContent(task.filePath);
    }

    if (!open) {
      setContent(null);
      setError(null);
    }
  }, [open, task, fetchContent]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="bg-panel border-edge md:max-w-1/2">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="text-light">{task?.title ?? 'Task Detail'}</DialogTitle>
            {task ? (
              <span
                className={[
                  'shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
                  STATUS_BADGE[task.status] ?? 'border-edge text-dim',
                ].join(' ')}
              >
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        {task ? (
          <div className="border-edge flex flex-wrap items-center gap-2 border-t pt-3">
            {task.labels.length > 0
              ? task.labels.map((label) => (
                  <span
                    key={label}
                    className={[
                      'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
                      getLabelClassName(label),
                    ].join(' ')}
                  >
                    {label}
                  </span>
                ))
              : null}
            {task.complexity ? (
              <span className="text-dim border-edge rounded border px-1.5 py-0.5 text-[10px]">
                {task.complexity}
              </span>
            ) : null}
            {task.created ? (
              <span className="text-dim text-[10px]">Created: {task.created}</span>
            ) : null}
            {task.started ? (
              <span className="text-dim text-[10px]">Started: {task.started}</span>
            ) : null}
            {task.completed ? (
              <span className="text-dim text-[10px]">Completed: {task.completed}</span>
            ) : null}
          </div>
        ) : null}

        {isLoadingContent ? <LoadingSpinner size="sm" label="Loading task content" /> : null}

        {error ? (
          <div className="border-red/30 bg-red-bg rounded border px-3 py-2">
            <p className="text-red text-xs">{error}</p>
          </div>
        ) : null}

        {content ? (
          <ScrollArea className="max-h-[70vh] min-h-0">
            <ScrollAreaViewport>
              <ScrollAreaContent className="pr-2">
                <RenderedMarkdown content={content} />
              </ScrollAreaContent>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {task ? (
            <Button
              variant="primary-outline"
              onClick={() => {
                onEdit(task.filePath);
                onClose();
              }}
            >
              Edit
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
