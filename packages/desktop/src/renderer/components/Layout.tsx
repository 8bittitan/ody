import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/hooks/useApp';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import type { MenuAction } from '@/types/ipc';
import { CircleHelp, FolderPlus, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { AgentRunner } from './AgentRunner';
import { ArchiveViewer } from './ArchiveViewer';
import { AuthPanel } from './AuthPanel';
import { ConfigEditor } from './ConfigEditor';
import { ConfigPanel } from './ConfigPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { GenerationOutput } from './GenerationOutput';
import { InitWizard } from './InitWizard';
import { PlanCreator } from './PlanCreator';
import { SettingsModal } from './SettingsModal';
import { Sidebar, type ViewId } from './Sidebar';
import { TaskBoard } from './TaskBoard';
import { TaskEditor } from './TaskEditor';
import { TaskImport } from './TaskImport';

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

export const Layout = () => {
  const [activeView, setActiveView] = useState<ViewId>('tasks');
  const [pendingSwitchPath, setPendingSwitchPath] = useState<string | null>(null);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [showInitWizard, setShowInitWizard] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { projects, activeProjectPath, isLoading, addProject, removeProject, switchProject } =
    useProjects();
  const isRunning = useStore((state) => state.isRunning);
  const setConfigEditorPath = useStore((state) => state.setConfigEditorPath);
  const resetAgentState = useStore((state) => state.resetAgentState);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const { loadConfig, config } = useConfig();
  const { loadTasks, setSelectedTaskPath } = useTasks();
  const { accent, info, warning, success, error } = useNotifications();
  const { isFullscreen } = useApp();
  const backendName = typeof config?.backend === 'string' ? config.backend : 'opencode';

  const [planStreamOutput, setPlanStreamOutput] = useState('');
  const [isPlanGenerating, setIsPlanGenerating] = useState(false);
  const isPlanGeneratingRef = useRef(false);

  const resetPlanStream = useCallback(() => {
    setPlanStreamOutput('');
  }, []);

  useEffect(() => {
    const onOutput = api.agent.onOutput((chunk) => {
      if (!isPlanGeneratingRef.current) {
        return;
      }

      setPlanStreamOutput((prev) => `${prev}${chunk}`);
    });

    const finish = () => {
      if (!isPlanGeneratingRef.current) {
        return;
      }

      isPlanGeneratingRef.current = false;
      setIsPlanGenerating(false);
      void loadTasks().catch(() => {
        return;
      });
    };

    const onComplete = api.agent.onComplete(() => {
      finish();
      success({ title: 'Plan generation finished' });
    });

    const onStopped = api.agent.onStopped(() => {
      finish();
    });

    const onVerifyFailed = api.agent.onVerifyFailed((message) => {
      if (!isPlanGeneratingRef.current) {
        return;
      }

      isPlanGeneratingRef.current = false;
      setIsPlanGenerating(false);
      error({ title: 'Plan generation failed', description: message });
    });

    return () => {
      onOutput();
      onComplete();
      onStopped();
      onVerifyFailed();
    };
  }, [error, loadTasks, success]);
  const activeProject = useMemo(() => {
    if (!activeProjectPath) {
      return null;
    }

    return projects.find((project) => project.path === activeProjectPath) ?? null;
  }, [activeProjectPath, projects]);

  useEffect(() => {
    if (!activeProjectPath) {
      setShowInitWizard(false);
      return;
    }

    let isMounted = true;

    resetAgentState();

    void (async () => {
      try {
        const result = await loadConfig();
        if (!isMounted) {
          return;
        }

        setShowInitWizard(result.merged === null);
      } catch {
        if (!isMounted) {
          return;
        }

        setShowInitWizard(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeProjectPath, loadConfig, resetAgentState]);

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
    if (!pendingSwitchPath) {
      return;
    }

    setShowSwitchDialog(false);
    await applySwitch(pendingSwitchPath);
    setPendingSwitchPath(null);
    warning({ title: 'Agent state reset for project switch' });
  };

  const handleCancelSwitch = () => {
    setShowSwitchDialog(false);
    setPendingSwitchPath(null);
  };

  const handleRemoveProject = async (path: string) => {
    await removeProject(path);
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

  useEffect(() => {
    return window.ody.app.onMenuAction((action) => {
      const handleAction = async (menuAction: MenuAction) => {
        if (menuAction === 'project:add') {
          await handleAddProject();
          return;
        }

        if (menuAction === 'view:tasks') {
          setActiveView('tasks');
          return;
        }

        if (menuAction === 'view:run') {
          setActiveView('run');
          return;
        }

        if (menuAction === 'view:plan') {
          setActiveView('plan');
          return;
        }

        if (menuAction === 'view:config') {
          setActiveView('config');
          return;
        }

        if (menuAction === 'editor:save') {
          window.dispatchEvent(new CustomEvent('ody:save-editor'));
        }
      };

      void handleAction(action);
    });
  }, [handleAddProject]);

  useEffect(() => {
    const onViewRun: EventListener = () => {
      setActiveView('run');
    };

    window.addEventListener('ody:view-run', onViewRun);
    return () => {
      window.removeEventListener('ody:view-run', onViewRun);
    };
  }, []);

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
                void handleProjectSelect(path);
              }}
              onAddProject={() => {
                void handleAddProject();
              }}
              onRemoveProject={(path) => {
                void handleRemoveProject(path);
              }}
              onCopyProjectPath={(path) => {
                void handleCopyProjectPath(path);
              }}
              activeView={activeView}
              onViewSelect={setActiveView}
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
                        void handleAddProject();
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
                            void loadTasks().catch(() => {
                              return;
                            });
                          }}
                        >
                          Refresh
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveView('plan');
                          }}
                        >
                          New Task
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 px-6 py-4">
                    {activeView === 'tasks' ? (
                      <ErrorBoundary title="Task view error">
                        <TaskBoard
                          onOpenPlan={() => {
                            setActiveView('plan');
                          }}
                          onOpenArchive={() => {
                            setActiveView('archive');
                          }}
                          onOpenEditor={(taskPath) => {
                            setSelectedTaskPath(taskPath);
                            setActiveView('editor');
                          }}
                        />
                      </ErrorBoundary>
                    ) : activeView === 'run' ? (
                      <ErrorBoundary title="Run view error">
                        <AgentRunner />
                      </ErrorBoundary>
                    ) : activeView === 'config' ? (
                      <ErrorBoundary title="Config view error">
                        <ConfigPanel
                          onOpenInitWizard={() => {
                            setShowInitWizard(true);
                          }}
                          onEditJson={(configPath) => {
                            setConfigEditorPath(configPath);
                            setActiveView('config-editor');
                          }}
                        />
                      </ErrorBoundary>
                    ) : activeView === 'config-editor' ? (
                      <ErrorBoundary title="Config editor view error">
                        <ConfigEditor
                          onBack={() => {
                            setConfigEditorPath(null);
                            setActiveView('config');
                          }}
                        />
                      </ErrorBoundary>
                    ) : activeView === 'plan' ? (
                      <ErrorBoundary title="Plan view error">
                        <div className="grid h-full gap-3 lg:grid-cols-[1.25fr_0.75fr]">
                          <PlanCreator
                            isGenerating={isPlanGenerating}
                            isGeneratingRef={isPlanGeneratingRef}
                            setIsGenerating={setIsPlanGenerating}
                            setStreamOutput={setPlanStreamOutput}
                            resetStream={resetPlanStream}
                          />
                          <GenerationOutput
                            streamOutput={planStreamOutput}
                            isGenerating={isPlanGenerating}
                            onOpenTaskBoard={() => {
                              setActiveView('tasks');
                            }}
                          />
                        </div>
                      </ErrorBoundary>
                    ) : activeView === 'auth' ? (
                      <ErrorBoundary title="Auth view error">
                        <AuthPanel />
                      </ErrorBoundary>
                    ) : activeView === 'import' ? (
                      <ErrorBoundary title="Import view error">
                        <TaskImport
                          config={config}
                          onOpenAuth={() => {
                            setActiveView('auth');
                          }}
                          onOpenTaskBoard={() => {
                            setActiveView('tasks');
                          }}
                        />
                      </ErrorBoundary>
                    ) : activeView === 'archive' ? (
                      <ErrorBoundary title="Archive view error">
                        <ArchiveViewer />
                      </ErrorBoundary>
                    ) : activeView === 'editor' ? (
                      <ErrorBoundary title="Editor view error">
                        <TaskEditor
                          onBack={() => {
                            setSelectedTaskPath(null);
                            setActiveView('tasks');
                          }}
                        />
                      </ErrorBoundary>
                    ) : (
                      <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
                        <h2 className="text-light text-sm font-medium">View</h2>
                        <p className="text-mid mt-2 text-sm">
                          Active view is switched from the sidebar without route navigation.
                        </p>
                      </section>
                    )}
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
              This resets the current run state and reloads project config and tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={handleCancelSwitch}
            >
              Keep current project
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-accent-hover rounded-md px-3 py-2 text-sm"
              onClick={() => {
                void handleConfirmSwitch();
              }}
            >
              Switch project
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InitWizard
        open={showInitWizard}
        onOpenChange={setShowInitWizard}
        onInitialized={() => {
          void loadConfig();
          void loadTasks();
        }}
      />

      <SettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        activeProjectPath={activeProjectPath}
        onBrowseProject={handleBrowseProject}
        onOpenConfigView={() => {
          setActiveView('config');
        }}
      />
    </div>
  );
};
