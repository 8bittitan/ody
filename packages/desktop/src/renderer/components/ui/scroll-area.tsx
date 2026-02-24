import { cn } from '@/lib/utils';
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import * as React from 'react';

function ScrollArea({
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative min-h-0 overflow-hidden', className)}
      {...props}
    />
  );
}

function ScrollAreaViewport({
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>) {
  return (
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className={cn('h-full w-full', className)}
      {...props}
    />
  );
}

function ScrollAreaContent({
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Content>) {
  return (
    <ScrollAreaPrimitive.Content
      data-slot="scroll-area-content"
      className={cn(className)}
      {...props}
    />
  );
}

function ScrollAreaScrollbar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'bg-edge/50 pointer-events-none flex touch-none justify-center rounded-full p-0.5 opacity-0 transition-opacity duration-200 select-none',
        'data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0',
        'data-[orientation=horizontal]:my-1.5 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col',
        'data-[orientation=vertical]:my-1.5 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
        className,
      )}
      {...props}
    />
  );
}

function ScrollAreaThumb({
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Thumb>) {
  return (
    <ScrollAreaPrimitive.Thumb
      data-slot="scroll-area-thumb"
      className={cn('bg-dim/40 hover:bg-dim/60 relative flex-1 rounded-full', className)}
      {...props}
    />
  );
}

function ScrollAreaCorner({
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Corner>) {
  return (
    <ScrollAreaPrimitive.Corner
      data-slot="scroll-area-corner"
      className={cn('bg-edge/40', className)}
      {...props}
    />
  );
}

export {
  ScrollArea,
  ScrollAreaViewport,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
};
