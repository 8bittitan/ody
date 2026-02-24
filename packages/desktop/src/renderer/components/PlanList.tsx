import { useTasks } from '@/hooks/useTasks';

export const PlanList = () => {
  const { tasks } = useTasks();
  const pendingTasks = tasks.filter((task) => task.status === 'pending');

  return (
    <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-light text-sm font-medium">Pending Tasks</h2>
        <span className="text-dim border-edge rounded border px-1.5 py-0.5 text-[10px]">
          {pendingTasks.length}
        </span>
      </header>

      <div className="space-y-2 overflow-auto">
        {pendingTasks.map((task) => (
          <article key={task.filePath} className="bg-background border-edge rounded border p-2">
            <h3 className="text-light text-sm">{task.title}</h3>
            <p className="text-dim mt-1 line-clamp-2 text-xs">{task.description}</p>
          </article>
        ))}

        {pendingTasks.length === 0 ? (
          <p className="text-dim border-edge rounded border border-dashed px-3 py-8 text-center text-xs">
            No pending tasks.
          </p>
        ) : null}
      </div>
    </section>
  );
};
