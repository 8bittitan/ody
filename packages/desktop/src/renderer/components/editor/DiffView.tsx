import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import { odyDiffTheme, odySyntax } from './theme';

type DiffViewProps = {
  original: string;
  proposed: string;
  onProposedChange: (value: string) => void;
};

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
          odySyntax,
          odyDiffTheme,
        ],
      },
      b: {
        doc: proposed,
        extensions: [
          odySyntax,
          odyDiffTheme,
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
