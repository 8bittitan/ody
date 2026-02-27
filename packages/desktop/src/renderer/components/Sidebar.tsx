import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { Link } from '@tanstack/react-router';
import {
  Archive,
  CheckSquare,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  FolderOpen,
  Import,
  KeyRound,
  PlayCircle,
  Plus,
  Settings2,
  Trash2,
  WandSparkles,
} from 'lucide-react';

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
  backendName,
  agentState,
  isLoadingProjects,
  collapsed,
  onToggle,
}: SidebarProps) => {
  const activeProject = projects.find((p) => p.path === activeProjectPath);

  const dropdownContent = (
    <DropdownMenuContent className="min-w-48">
      <DropdownMenuLabel>Projects</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {isLoadingProjects && <div className="text-dim px-2 py-1.5 text-xs">Loading projects...</div>}
      {!isLoadingProjects && projects.length === 0 && (
        <div className="text-dim px-2 py-1.5 text-xs">No projects added.</div>
      )}
      {projects.length > 0 && (
        <DropdownMenuRadioGroup
          value={activeProjectPath ?? ''}
          onValueChange={(value) => {
            onProjectSelect(value as string);
          }}
        >
          {projects.map((project) => (
            <DropdownMenuRadioItem key={project.path} value={project.path}>
              <span className="truncate">{project.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
      {projects.length > 0 && (
        <>
          <DropdownMenuSeparator />
          {projects.map((project) => (
            <DropdownMenuItem
              key={`copy-${project.path}`}
              onClick={() => onCopyProjectPath(project.path)}
            >
              <Copy className="size-3.5" />
              <span className="truncate">Copy path: {project.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {projects.map((project) => (
            <DropdownMenuItem
              key={`remove-${project.path}`}
              variant="destructive"
              onClick={() => onRemoveProject(project.path)}
            >
              <Trash2 className="size-3.5" />
              <span className="truncate">Remove: {project.name}</span>
            </DropdownMenuItem>
          ))}
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onAddProject}>
        <Plus className="size-3.5" />
        Add Project
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

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
            <DropdownMenu>
              <Tooltip content={activeProject ? activeProject.name : 'Select project'}>
                <DropdownMenuTrigger
                  className={[
                    'flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors',
                    activeProject
                      ? 'border-primary/35 bg-accent-bg text-primary'
                      : 'text-light border-transparent hover:border-edge hover:bg-accent-bg',
                  ].join(' ')}
                  aria-label={activeProject ? activeProject.name : 'Select project'}
                >
                  {isLoadingProjects ? (
                    <div className="bg-dim h-1 w-3 animate-pulse rounded" />
                  ) : activeProject ? (
                    activeProject.name.charAt(0).toUpperCase()
                  ) : (
                    <FolderOpen className="size-3.5" />
                  )}
                </DropdownMenuTrigger>
              </Tooltip>
              {dropdownContent}
            </DropdownMenu>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={[
                'text-light hover:bg-accent-bg flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                activeProject
                  ? 'border-primary/35 bg-accent-bg text-primary'
                  : 'border-transparent hover:border-edge',
              ].join(' ')}
            >
              <span className="truncate">
                {isLoadingProjects
                  ? 'Loading...'
                  : activeProject
                    ? activeProject.name
                    : 'Select project'}
              </span>
              <ChevronDown className="text-dim ml-1 size-3 shrink-0" />
            </DropdownMenuTrigger>
            {dropdownContent}
          </DropdownMenu>
        )}
      </section>

      <section className="min-h-0 flex-1 p-3">
        {!collapsed && (
          <h2 className="text-dim mb-2 text-xs font-semibold tracking-[0.14em] uppercase">Views</h2>
        )}
        <nav className="space-y-1">
          {VIEW_ITEMS.map(({ id, label, Icon }) => {
            if (collapsed) {
              return (
                <Tooltip key={id} content={label}>
                  <Link
                    to={`/${id}`}
                    className="text-mid hover:text-light flex w-full items-center justify-center rounded-md border p-2 transition-colors"
                    activeProps={{ className: 'border-primary/35 bg-accent-bg text-primary' }}
                    inactiveProps={{
                      className: 'border-transparent hover:border-edge hover:bg-accent-bg/50',
                    }}
                    aria-label={label}
                  >
                    <Icon className="size-3.5" />
                  </Link>
                </Tooltip>
              );
            }

            return (
              <Link
                key={id}
                to={`/${id}`}
                className="text-mid hover:text-light flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors"
                activeProps={{ className: 'border-primary/35 bg-accent-bg text-primary' }}
                inactiveProps={{
                  className: 'border-transparent hover:border-edge hover:bg-accent-bg/50',
                }}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </Link>
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
    </aside>
  );
};
