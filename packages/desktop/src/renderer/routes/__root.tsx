import { InitWizard } from '@/components/InitWizard';
import { SettingsModal } from '@/components/SettingsModal';
import { Sidebar, type ViewId } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAgent } from '@/hooks/useAgent';
import { useApp } from '@/hooks/useApp';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import type { MenuAction } from '@/types/ipc';
import { Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { CircleHelp, FolderPlus, Play, Settings, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

const VIEW_META: Record<ViewId, { title: string; subtitle: string }> = {
  tasks: { title: 'Task Board', subtitle: 'Review and prioritize your queued work.' },
  run: { title: 'Agent Run', subtitle: 'Monitor execution and watch live output.' },
  plan: { title: 'Plan Operations', subtitle: 'Shape the next set of implementation steps.' },
  import: { title: 'Task Import', subtitle: 'Pull task files into the project workflow.' },
  config: { title: 'Configuration', subtitle: 'Adjust backend, limits, and validator commands.' },
  'config-editor': {
    title: 'Config Editor',
    subtitle: 'Edit local .ody/ody.json directly with syntax highlighting.',
  },
  auth: { title: 'Auth Management', subtitle: 'Manage provider credentials and profiles.' },
  archive: { title: 'Archive', subtitle: 'Inspect completed runs and historical results.' },
  editor: { title: 'Task Editor', subtitle: 'Edit and refine the selected task file.' },
};

const getProjectName = (projectPath: string) => {
  const normalized = projectPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? projectPath;
};

const getActiveViewFromPathname = (pathname: string): ViewId => {
  const view = pathname.slice(1) || 'tasks';
  if (view in VIEW_META) {
    return view as ViewId;
  }

  return 'tasks';
};

const RootLayout = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeView = useMemo(() => getActiveViewFromPathname(pathname), [pathname]);
  const [pendingSwitchPath, setPendingSwitchPath] = useState<string | null>(null);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [isSwitchingProject, setIsSwitchingProject] = useState(false);
  const [initWizardProjectPath, setInitWizardProjectPath] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { projects, activeProjectPath, isLoading, addProject, removeProject, switchProject } =
    useProjects();
  const resetAgentState = useStore((state) => state.resetAgentState);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const { loadConfig, config } = useConfig();
  const { loadTasks } = useTasks();
  const { accent, info, warning, success, error } = useNotifications();
  const { isFullscreen } = useApp();
  const { isRunning, start, stop } = useAgent();
  const backendName = typeof config?.backend === 'string' ? config.backend : '';

  const activeProject = useMemo(() => {
    if (!activeProjectPath) {
      return null;
    }

    return projects.find((project) => project.path === activeProjectPath) ?? null;
  }, [activeProjectPath, projects]);

  const isInitWizardOpen =
    activeProjectPath !== null && initWizardProjectPath === activeProjectPath;

  useEffect(() => {
    if (!activeProjectPath) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const result = await loadConfig();
        if (!isMounted) {
          return;
        }

        setInitWizardProjectPath(result.merged === null ? activeProjectPath : null);
      } catch {
        if (!isMounted) {
          return;
        }

        setInitWizardProjectPath(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeProjectPath, loadConfig]);

  const handleAddProject = useCallback(async () => {
    const project = await addProject();

    if (!project) {
      return;
    }

    success({ title: 'Project added', description: project.name });
  }, [addProject, success]);

  const handleBrowseProject = async () => {
    const project = await addProject();

    if (!project) {
      return null;
    }

    success({ title: 'Project added', description: project.name });
    return project.path;
  };

  const applySwitch = async (path: string) => {
    const switched = await switchProject(path);
    if (!switched) {
      error({ title: 'Project switch failed' });
      return;
    }

    info({ title: 'Project switched', description: getProjectName(path) });
  };

  const handleProjectSelect = async (path: string) => {
    if (path === activeProjectPath) {
      return;
    }

    if (isRunning) {
      setPendingSwitchPath(path);
      setShowSwitchDialog(true);
      return;
    }

    await applySwitch(path);
  };

  const handleConfirmSwitch = async () => {
    if (!pendingSwitchPath || isSwitchingProject) {
      return;
    }

    const nextProjectPath = pendingSwitchPath;
    setIsSwitchingProject(true);

    try {
      await stop(true);
    } catch {
      setIsSwitchingProject(false);
      return;
    }

    const switched = await switchProject(nextProjectPath);

    if (!switched) {
      error({ title: 'Project switch failed' });
      setIsSwitchingProject(false);
      return;
    }

    setShowSwitchDialog(false);
    setPendingSwitchPath(null);
    resetAgentState();
    info({ title: 'Project switched', description: getProjectName(nextProjectPath) });
    warning({
      title: 'Agent stopped before project switch',
      description: 'The active run was force-stopped to keep the previous project from changing.',
    });
    setIsSwitchingProject(false);
  };

  const handleCancelSwitch = () => {
    if (isSwitchingProject) {
      return;
    }

    setShowSwitchDialog(false);
    setPendingSwitchPath(null);
  };

  const handleRemoveProject = async (path: string) => {
    await removeProject(path);
    if (path === activeProjectPath) {
      setInitWizardProjectPath(null);
    }
    success({ title: 'Project removed', description: getProjectName(path) });
  };

  const handleCopyProjectPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      info({ title: 'Copied project path' });
    } catch {
      error({ title: 'Failed to copy path' });
    }
  };

  const handleGlobalRunToggle = async () => {
    if (isRunning) {
      try {
        await stop();
      } catch {
        return;
      }

      warning({ title: 'Agent stop requested' });
      return;
    }

    if (!activeProjectPath) {
      warning({ title: 'Select a project before running the agent' });
      return;
    }

    const autoCommit = typeof config?.autoCommit === 'boolean' ? config.autoCommit : false;

    try {
      const result = await start({
        projectDir: activeProjectPath,
        iterations: 0,
      });

      if (!result.started) {
        warning({ title: 'Agent is already running' });
        return;
      }

      accent({
        title: 'Continuous run started',
        description: autoCommit ? 'Auto-commit enabled.' : undefined,
      });
    } catch {
      return;
    }
  };

  useEffect(() => {
    return window.ody.app.onMenuAction((action) => {
      const handleAction = async (menuAction: MenuAction) => {
        if (menuAction === 'project:add') {
          await handleAddProject();
          return;
        }

        if (menuAction === 'view:tasks') {
          navigate({ to: '/tasks' });
          return;
        }

        if (menuAction === 'view:run') {
          navigate({ to: '/run' });
          return;
        }

        if (menuAction === 'view:plan') {
          navigate({ to: '/plan' });
          return;
        }

        if (menuAction === 'view:config') {
          navigate({ to: '/config' });
          return;
        }

        if (menuAction === 'editor:save') {
          window.dispatchEvent(new CustomEvent('ody:save-editor'));
        }
      };

      handleAction(action);
    });
  }, [handleAddProject, navigate]);

  useEffect(() => {
    const onViewRun: EventListener = () => {
      navigate({ to: '/run' });
    };

    window.addEventListener('ody:view-run', onViewRun);
    return () => {
      window.removeEventListener('ody:view-run', onViewRun);
    };
  }, [navigate]);

  useEffect(() => {
    const onOpenInitWizard: EventListener = () => {
      if (activeProjectPath) {
        setInitWizardProjectPath(activeProjectPath);
      }
    };

    window.addEventListener('ody:open-init-wizard', onOpenInitWizard);
    return () => {
      window.removeEventListener('ody:open-init-wizard', onOpenInitWizard);
    };
  }, [activeProjectPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '[' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [toggleSidebar]);

  return (
    <div className="bg-background text-foreground h-screen overflow-hidden">
      <div className="flex h-full flex-col">
        <header
          className="bg-panel border-edge relative flex h-11 shrink-0 items-center justify-between border-b px-4"
          style={{ WebkitAppRegion: 'drag' } as CSSProperties}
        >
          <div className={cn('flex items-center gap-3', !isFullscreen && 'ml-16')}>
            <div className="text-xs tracking-[0.16em] uppercase">
              <span className="text-primary">ODY</span>
              <span className="text-dim">://Desktop</span>
            </div>
          </div>

          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open settings"
              className="text-dim"
              onClick={() => {
                setShowSettingsModal(true);
                accent({ title: 'Settings opened' });
              }}
            >
              <Settings className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Open help" className="text-dim">
              <CircleHelp className="size-4" />
            </Button>
          </div>
          <div className="from-primary/70 via-primary/20 to-primary/70 absolute inset-x-0 bottom-0 h-px bg-linear-to-r" />
        </header>

        <div className="min-h-0 flex-1">
          <div className="flex h-full">
            <Sidebar
              projects={projects}
              activeProjectPath={activeProjectPath}
              onProjectSelect={(path) => {
                handleProjectSelect(path);
              }}
              onAddProject={() => {
                handleAddProject();
              }}
              onRemoveProject={(path) => {
                handleRemoveProject(path);
              }}
              onCopyProjectPath={(path) => {
                handleCopyProjectPath(path);
              }}
              backendName={backendName}
              agentState={isRunning ? 'running' : 'idle'}
              isLoadingProjects={isLoading}
              collapsed={sidebarCollapsed}
              onToggle={toggleSidebar}
            />

            <main className="bg-grid min-w-0 flex-1">
              {projects.length === 0 && !isLoading ? (
                <div className="flex h-full items-center justify-center p-6">
                  <section className="bg-panel border-edge w-full max-w-lg rounded-lg border p-8 text-center">
                    <FolderPlus className="text-primary mx-auto size-10" />
                    <h1 className="text-bright mt-4 text-xl font-semibold">
                      Add your first project
                    </h1>
                    <p className="text-mid mt-2 text-sm">
                      Choose a folder to get started. Ody will use it as the active project context.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddProject();
                      }}
                      className="bg-primary text-primary-foreground hover:bg-accent-hover mt-5 rounded-md px-4 py-2 text-sm"
                    >
                      Add Project
                    </button>
                  </section>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="border-edge border-b px-6 py-4">
                    <div className="mb-2 flex items-center gap-2 text-xs tracking-[0.12em] uppercase">
                      <span className="bg-primary inline-block h-3 w-px" />
                      <span className="text-dim">Project</span>
                      <span className="text-primary">{activeProject?.name ?? 'None selected'}</span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h1 className="text-bright text-2xl font-semibold">
                          {VIEW_META[activeView].title}
                        </h1>
                        <p className="text-mid mt-1 text-sm">{VIEW_META[activeView].subtitle}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            loadTasks().catch(() => {
                              return;
                            });
                          }}
                        >
                          Refresh
                        </Button>
                        <Button
                          size="sm"
                          variant={isRunning ? 'destructive' : 'default'}
                          disabled={!activeProjectPath}
                          onClick={() => {
                            void handleGlobalRunToggle();
                          }}
                        >
                          {isRunning ? (
                            <Square className="size-3.5" />
                          ) : (
                            <Play className="size-3.5" />
                          )}
                          {isRunning ? 'Stop' : 'Run'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 px-6 py-4">
                    <Outlet />
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>

        <footer className="bg-panel border-edge flex h-7 shrink-0 items-center justify-between border-t px-3 text-xs">
          <div className="text-dim flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className={[
                  'inline-block size-1.5 rounded-full',
                  isRunning ? 'bg-primary animate-pulse-status' : 'bg-mid',
                ].join(' ')}
              />
              {isRunning ? 'running' : 'idle'}
            </span>
            <span>{activeProject?.path ? `${activeProject.path}` : 'No active project'}</span>
          </div>

          <div className="text-dim flex items-center gap-3">
            <span>{backendName}</span>
          </div>
        </footer>
      </div>

      <Dialog
        open={showSwitchDialog}
        onOpenChange={(open) => {
          if (isSwitchingProject) {
            return;
          }

          setShowSwitchDialog(open);

          if (!open) {
            setPendingSwitchPath(null);
          }
        }}
      >
        <DialogContent className="bg-panel border-edge max-w-md">
          <DialogHeader>
            <DialogTitle>Switch projects while agent is running?</DialogTitle>
            <DialogDescription>
              Switching projects will force-stop the current run before Ody changes the active
              project and reloads its config and tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={handleCancelSwitch}
              disabled={isSwitchingProject}
            >
              Keep current project
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-2 text-sm"
              onClick={() => {
                void handleConfirmSwitch();
              }}
              disabled={isSwitchingProject}
            >
              {isSwitchingProject ? 'Stopping run...' : 'Stop and switch'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InitWizard
        open={isInitWizardOpen}
        onOpenChange={(open) => {
          setInitWizardProjectPath(open && activeProjectPath ? activeProjectPath : null);
        }}
        onInitialized={() => {
          loadConfig();
          loadTasks();
        }}
      />

      <SettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        activeProjectPath={activeProjectPath}
        onBrowseProject={handleBrowseProject}
        onOpenConfigView={() => {
          navigate({ to: '/config' });
        }}
      />

      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
};

export const Route = createRootRoute({
  component: RootLayout,
});
