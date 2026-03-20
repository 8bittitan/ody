import type { ComboboxOption } from '@/components/ui/combobox';
import { MultiCombobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

import type { TaskStatus } from '../types/ipc';

type TaskFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  labelOptions: ComboboxOption[];
  selectedLabel: string | null;
  onLabelChange: (value: string | null) => void;
  selectedStatus: TaskStatus | 'all';
  onStatusChange: (value: TaskStatus | 'all') => void;
};

const STATUS_OPTIONS: ComboboxOption[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

export const TaskFilters = ({
  search,
  onSearchChange,
  labelOptions,
  selectedLabel,
  onLabelChange,
  selectedStatus,
  onStatusChange,
}: TaskFiltersProps) => {
  return (
    <>
      <section className="border-edge bg-background/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <div className="relative max-w-sm flex-1">
          <Label htmlFor="task-search" className="sr-only">
            Search tasks
          </Label>
          <Search className="text-dim absolute top-2 left-2.5 size-3.5" />
          <Input
            id="task-search"
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            placeholder="Search tasks"
            className="pr-2 pl-8"
          />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <MultiCombobox
          options={labelOptions}
          value={selectedLabel ? [selectedLabel] : []}
          onValueChange={(next) => {
            onLabelChange(next[0] ?? null);
          }}
          placeholder="Filter by label"
          emptyMessage="No labels found."
          className="max-w-xs min-w-[12rem] flex-1"
          label="Label filter"
        />
        <MultiCombobox
          options={STATUS_OPTIONS}
          value={selectedStatus === 'all' ? [] : [selectedStatus]}
          onValueChange={(next) => {
            const nextStatus = next[0];
            if (
              nextStatus === 'pending' ||
              nextStatus === 'in_progress' ||
              nextStatus === 'completed'
            ) {
              onStatusChange(nextStatus);
              return;
            }

            onStatusChange('all');
          }}
          placeholder="Filter by status"
          emptyMessage="No statuses found."
          className="max-w-xs min-w-[12rem] flex-1"
          label="Status filter"
        />
      </section>
    </>
  );
};
