import type { Editor } from '@milkdown/kit/core';
import { defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { history, redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { undoDepth, redoDepth } from '@milkdown/kit/prose/history';
import { callCommand, getMarkdown, replaceAll } from '@milkdown/kit/utils';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type SelectionRange = {
  from: number;
  to: number;
};

type RichMarkdownEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  language?: 'markdown' | 'json';
  readOnly?: boolean;
  highlightedRange?: SelectionRange | null;
  onInlinePrompt?: (selection: SelectionRange | null) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

export type RichMarkdownEditorHandle = {
  undo: () => void;
  redo: () => void;
  focus: () => void;
  getSelectionRange: () => SelectionRange | null;
};

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: '', body: raw };
  }
  return {
    frontmatter: match[0],
    body: raw.slice(match[0].length),
  };
}

function joinFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) {
    return body;
  }
  const fm = frontmatter.endsWith('\n') ? frontmatter : `${frontmatter}\n`;
  return `${fm}${body}`;
}

// ---------------------------------------------------------------------------
// Selection mapping: ProseMirror position -> raw markdown character offset
// ---------------------------------------------------------------------------

function mapSelectionToMarkdown(ctx: Ctx, frontmatterLength: number): SelectionRange | null {
  const view = ctx.get(editorViewCtx);
  const { from, to } = view.state.selection;
  if (from === to) return null;

  const bodyMarkdown = getMarkdown()(ctx);
  const selectedText = view.state.doc.textBetween(from, to, '\n', '\n');
  const bodyIdx = bodyMarkdown.indexOf(selectedText);

  if (bodyIdx >= 0) {
    return {
      from: frontmatterLength + bodyIdx,
      to: frontmatterLength + bodyIdx + selectedText.length,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RichMarkdownEditor = forwardRef<RichMarkdownEditorHandle, RichMarkdownEditorProps>(
  ({ value, onChange, readOnly = false, onInlinePrompt, onHistoryChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const editorReadyRef = useRef(false);
    const frontmatterRef = useRef('');
    const [frontmatter, setFrontmatter] = useState('');
    const [showFrontmatter, setShowFrontmatter] = useState(false);

    // Stable callback refs
    const onChangeRef = useRef(onChange);
    const onInlinePromptRef = useRef(onInlinePrompt);
    const onHistoryChangeRef = useRef(onHistoryChange);

    onChangeRef.current = onChange;
    onInlinePromptRef.current = onInlinePrompt;
    onHistoryChangeRef.current = onHistoryChange;

    const initialValueRef = useRef(value);

    // -----------------------------------------------------------------------
    // Report undo/redo availability
    // -----------------------------------------------------------------------

    const reportHistory = useCallback((editor: Editor) => {
      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          onHistoryChangeRef.current?.({
            canUndo: undoDepth(view.state) > 0,
            canRedo: redoDepth(view.state) > 0,
          });
        });
      } catch {
        // Editor may not be ready yet
      }
    }, []);

    // -----------------------------------------------------------------------
    // Imperative handle
    // -----------------------------------------------------------------------

    useImperativeHandle(ref, () => ({
      undo: () => {
        const editor = editorRef.current;
        if (!editor || !editorReadyRef.current) return;
        editor.action(callCommand(undoCommand.key));
        reportHistory(editor);
      },
      redo: () => {
        const editor = editorRef.current;
        if (!editor || !editorReadyRef.current) return;
        editor.action(callCommand(redoCommand.key));
        reportHistory(editor);
      },
      focus: () => {
        const editor = editorRef.current;
        if (!editor || !editorReadyRef.current) return;
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.focus();
        });
      },
      getSelectionRange: () => {
        const editor = editorRef.current;
        if (!editor || !editorReadyRef.current) return null;

        let range: SelectionRange | null = null;
        editor.action((ctx) => {
          range = mapSelectionToMarkdown(ctx, frontmatterRef.current.length);
        });
        return range;
      },
    }));

    // -----------------------------------------------------------------------
    // Initialize Milkdown editor (vanilla API, like CodeMirror approach)
    // -----------------------------------------------------------------------

    useEffect(() => {
      if (!containerRef.current) return;

      const { frontmatter: fm, body } = splitFrontmatter(initialValueRef.current);
      frontmatterRef.current = fm;
      setFrontmatter(fm);

      let destroyed = false;
      const container = containerRef.current;

      void (async () => {
        const { Editor: MilkdownEditor } = await import('@milkdown/kit/core');

        if (destroyed) return;

        const editor = await MilkdownEditor.make()
          .config((ctx) => {
            ctx.set(rootCtx, container);
            ctx.set(defaultValueCtx, body);
          })
          .config((ctx) => {
            const lm = ctx.get(listenerCtx);
            lm.markdownUpdated((_ctx, md, prevMd) => {
              if (md !== prevMd) {
                const full = joinFrontmatter(frontmatterRef.current, md);
                onChangeRef.current(full);
              }
            });
          })
          .use(commonmark)
          .use(listener)
          .use(history)
          .create();

        if (destroyed) {
          void editor.destroy();
          return;
        }

        editorRef.current = editor;
        editorReadyRef.current = true;

        // Wire Cmd+K / Ctrl+K for inline prompt
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const originalHandleKeyDown = view.props.handleKeyDown;
          view.setProps({
            handleKeyDown: (innerView, event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                const sel = mapSelectionToMarkdown(ctx, frontmatterRef.current.length);
                onInlinePromptRef.current?.(sel);
                return true;
              }
              return originalHandleKeyDown?.(innerView, event) ?? false;
            },
          });
        });

        // Set initial readOnly
        if (readOnly) {
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            view.setProps({ editable: () => false });
          });
        }

        // Subscribe to transactions for history change reporting
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const originalDispatchTransaction = view.props.dispatchTransaction;
          view.setProps({
            dispatchTransaction: function dispatchTx(tr) {
              if (originalDispatchTransaction) {
                originalDispatchTransaction.call(view, tr);
              } else {
                view.updateState(view.state.apply(tr));
              }
              if (tr.docChanged) {
                onHistoryChangeRef.current?.({
                  canUndo: undoDepth(view.state) > 0,
                  canRedo: redoDepth(view.state) > 0,
                });
              }
            },
          });
        });

        onHistoryChangeRef.current?.({ canUndo: false, canRedo: false });
      })();

      return () => {
        destroyed = true;
        editorReadyRef.current = false;
        const editor = editorRef.current;
        if (editor) {
          void editor.destroy();
          editorRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // -----------------------------------------------------------------------
    // Sync external value changes
    // -----------------------------------------------------------------------

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || !editorReadyRef.current) return;

      let currentBody: string;
      try {
        currentBody = editor.action(getMarkdown());
      } catch {
        return;
      }
      const currentFull = joinFrontmatter(frontmatterRef.current, currentBody);

      if (value === currentFull) return;

      const { frontmatter: fm, body } = splitFrontmatter(value);
      frontmatterRef.current = fm;
      setFrontmatter(fm);

      editor.action(replaceAll(body));
    }, [value]);

    // -----------------------------------------------------------------------
    // Sync readOnly
    // -----------------------------------------------------------------------

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || !editorReadyRef.current) return;

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.setProps({ editable: () => !readOnly });
      });
    }, [readOnly]);

    // -----------------------------------------------------------------------
    // Frontmatter edit handler
    // -----------------------------------------------------------------------

    const handleFrontmatterChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newFm = event.target.value;
      frontmatterRef.current = newFm;
      setFrontmatter(newFm);

      const editor = editorRef.current;
      if (!editor || !editorReadyRef.current) return;

      let currentBody: string;
      try {
        currentBody = editor.action(getMarkdown());
      } catch {
        return;
      }
      const full = joinFrontmatter(newFm, currentBody);
      onChangeRef.current(full);
    }, []);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
      <div className="flex h-full flex-col overflow-hidden rounded-md">
        {/* Frontmatter collapsible section */}
        {frontmatter ? (
          <div className="border-edge border-b">
            <button
              type="button"
              onClick={() => setShowFrontmatter((prev) => !prev)}
              className="text-dim hover:text-mid flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-medium"
            >
              <span
                className="inline-block transition-transform"
                style={{
                  transform: showFrontmatter ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                &#9654;
              </span>
              Frontmatter
            </button>
            {showFrontmatter ? (
              <textarea
                value={frontmatter}
                onChange={handleFrontmatterChange}
                readOnly={readOnly}
                spellCheck={false}
                className="bg-card text-light w-full resize-none border-none px-3 py-2 font-mono text-xs leading-relaxed outline-none"
                style={{ fontFamily: 'var(--font-mono)' }}
                rows={frontmatter.split('\n').length}
              />
            ) : null}
          </div>
        ) : null}

        {/* Rich markdown editor container */}
        <div
          ref={containerRef}
          className="milkdown-editor min-h-0 flex-1 overflow-auto px-4 py-3"
        />
      </div>
    );
  },
);

RichMarkdownEditor.displayName = 'RichMarkdownEditor';
