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
import { useCallback, useEffect, useState } from 'react';

import { useTasks } from '../hooks/useTasks';
import { LoadingSpinner } from './LoadingSpinner';

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

type MarkdownSection = {
  heading: string;
  body: string;
};

const parseMarkdownSections = (content: string): MarkdownSection[] => {
  // Strip YAML frontmatter
  const stripped = content.replace(/^---[\s\S]*?---\s*/, '');

  // Split on ## headings
  const parts = stripped.split(/^## /m);
  const sections: MarkdownSection[] = [];

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const newlineIndex = trimmed.indexOf('\n');

    if (newlineIndex === -1) {
      sections.push({ heading: trimmed, body: '' });
    } else {
      sections.push({
        heading: trimmed.slice(0, newlineIndex).trim(),
        body: trimmed.slice(newlineIndex + 1).trim(),
      });
    }
  }

  return sections;
};

const renderSectionBody = (body: string) => {
  if (body.length === 0) {
    return null;
  }

  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let numberedItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="text-mid list-disc space-y-1 pl-5 text-xs leading-relaxed">
          {listItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  const flushNumberedList = () => {
    if (numberedItems.length > 0) {
      elements.push(
        <ol key={key++} className="text-mid list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          {numberedItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>,
      );
      numberedItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushList();
      flushNumberedList();
      continue;
    }

    // Unordered list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushNumberedList();
      listItems.push(trimmed.slice(2));
      continue;
    }

    // Ordered list item
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);

    if (numberedMatch) {
      flushList();
      numberedItems.push(numberedMatch[1]);
      continue;
    }

    // Bold heading-like lines (e.g. **Step 1: ...**)
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      flushList();
      flushNumberedList();
      elements.push(
        <p key={key++} className="text-light mt-1 text-xs font-semibold">
          {trimmed.replace(/\*\*/g, '')}
        </p>,
      );
      continue;
    }

    // Regular paragraph
    flushList();
    flushNumberedList();
    elements.push(
      <p key={key++} className="text-mid text-xs leading-relaxed">
        {trimmed}
      </p>,
    );
  }

  flushList();
  flushNumberedList();

  return <div className="space-y-2">{elements}</div>;
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

  const sections = content ? parseMarkdownSections(content) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="bg-panel border-edge max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
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

        {content && sections.length > 0 ? (
          <ScrollArea className="max-h-[70vh] min-h-0">
            <ScrollAreaViewport>
              <ScrollAreaContent className="space-y-4 pr-2">
                {sections.map((section) => (
                  <div key={section.heading}>
                    <h3 className="text-light mb-2 text-sm font-semibold">{section.heading}</h3>
                    {renderSectionBody(section.body)}
                  </div>
                ))}
              </ScrollAreaContent>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
          {task ? (
            <button
              type="button"
              className="text-primary border-primary/30 hover:bg-accent-bg rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                onEdit(task.filePath);
                onClose();
              }}
            >
              Edit
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
