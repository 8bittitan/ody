import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { odyDiffTheme, odySyntax } from './theme';

type DiffViewProps = {
  original: string;
  proposed: string;
  onProposedChange: (value: string) => void;
};

export const DiffView = ({ original, proposed, onProposedChange }: DiffViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const onProposedChangeRef = useRef(onProposedChange);
  const initialOriginalRef = useRef(original);
  const initialProposedRef = useRef(proposed);
  const isSyncingProposedRef = useRef(false);

  useLayoutEffect(() => {
    onProposedChangeRef.current = onProposedChange;
  });

  useEffect(() => {
    if (!containerRef.current || mergeViewRef.current) {
      return;
    }

    const mergeView = new MergeView({
      parent: containerRef.current,
      a: {
        doc: initialOriginalRef.current,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          odySyntax,
          odyDiffTheme,
        ],
      },
      b: {
        doc: initialProposedRef.current,
        extensions: [
          odySyntax,
          odyDiffTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !isSyncingProposedRef.current) {
              onProposedChangeRef.current(update.state.doc.toString());
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
  }, []);

  useEffect(() => {
    const originalView = mergeViewRef.current?.a;
    if (!originalView) {
      return;
    }

    const currentOriginal = originalView.state.doc.toString();
    if (original === currentOriginal) {
      return;
    }

    originalView.dispatch({
      changes: {
        from: 0,
        to: originalView.state.doc.length,
        insert: original,
      },
    });
  }, [original]);

  useEffect(() => {
    const proposedView = mergeViewRef.current?.b;
    if (!proposedView) {
      return;
    }

    const currentProposed = proposedView.state.doc.toString();
    if (proposed === currentProposed) {
      return;
    }

    isSyncingProposedRef.current = true;
    proposedView.dispatch({
      changes: {
        from: 0,
        to: proposedView.state.doc.length,
        insert: proposed,
      },
    });
    isSyncingProposedRef.current = false;
  }, [proposed]);

  return (
    <div ref={containerRef} className="border-edge h-full overflow-hidden rounded-md border" />
  );
};
