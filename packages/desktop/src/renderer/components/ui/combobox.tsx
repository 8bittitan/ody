'use client';

import { cn } from '@/lib/utils';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CheckIcon, XIcon } from 'lucide-react';
import * as React from 'react';

type ComboboxOption = {
  label: string;
  value: string;
};

type MultiComboboxProps = {
  options: ComboboxOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  label?: string;
};

function MultiCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
  className,
  label,
}: MultiComboboxProps) {
  const id = React.useId();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const selectedOptions = React.useMemo(
    () => options.filter((opt) => value.includes(opt.value)),
    [options, value],
  );

  return (
    <ComboboxPrimitive.Root
      items={options}
      itemToStringLabel={(opt: ComboboxOption) => opt.label}
      multiple
      value={selectedOptions}
      onValueChange={(next: ComboboxOption[]) => {
        onValueChange(next.map((opt) => opt.value));
      }}
    >
      <div className={cn('flex flex-col gap-1', className)}>
        {label ? (
          <label className="text-mid text-xs font-medium" htmlFor={id}>
            {label}
          </label>
        ) : null}
        <ComboboxPrimitive.Chips
          className="border-edge bg-panel focus-within:outline-primary/50 relative flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-1"
          ref={containerRef}
        >
          <ComboboxPrimitive.Value>
            {(selected: ComboboxOption[]) => (
              <React.Fragment>
                {selected.map((opt) => (
                  <ComboboxPrimitive.Chip
                    key={opt.value}
                    className="border-edge bg-accent-bg text-light focus-within:border-primary/35 focus-within:bg-primary/10 flex cursor-default items-center gap-1 rounded border py-0.5 pr-1 pl-2 text-xs outline-none"
                    aria-label={opt.label}
                  >
                    {opt.label}
                    <ComboboxPrimitive.ChipRemove
                      className="text-dim hover:text-light rounded p-0.5"
                      aria-label="Remove"
                    >
                      <XIcon className="size-3" />
                    </ComboboxPrimitive.ChipRemove>
                  </ComboboxPrimitive.Chip>
                ))}
                <ComboboxPrimitive.Input
                  id={id}
                  placeholder={selected.length > 0 ? '' : placeholder}
                  className="text-light placeholder:text-dim min-w-[4rem] flex-auto border-0 bg-transparent p-0 px-1 text-xs outline-none"
                />
              </React.Fragment>
            )}
          </ComboboxPrimitive.Value>
        </ComboboxPrimitive.Chips>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          className="z-50 outline-none"
          sideOffset={4}
          anchor={containerRef}
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-popup"
            className="bg-popover text-popover-foreground data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95 max-h-52 min-w-[8rem] overflow-hidden rounded-md border shadow-md"
          >
            <ComboboxPrimitive.Empty className="text-dim px-2 py-3 text-center text-xs">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-52 overflow-y-auto p-1">
              {(opt: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={opt.value}
                  value={opt}
                  className="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-xs outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <span className="absolute right-2 flex size-3.5 items-center justify-center">
                    <ComboboxPrimitive.ItemIndicator>
                      <CheckIcon className="size-3.5" />
                    </ComboboxPrimitive.ItemIndicator>
                  </span>
                  <span className="truncate">{opt.label}</span>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export { MultiCombobox };
export type { ComboboxOption, MultiComboboxProps };
