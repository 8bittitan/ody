import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { Decoration, EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

type SelectionRange = {
  from: number;
  to: number;
};

type MarkdownEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
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

const artDecoTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-light)',
    height: '100%',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-panel)',
    color: 'var(--color-dim)',
    borderRight: '1px solid var(--color-edge)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgb(0 245 212 / 5%)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgb(0 245 212 / 5%)',
    color: 'var(--color-light)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgb(0 245 212 / 20%) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-primary)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  '.cm-focused': {
    outline: 'none',
  },
});

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    { value, onChange, readOnly = false, highlightedRange = null, onInlinePrompt, onHistoryChange },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const readOnlyCompartment = useRef(new Compartment());
    const highlightCompartment = useRef(new Compartment());

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
      onHistoryChange?.({
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

    useEffect(() => {
      if (!containerRef.current || viewRef.current) {
        return;
      }

      const startState = EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          oneDark,
          artDecoTheme,
          EditorView.lineWrapping,
          readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
          highlightCompartment.current.of(
            EditorView.decorations.of(buildHighlightDecorations(highlightedRange, value.length)),
          ),
          keymap.of([
            {
              key: 'Mod-k',
              run: (view) => {
                const { from, to } = view.state.selection.main;
                onInlinePrompt?.(from === to ? null : { from, to });
                return true;
              },
            },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
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
    }, [onChange, readOnly, value]);

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
