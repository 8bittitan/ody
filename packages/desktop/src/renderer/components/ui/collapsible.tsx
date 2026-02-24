import { cn } from '@/lib/utils';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';

type CollapsibleProps = Omit<React.ComponentProps<typeof CollapsiblePrimitive.Root>, 'children'> & {
  label: string;
  badge?: string | null;
  children: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
};

function Collapsible({
  className,
  defaultOpen = false,
  label,
  badge,
  children,
  triggerClassName,
  panelClassName,
  ...props
}: CollapsibleProps) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      defaultOpen={defaultOpen}
      className={cn('min-w-0', className)}
      {...props}
    >
      <CollapsiblePrimitive.Trigger
        data-slot="collapsible-trigger"
        className={cn(
          'group/collapsible text-mid hover:text-light flex w-full items-center gap-2 text-xs',
          triggerClassName,
        )}
      >
        <span className="truncate font-medium">{label}</span>
        {badge ? (
          <span className="border-edge bg-panel text-light inline-flex max-w-[60%] items-center truncate rounded-md border px-1.5 py-0.5 text-[11px]">
            {badge}
          </span>
        ) : null}
        <ChevronRight className="text-dim ml-auto size-3.5 shrink-0 transition-transform duration-200 ease-out group-data-[panel-open]/collapsible:rotate-90" />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel
        data-slot="collapsible-panel"
        className={cn(
          "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden",
          panelClassName,
        )}
      >
        <div className="pt-2">{children}</div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  );
}

export { Collapsible };
