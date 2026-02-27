import { useCallback, useRef, useState } from 'react';

type TooltipProps = {
  content: string;
  side?: 'right' | 'top' | 'bottom';
  children: React.ReactNode;
};

export const Tooltip = ({ content, side = 'right', children }: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, 200);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  const positionClasses =
    side === 'right'
      ? 'left-full top-1/2 -translate-y-1/2 ml-2'
      : side === 'top'
        ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
        : 'top-full left-1/2 -translate-x-1/2 mt-2';

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={[
            'bg-panel border-edge text-light pointer-events-none absolute z-50 whitespace-nowrap rounded border px-2 py-1 text-xs shadow-md',
            positionClasses,
          ].join(' ')}
        >
          {content}
        </div>
      )}
    </div>
  );
};
