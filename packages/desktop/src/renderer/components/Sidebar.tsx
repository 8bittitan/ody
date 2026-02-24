import { Tooltip } from '@/components/ui/tooltip';
import {
  Archive,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Import,
  KeyRound,
  PlayCircle,
  Plus,
  Settings2,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type Project = {
  path: string;
  name: string;
};

export type ViewId =
  | 'tasks'
  | 'run'
  | 'plan'
  | 'import'
  | 'config'
  | 'config-editor'
  | 'auth'
  | 'archive'
  | 'editor';

type SidebarProps = {
  projects: Project[];
  activeProjectPath: string | null;
  onProjectSelect: (projectPath: string) => void;
  onAddProject: () => void;
  onRemoveProject: (projectPath: string) => void;
  onCopyProjectPath: (projectPath: string) => void;
  activeView: ViewId;
  onViewSelect: (viewId: ViewId) => void;
  backendName: string;
  agentState: 'idle' | 'running';
  isLoadingProjects: boolean;
  collapsed: boolean;
  onToggle: () => void;
};

type ViewItem = {
  id: ViewId;
  label: string;
  Icon: typeof CheckSquare;
};

const VIEW_ITEMS: ViewItem[] = [
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare },
  { id: 'run', label: 'Run', Icon: PlayCircle },
  { id: 'plan', label: 'Plan', Icon: WandSparkles },
  { id: 'import', label: 'Import', Icon: Import },
  { id: 'config', label: 'Config', Icon: Settings2 },
  { id: 'auth', label: 'Auth', Icon: KeyRound },
  { id: 'archive', label: 'Archive', Icon: Archive },
];

export const Sidebar = ({
  projects,
  activeProjectPath,
  onProjectSelect,
  onAddProject,
  onRemoveProject,
  onCopyProjectPath,
  activeView,
  onViewSelect,
  backendName,
  agentState,
  isLoadingProjects,
  collapsed,
  onToggle,
}: SidebarProps) => {
  const [contextMenu, setContextMenu] = useState<{
    projectPath: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => {
      setContextMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  const contextProject = contextMenu
    ? projects.find((project) => project.path === contextMenu.projectPath)
    : null;

  return (
    <aside
      className={[
        'bg-panel border-edge flex shrink-0 flex-col border-r transition-all duration-200',
        collapsed ? 'w-14' : 'w-56',
      ].join(' ')}
    >
      <section className="border-edge border-b p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Tooltip content="Add project">
              <button
                type="button"
                onClick={onAddProject}
                className="text-primary hover:text-accent-hover flex size-8 items-center justify-center rounded"
                aria-label="Add project"
              >
                <Plus className="size-3.5" />
              </button>
            </Tooltip>
            {isLoadingProjects && <div className="bg-dim mx-auto h-1 w-4 animate-pulse rounded" />}
            {projects.map((project) => {
              const isActive = project.path === activeProjectPath;
              const initial = project.name.charAt(0).toUpperCase();

              return (
                <Tooltip key={project.path} content={project.name}>
                  <button
                    type="button"
                    onClick={() => onProjectSelect(project.path)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        projectPath: project.path,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    className={[
                      'flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors',
                      isActive
                        ? 'border-primary/35 bg-accent-bg text-primary'
                        : 'text-light border-transparent hover:border-edge hover:bg-accent-bg',
                    ].join(' ')}
                    aria-label={project.name}
                  >
                    {initial}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-dim text-xs font-semibold tracking-[0.14em] uppercase">
                Projects
              </h2>
              <button
                type="button"
                onClick={onAddProject}
                className="text-primary hover:text-accent-hover rounded px-1.5 py-0.5 text-xs"
              >
                + Add
              </button>
            </div>

            <div className="space-y-1">
              {isLoadingProjects && (
                <p className="text-dim px-2 py-1 text-xs">Loading projects...</p>
              )}
              {!isLoadingProjects && projects.length === 0 && (
                <p className="text-dim px-2 py-1 text-xs">No projects added.</p>
              )}
              {projects.map((project) => {
                const isActive = project.path === activeProjectPath;

                return (
                  <button
                    key={project.path}
                    type="button"
                    onClick={() => onProjectSelect(project.path)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        projectPath: project.path,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    className={[
                      'text-light hover:bg-accent-bg flex w-full items-center truncate rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                      isActive
                        ? 'border-primary/35 bg-accent-bg text-primary'
                        : 'border-transparent hover:border-edge',
                    ].join(' ')}
                    title={project.path}
                  >
                    <span className="truncate">{project.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="min-h-0 flex-1 p-3">
        {!collapsed && (
          <h2 className="text-dim mb-2 text-xs font-semibold tracking-[0.14em] uppercase">Views</h2>
        )}
        <nav className="space-y-1">
          {VIEW_ITEMS.map(({ id, label, Icon }) => {
            const isActive = id === activeView;

            if (collapsed) {
              return (
                <Tooltip key={id} content={label}>
                  <button
                    type="button"
                    onClick={() => onViewSelect(id)}
                    className={[
                      'text-mid hover:text-light flex w-full items-center justify-center rounded-md border p-2 transition-colors',
                      isActive
                        ? 'border-primary/35 bg-accent-bg text-primary'
                        : 'border-transparent hover:border-edge hover:bg-accent-bg/50',
                    ].join(' ')}
                    aria-label={label}
                  >
                    <Icon className="size-3.5" />
                  </button>
                </Tooltip>
              );
            }

            return (
              <button
                key={id}
                type="button"
                onClick={() => onViewSelect(id)}
                className={[
                  'text-mid hover:text-light flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors',
                  isActive
                    ? 'border-primary/35 bg-accent-bg text-primary'
                    : 'border-transparent hover:border-edge hover:bg-accent-bg/50',
                ].join(' ')}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <section className="border-edge border-t">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 px-1 py-2">
            <Tooltip content={`Backend: ${backendName}`}>
              <div className="text-dim text-[10px]">
                <Settings2 className="size-3" />
              </div>
            </Tooltip>
            <Tooltip content={`Agent: ${agentState}`}>
              <div>
                <span
                  className={[
                    'inline-block size-2 rounded-full',
                    agentState === 'running' ? 'bg-primary animate-pulse-status' : 'bg-mid',
                  ].join(' ')}
                />
              </div>
            </Tooltip>
          </div>
        ) : (
          <div className="text-dim px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Backend</span>
              <span className="text-light font-mono text-[11px]">{backendName}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Agent</span>
              <span className={agentState === 'running' ? 'text-primary' : 'text-mid'}>
                {agentState}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="border-edge border-t p-2">
        <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <button
            type="button"
            onClick={onToggle}
            className="text-dim hover:text-light hover:bg-accent-bg flex w-full items-center justify-center rounded-md p-1.5 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="size-3.5" />
            ) : (
              <ChevronsLeft className="size-3.5" />
            )}
          </button>
        </Tooltip>
      </section>

      {contextMenu && contextProject && (
        <div
          className="bg-panel border-edge fixed z-50 min-w-36 rounded-md border p-1 shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            className="hover:bg-accent-bg block w-full rounded px-2 py-1 text-left text-xs"
            onClick={() => {
              onProjectSelect(contextProject.path);
              setContextMenu(null);
            }}
          >
            Open
          </button>
          <button
            type="button"
            className="hover:bg-accent-bg block w-full rounded px-2 py-1 text-left text-xs"
            onClick={() => {
              onCopyProjectPath(contextProject.path);
              setContextMenu(null);
            }}
          >
            Copy Path
          </button>
          <button
            type="button"
            className="text-red hover:bg-red/10 block w-full rounded px-2 py-1 text-left text-xs"
            onClick={() => {
              onRemoveProject(contextProject.path);
              setContextMenu(null);
            }}
          >
            Remove
          </button>
        </div>
      )}
    </aside>
  );
};
