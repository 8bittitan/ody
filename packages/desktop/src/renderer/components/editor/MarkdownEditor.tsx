import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { odyEditorTheme, odySyntax } from './theme';

type SelectionRange = {
  from: number;
  to: number;
};

type MarkdownEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  language?: 'markdown' | 'json';
  readOnly?: boolean;
  highlightedRange?: SelectionRange | null;
  onInlinePrompt?: (selection: SelectionRange | null) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

export type MarkdownEditorHandle = {
  undo: () => void;
  redo: () => void;
  focus: () => void;
  getSelectionRange: () => SelectionRange | null;
};

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      value,
      onChange,
      language = 'markdown',
      readOnly = false,
      highlightedRange = null,
      onInlinePrompt,
      onHistoryChange,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const readOnlyCompartment = useRef(new Compartment());
    const highlightCompartment = useRef(new Compartment());
    const keymapCompartment = useRef(new Compartment());

    // Stable refs for mutable callbacks — the CodeMirror extensions read from
    // these so the editor never needs to be torn down when callbacks change.
    const onChangeRef = useRef(onChange);
    const onInlinePromptRef = useRef(onInlinePrompt);
    const onHistoryChangeRef = useRef(onHistoryChange);

    // Keep refs in sync with latest props on every render.
    onChangeRef.current = onChange;
    onInlinePromptRef.current = onInlinePrompt;
    onHistoryChangeRef.current = onHistoryChange;

    // Capture the initial value for the editor doc so we don't depend on
    // the `value` prop inside the initialization effect.
    const initialValueRef = useRef(value);

    const buildHighlightDecorations = (range: SelectionRange | null, docLength: number) => {
      if (!range || range.from >= range.to) {
        return Decoration.none;
      }

      const from = Math.max(0, Math.min(range.from, docLength));
      const to = Math.max(0, Math.min(range.to, docLength));

      if (from >= to) {
        return Decoration.none;
      }

      const builder = new RangeSetBuilder<Decoration>();
      builder.add(from, to, Decoration.mark({ class: 'cm-inline-highlight' }));
      return builder.finish();
    };

    const syncHistory = (state: EditorState) => {
      onHistoryChangeRef.current?.({
        canUndo: undoDepth(state) > 0,
        canRedo: redoDepth(state) > 0,
      });
    };

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (!viewRef.current) {
          return;
        }

        undo(viewRef.current);
        syncHistory(viewRef.current.state);
      },
      redo: () => {
        if (!viewRef.current) {
          return;
        }

        redo(viewRef.current);
        syncHistory(viewRef.current.state);
      },
      focus: () => {
        viewRef.current?.focus();
      },
      getSelectionRange: () => {
        if (!viewRef.current) {
          return null;
        }

        const { from, to } = viewRef.current.state.selection.main;
        if (from === to) {
          return null;
        }

        return { from, to };
      },
    }));

    // Initialize the CodeMirror EditorView once. The only dependency is
    // `language` which determines the parser extension and is static per
    // editor session. All mutable props are read via refs so the editor
    // is never destroyed and recreated during normal editing.
    useEffect(() => {
      if (!containerRef.current || viewRef.current) {
        return;
      }

      const doc = initialValueRef.current;

      const startState = EditorState.create({
        doc,
        extensions: [
          basicSetup,
          language === 'json' ? json() : markdown(),
          odySyntax,
          odyEditorTheme,
          EditorView.lineWrapping,
          readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
          highlightCompartment.current.of(
            EditorView.decorations.of(buildHighlightDecorations(highlightedRange, doc.length)),
          ),
          keymapCompartment.current.of(
            keymap.of([
              {
                key: 'Mod-k',
                run: (view) => {
                  const { from, to } = view.state.selection.main;
                  onInlinePromptRef.current?.(from === to ? null : { from, to });
                  return true;
                },
              },
            ]),
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }

            if (update.docChanged || update.transactions.some((txn) => txn.isUserEvent('undo'))) {
              syncHistory(update.state);
            }
          }),
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: containerRef.current,
      });

      viewRef.current = view;
      syncHistory(view.state);

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    useEffect(() => {
      if (!viewRef.current) {
        return;
      }

      const currentValue = viewRef.current.state.doc.toString();
      if (value === currentValue) {
        return;
      }

      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }, [value]);

    useEffect(() => {
      if (!viewRef.current) {
        return;
      }

      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
      });
    }, [readOnly]);

    useEffect(() => {
      if (!viewRef.current) {
        return;
      }

      const docLength = viewRef.current.state.doc.length;
      viewRef.current.dispatch({
        effects: highlightCompartment.current.reconfigure(
          EditorView.decorations.of(buildHighlightDecorations(highlightedRange, docLength)),
        ),
      });
    }, [highlightedRange]);

    return (
      <div
        ref={containerRef}
        className="border-edge h-full overflow-hidden rounded-md border [&_.cm-inline-highlight]:bg-[rgb(0_245_212/12%)]"
      />
    );
  },
);

MarkdownEditor.displayName = 'MarkdownEditor';
