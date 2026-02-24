import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { history, redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { undoDepth, redoDepth } from '@milkdown/kit/prose/history';
import { callCommand, getMarkdown, replaceAll } from '@milkdown/kit/utils';
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
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
// InnerEditor — uses @milkdown/react hooks inside MilkdownProvider
// ---------------------------------------------------------------------------

type InnerEditorProps = {
  body: string;
  readOnly: boolean;
  frontmatterRef: React.RefObject<string>;
  onChangeRef: React.RefObject<(v: string) => void>;
  onInlinePromptRef: React.RefObject<((sel: SelectionRange | null) => void) | undefined>;
  onHistoryChangeRef: React.RefObject<
    ((state: { canUndo: boolean; canRedo: boolean }) => void) | undefined
  >;
};

const InnerEditor = forwardRef<RichMarkdownEditorHandle, InnerEditorProps>(
  ({ body, readOnly, frontmatterRef, onChangeRef, onInlinePromptRef, onHistoryChangeRef }, ref) => {
    const initialBodyRef = useRef(body);
    const lastEmittedBodyRef = useRef(body);
    const propsWiredRef = useRef(false);

    // -----------------------------------------------------------------------
    // Create the editor via useEditor
    // -----------------------------------------------------------------------

    useEditor((root) => {
      return Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialBodyRef.current);
        })
        .config((ctx) => {
          const lm = ctx.get(listenerCtx);
          lm.markdownUpdated((_ctx, md, prevMd) => {
            if (md !== prevMd) {
              lastEmittedBodyRef.current = md;
              const full = joinFrontmatter(frontmatterRef.current, md);
              onChangeRef.current(full);
            }
          });
          lm.updated((ctx) => {
            const view = ctx.get(editorViewCtx);
            onHistoryChangeRef.current?.({
              canUndo: undoDepth(view.state) > 0,
              canRedo: redoDepth(view.state) > 0,
            });
          });
        })
        .use(commonmark)
        .use(listener)
        .use(history);
    }, []);

    const [loading, getEditor] = useInstance();

    // -----------------------------------------------------------------------
    // Report undo/redo availability
    // -----------------------------------------------------------------------

    const reportHistory = useCallback(
      (editor: NonNullable<ReturnType<typeof getEditor>>) => {
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
      },
      [onHistoryChangeRef],
    );

    // -----------------------------------------------------------------------
    // Wire Cmd+K keyboard handler after editor ready
    // -----------------------------------------------------------------------

    useEffect(() => {
      if (loading) return;
      const editor = getEditor();
      if (!editor || propsWiredRef.current) return;

      propsWiredRef.current = true;

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

      onHistoryChangeRef.current?.({ canUndo: false, canRedo: false });
    }, [loading, getEditor, frontmatterRef, onInlinePromptRef, onHistoryChangeRef]);

    // -----------------------------------------------------------------------
    // Imperative handle
    // -----------------------------------------------------------------------

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          if (loading) return;
          const editor = getEditor();
          if (!editor) return;
          editor.action(callCommand(undoCommand.key));
          reportHistory(editor);
        },
        redo: () => {
          if (loading) return;
          const editor = getEditor();
          if (!editor) return;
          editor.action(callCommand(redoCommand.key));
          reportHistory(editor);
        },
        focus: () => {
          if (loading) return;
          const editor = getEditor();
          if (!editor) return;
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            view.focus();
          });
        },
        getSelectionRange: () => {
          if (loading) return null;
          const editor = getEditor();
          if (!editor) return null;

          let range: SelectionRange | null = null;
          editor.action((ctx) => {
            range = mapSelectionToMarkdown(ctx, frontmatterRef.current.length);
          });
          return range;
        },
      }),
      [loading, getEditor, reportHistory, frontmatterRef],
    );

    // -----------------------------------------------------------------------
    // Sync external value changes
    // -----------------------------------------------------------------------

    useEffect(() => {
      if (loading) return;
      const editor = getEditor();
      if (!editor) return;

      // Skip if this body came from our own edit (prevents feedback loop)
      if (body === lastEmittedBodyRef.current) return;

      // External change — sync to editor and update ref
      lastEmittedBodyRef.current = body;
      editor.action(replaceAll(body));
    }, [body, loading, getEditor]);

    // -----------------------------------------------------------------------
    // Sync readOnly
    // -----------------------------------------------------------------------

    useEffect(() => {
      if (loading) return;
      const editor = getEditor();
      if (!editor) return;

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.setProps({ editable: () => !readOnly });
      });
    }, [readOnly, loading, getEditor]);

    // -----------------------------------------------------------------------
    // Render the Milkdown mount point
    // -----------------------------------------------------------------------

    return <Milkdown />;
  },
);

InnerEditor.displayName = 'InnerEditor';

// ---------------------------------------------------------------------------
// RichMarkdownEditor — public component
// ---------------------------------------------------------------------------

export const RichMarkdownEditor = forwardRef<RichMarkdownEditorHandle, RichMarkdownEditorProps>(
  ({ value, onChange, readOnly = false, onInlinePrompt, onHistoryChange }, ref) => {
    const [frontmatter, setFrontmatter] = useState('');
    const [showFrontmatter, setShowFrontmatter] = useState(false);

    // Stable refs for mutable callbacks
    const frontmatterRef = useRef('');
    const onChangeRef = useRef(onChange);
    const onInlinePromptRef = useRef(onInlinePrompt);
    const onHistoryChangeRef = useRef(onHistoryChange);

    onChangeRef.current = onChange;
    onInlinePromptRef.current = onInlinePrompt;
    onHistoryChangeRef.current = onHistoryChange;

    // Derive body from value
    const { frontmatter: fm, body } = splitFrontmatter(value);

    // Keep frontmatter ref and state in sync
    if (fm !== frontmatterRef.current) {
      frontmatterRef.current = fm;
      setFrontmatter(fm);
    }

    // -----------------------------------------------------------------------
    // Frontmatter edit handler
    // -----------------------------------------------------------------------

    const handleFrontmatterChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newFm = event.target.value;
        frontmatterRef.current = newFm;
        setFrontmatter(newFm);

        // Reconstruct full content with current body from the value prop
        const { body: currentBody } = splitFrontmatter(value);
        const full = joinFrontmatter(newFm, currentBody);
        onChangeRef.current(full);
      },
      [value],
    );

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
        <MilkdownProvider>
          <div className="milkdown-editor min-h-0 flex-1 overflow-auto px-4 py-3">
            <InnerEditor
              ref={ref}
              body={body}
              readOnly={readOnly}
              frontmatterRef={frontmatterRef}
              onChangeRef={onChangeRef}
              onInlinePromptRef={onInlinePromptRef}
              onHistoryChangeRef={onHistoryChangeRef}
            />
          </div>
        </MilkdownProvider>
      </div>
    );
  },
);

RichMarkdownEditor.displayName = 'RichMarkdownEditor';
