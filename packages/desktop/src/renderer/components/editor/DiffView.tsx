import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';

type DiffViewProps = {
  original: string;
  proposed: string;
  onProposedChange: (value: string) => void;
};

const diffTheme = EditorView.theme({
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
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-mergeView .cm-changedLine': {
    backgroundColor: 'rgb(0 245 212 / 8%)',
  },
});

export const DiffView = ({ original, proposed, onProposedChange }: DiffViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
      containerRef.current.innerHTML = '';
    }

    const mergeView = new MergeView({
      parent: containerRef.current,
      a: {
        doc: original,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          oneDark,
          diffTheme,
        ],
      },
      b: {
        doc: proposed,
        extensions: [
          oneDark,
          diffTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onProposedChange(update.state.doc.toString());
            }
          }),
        ],
      },
      orientation: 'a-b',
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    mergeViewRef.current = mergeView;

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
  }, [onProposedChange, original, proposed]);

  return (
    <div ref={containerRef} className="border-edge h-full overflow-hidden rounded-md border" />
  );
};
