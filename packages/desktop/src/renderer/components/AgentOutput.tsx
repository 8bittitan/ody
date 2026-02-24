import { TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { TerminalView } from './TerminalView';

type AgentOutputProps = {
  output: string[];
  error: string | null;
  hasAmbiguousMarker: boolean;
  isRunning?: boolean;
  onClear: () => void;
};

const COLOR_MAP: Record<number, string> = {
  30: 'var(--muted-foreground)',
  31: 'var(--red)',
  32: 'var(--green)',
  33: 'var(--amber)',
  34: 'var(--primary)',
  35: 'var(--primary)',
  36: 'var(--primary)',
  37: 'var(--foreground)',
  90: 'var(--muted-foreground)',
  91: 'var(--red)',
  92: 'var(--green)',
  93: 'var(--amber)',
  94: 'var(--primary)',
  95: 'var(--primary)',
  96: 'var(--primary)',
  97: 'var(--foreground)',
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toAnsiHtml = (content: string) => {
  const pattern = new RegExp(String.raw`\u001b\[([0-9;]+)m`, 'g');
  let cursor = 0;
  let currentColor: string | null = null;
  let currentBold = false;
  let html = '';

  const appendSegment = (segment: string) => {
    if (segment.length === 0) {
      return;
    }

    const styles: string[] = [];

    if (currentColor) {
      styles.push(`color:${currentColor}`);
    }

    if (currentBold) {
      styles.push('font-weight:600');
    }

    const escaped = escapeHtml(segment);
    if (styles.length === 0) {
      html += escaped;
      return;
    }

    html += `<span style="${styles.join(';')}">${escaped}</span>`;
  };

  let match = pattern.exec(content);
  while (match) {
    const segment = content.slice(cursor, match.index);
    appendSegment(segment);

    const codes = (match[1] ?? '')
      .split(';')
      .map((code) => Number.parseInt(code, 10))
      .filter((code) => !Number.isNaN(code));

    if (codes.length === 0) {
      currentColor = null;
      currentBold = false;
    }

    for (const code of codes) {
      if (code === 0) {
        currentColor = null;
        currentBold = false;
        continue;
      }

      if (code === 1) {
        currentBold = true;
        continue;
      }

      if (code === 22) {
        currentBold = false;
        continue;
      }

      if (code === 39) {
        currentColor = null;
        continue;
      }

      const mapped = COLOR_MAP[code];
      if (mapped) {
        currentColor = mapped;
      }
    }

    cursor = match.index + match[0].length;
    match = pattern.exec(content);
  }

  appendSegment(content.slice(cursor));

  return html;
};

export const AgentOutput = ({
  output,
  error,
  hasAmbiguousMarker,
  isRunning = false,
  onClear,
}: AgentOutputProps) => {
  const [mode, setMode] = useState<'log' | 'terminal'>('log');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outputContent = useMemo(() => output.join(''), [output]);
  const outputHtml = useMemo(() => toAnsiHtml(outputContent), [outputContent]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    setAutoScroll(distance <= 24);
  };

  useEffect(() => {
    if (!autoScroll || !containerRef.current) {
      return;
    }

    const target = containerRef.current;
    target.scrollTop = target.scrollHeight;
  }, [autoScroll, outputHtml]);

  return (
    <section className="bg-panel/90 border-edge flex min-h-0 flex-1 flex-col rounded-lg border">
      <header className="border-edge flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className={[
              'rounded border px-2 py-1',
              mode === 'log'
                ? 'border-primary/35 bg-accent-bg text-primary'
                : 'border-edge text-mid',
            ].join(' ')}
            onClick={() => {
              setMode('log');
            }}
          >
            Log View
          </button>
          <button
            type="button"
            className={[
              'rounded border px-2 py-1',
              mode === 'terminal'
                ? 'border-primary/35 bg-accent-bg text-primary'
                : 'border-edge text-mid',
            ].join(' ')}
            onClick={() => {
              setMode('terminal');
            }}
          >
            Terminal View
          </button>
        </div>

        <button
          type="button"
          className="text-mid border-edge hover:text-light rounded border px-2 py-1 text-xs"
          onClick={onClear}
        >
          Clear
        </button>
      </header>

      {hasAmbiguousMarker ? (
        <div className="text-amber bg-amber-bg border-amber/30 border-b px-3 py-2 text-xs">
          Completion marker looked ambiguous. Review task status before running another cycle.
        </div>
      ) : null}

      {error ? (
        <div className="text-red bg-red-bg border-red/35 border-b px-3 py-2 text-xs">{error}</div>
      ) : null}

      {mode === 'log' ? (
        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-auto p-3"
          onScroll={handleScroll}
        >
          {outputHtml.length > 0 ? (
            <pre
              className="text-light font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: outputHtml }}
            />
          ) : isRunning ? (
            <LoadingSpinner size="md" label="Waiting for first output" />
          ) : (
            <EmptyState
              icon={<TerminalSquare className="size-4" />}
              title="No agent output"
              description="No agent output. Start a run to see output here."
            />
          )}
        </div>
      ) : (
        <TerminalView initialOutput={outputContent} />
      )}
    </section>
  );
};
