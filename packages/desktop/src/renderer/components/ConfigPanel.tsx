import {
  createDefaultConfigForm,
  hasLayerValue,
  toConfigFormState,
  toConfigPayload,
  type ConfigFormState,
} from '@/components/config/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Bot, Code, GitFork, Layers, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ConfigPanelProps = {
  onOpenInitWizard: () => void;
  onEditJson: (configPath: string) => void;
};

type FieldSource = 'gui' | 'local' | 'global' | 'default';

type Tab = 'general' | 'model' | 'validation' | 'integrations';

const SOURCE_LABEL: Record<FieldSource, string> = {
  gui: '(gui)',
  local: '(local)',
  global: '(global)',
  default: '(default)',
};

const FIELD_PATHS = {
  backend: ['backend'],
  maxIterations: ['maxIterations'],
  shouldCommit: ['shouldCommit'],
  skipPermissions: ['skipPermissions'],
  agent: ['agent'],
  tasksDir: ['tasksDir'],
  notify: ['notify'],
  validatorCommands: ['validatorCommands'],
  model: ['model'],
  modelRun: ['model', 'run'],
  modelPlan: ['model', 'plan'],
  modelEdit: ['model', 'edit'],
  jiraBaseUrl: ['jira', 'baseUrl'],
  jiraProfile: ['jira', 'profile'],
  githubProfile: ['github', 'profile'],
} as const;

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Layers className="size-3.5" /> },
  { id: 'model', label: 'Model', icon: <Bot className="size-3.5" /> },
  { id: 'validation', label: 'Validation', icon: <ShieldCheck className="size-3.5" /> },
  { id: 'integrations', label: 'Integrations', icon: <GitFork className="size-3.5" /> },
];

const coerceBackends = (backends: string[]) => {
  if (backends.length > 0) {
    return backends;
  }

  return ['opencode', 'claude', 'codex'];
};

const SourceBadge = ({ source }: { source: FieldSource }) => (
  <Badge variant="outline" className="text-dim border-edge rounded-md text-[11px] font-normal">
    {SOURCE_LABEL[source]}
  </Badge>
);

export const ConfigPanel = ({ onOpenInitWizard, onEditJson }: ConfigPanelProps) => {
  const {
    config,
    localConfigPath,
    layers,
    validation,
    isLoading,
    loadConfig,
    saveConfig,
    saveGlobal,
    validateConfig,
    resetGuiOverrides,
  } = useConfig();
  const { success, error, accent } = useNotifications();
  const [form, setForm] = useState<ConfigFormState>(createDefaultConfigForm());
  const [availableBackends, setAvailableBackends] = useState<string[]>([]);
  const [newValidator, setNewValidator] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [isResettingGui, setIsResettingGui] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('general');

  useEffect(() => {
    void loadConfig();
    void api.backends.available().then((result) => {
      setAvailableBackends(coerceBackends(result));
    });
  }, [loadConfig]);

  useEffect(() => {
    setForm(toConfigFormState(config));
  }, [config]);

  const sourceFor = useMemo(() => {
    return (path: readonly string[]): FieldSource => {
      if (hasLayerValue(layers.gui, [...path])) {
        return 'gui';
      }

      if (hasLayerValue(layers.local, [...path])) {
        return 'local';
      }

      if (hasLayerValue(layers.global, [...path])) {
        return 'global';
      }

      return 'default';
    };
  }, [layers.global, layers.gui, layers.local]);

  const save = async (scope: 'gui' | 'global') => {
    const payload = toConfigPayload(form);
    const validationResult = await validateConfig(payload);

    if (!validationResult.valid) {
      error({ title: 'Fix validation errors before saving' });
      return;
    }

    if (scope === 'gui') {
      setIsSavingProject(true);
      try {
        await saveConfig('gui', payload);
        success({ title: 'Saved to project overrides' });
      } finally {
        setIsSavingProject(false);
      }
      return;
    }

    setIsSavingGlobal(true);
    try {
      await saveGlobal(payload);
      success({ title: 'Saved to global config' });
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const addValidator = () => {
    const command = newValidator.trim();
    if (command.length === 0) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      validatorCommands: [...prev.validatorCommands, command],
    }));
    setNewValidator('');
  };

  const removeValidator = (index: number) => {
    setForm((prev) => ({
      ...prev,
      validatorCommands: prev.validatorCommands.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetGui = async () => {
    setIsResettingGui(true);
    try {
      await resetGuiOverrides();
      accent({ title: 'GUI overrides cleared' });
    } finally {
      setIsResettingGui(false);
    }
  };

  if (isLoading && config === null) {
    return <section className="text-mid text-sm">Loading configuration...</section>;
  }

  if (config === null) {
    return (
      <section className="bg-panel border-edge max-w-xl rounded-lg border p-5">
        <h2 className="text-light text-base font-medium">No configuration detected</h2>
        <p className="text-mid mt-2 text-sm">
          This project does not have an Ody config yet. Open the init wizard to create
          `.ody/ody.json`.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            onOpenInitWizard();
          }}
        >
          Open Init Wizard
        </Button>
      </section>
    );
  }

  return (
    <section className="bg-panel border-edge flex h-full flex-col rounded-lg border p-4">
      <header className="border-edge mb-4 flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="text-light text-base font-medium">Config Layers</h2>
          <p className="text-mid mt-1 text-xs">
            Effective config merges GUI overrides, project config, and global config.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadConfig();
          }}
        >
          <RefreshCcw className="size-3.5" />
          Reload
        </Button>
      </header>

      {/* Tab bar */}
      <nav className="border-edge flex gap-1 border-b pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
            }}
            className={cn(
              'relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id ? 'text-primary' : 'text-mid hover:text-light',
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="bg-primary absolute inset-x-0 -bottom-px h-px" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-1">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-light">Backend</span>
                  <SourceBadge source={sourceFor(FIELD_PATHS.backend)} />
                </span>
                <Select
                  value={form.backend}
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, backend: String(value) }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select backend" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBackends.map((backend) => (
                      <SelectItem key={backend} value={backend}>
                        {backend}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-light">Agent Profile</span>
                  <SourceBadge source={sourceFor(FIELD_PATHS.agent)} />
                </span>
                <Input
                  value={form.agent}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, agent: event.target.value }));
                  }}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-light">Max Iterations</span>
                  <SourceBadge source={sourceFor(FIELD_PATHS.maxIterations)} />
                </span>
                <Input
                  type="number"
                  min={0}
                  value={form.maxIterations}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      maxIterations: Number(event.target.value) || 0,
                    }));
                  }}
                />
              </label>

              <label className="space-y-1">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-light">Tasks Directory</span>
                  <SourceBadge source={sourceFor(FIELD_PATHS.tasksDir)} />
                </span>
                <Input
                  value={form.tasksDir}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, tasksDir: event.target.value }));
                  }}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="bg-background/40 border-edge flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-light text-sm">Auto Commit</span>
                <div className="flex items-center gap-2">
                  <SourceBadge source={sourceFor(FIELD_PATHS.shouldCommit)} />
                  <Switch
                    checked={form.shouldCommit}
                    onCheckedChange={(checked) => {
                      setForm((prev) => ({ ...prev, shouldCommit: checked }));
                    }}
                  />
                </div>
              </label>

              <label className="bg-background/40 border-edge flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-light text-sm">Skip Permissions</span>
                <div className="flex items-center gap-2">
                  <SourceBadge source={sourceFor(FIELD_PATHS.skipPermissions)} />
                  <Switch
                    checked={form.skipPermissions}
                    onCheckedChange={(checked) => {
                      setForm((prev) => ({ ...prev, skipPermissions: checked }));
                    }}
                  />
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-light text-sm">Notifications</span>
                <SourceBadge source={sourceFor(FIELD_PATHS.notify)} />
              </div>
              <RadioGroup
                value={form.notify}
                onValueChange={(value) => {
                  if (value === 'false' || value === 'individual' || value === 'all') {
                    setForm((prev) => ({ ...prev, notify: value }));
                  }
                }}
                className="grid gap-2 sm:grid-cols-3"
              >
                <label className="bg-background/40 border-edge flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <RadioGroupItem value="false" />
                  Off
                </label>
                <label className="bg-background/40 border-edge flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <RadioGroupItem value="individual" />
                  Per iteration
                </label>
                <label className="bg-background/40 border-edge flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <RadioGroupItem value="all" />
                  End of run
                </label>
              </RadioGroup>
            </div>
          </div>
        )}

        {activeTab === 'model' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-light text-sm">Model Mode</span>
                <SourceBadge source={sourceFor(FIELD_PATHS.model)} />
              </div>

              <RadioGroup
                value={form.modelMode}
                onValueChange={(value) => {
                  if (value === 'single' || value === 'per-command') {
                    setForm((prev) => ({ ...prev, modelMode: value }));
                  }
                }}
                className="grid grid-cols-2 gap-3"
              >
                <label className="bg-background/40 border-edge flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <RadioGroupItem value="single" />
                  Single
                </label>
                <label className="bg-background/40 border-edge flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <RadioGroupItem value="per-command" />
                  Per-command
                </label>
              </RadioGroup>
            </div>

            {form.modelMode === 'single' ? (
              <label className="block space-y-1">
                <span className="text-light text-sm">Model</span>
                <Input
                  value={form.modelSingle}
                  placeholder="e.g. anthropic/claude-opus-4-6"
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, modelSingle: event.target.value }));
                  }}
                />
              </label>
            ) : (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-light flex items-center justify-between gap-2 text-sm">
                    Run
                    <SourceBadge source={sourceFor(FIELD_PATHS.modelRun)} />
                  </span>
                  <Input
                    value={form.modelRun}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, modelRun: event.target.value }));
                    }}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-light flex items-center justify-between gap-2 text-sm">
                    Plan
                    <SourceBadge source={sourceFor(FIELD_PATHS.modelPlan)} />
                  </span>
                  <Input
                    value={form.modelPlan}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, modelPlan: event.target.value }));
                    }}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-light flex items-center justify-between gap-2 text-sm">
                    Edit
                    <SourceBadge source={sourceFor(FIELD_PATHS.modelEdit)} />
                  </span>
                  <Input
                    value={form.modelEdit}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, modelEdit: event.target.value }));
                    }}
                  />
                </label>
              </div>
            )}

            <p className="text-dim border-edge border-t pt-3 text-xs">
              Model identifiers follow the format{' '}
              <code className="text-primary/80 text-[11px]">provider/model-name</code>. When using
              per-command mode, each agent command can use a different model.
            </p>
          </div>
        )}

        {activeTab === 'validation' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-light text-sm">Validator Commands</span>
                <p className="text-dim mt-0.5 text-xs">
                  Commands run after each agent iteration to validate changes.
                </p>
              </div>
              <SourceBadge source={sourceFor(FIELD_PATHS.validatorCommands)} />
            </div>

            {form.validatorCommands.length === 0 ? (
              <div className="border-edge rounded-md border border-dashed px-4 py-6 text-center">
                <p className="text-dim text-xs">No validator commands configured.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {form.validatorCommands.map((command, index) => (
                  <div
                    key={`${command}-${index}`}
                    className="bg-background/40 border-edge group flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <code className="text-light font-mono text-xs">{command}</code>
                    <button
                      type="button"
                      className="text-dim hover:text-red text-xs opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        removeValidator(index);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newValidator}
                onChange={(event) => {
                  setNewValidator(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addValidator();
                  }
                }}
                placeholder="bun lint"
                className="font-mono"
              />
              <button
                type="button"
                className="text-primary border-primary/30 hover:bg-accent-bg shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                onClick={addValidator}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-light text-sm font-medium">Jira</span>
                <SourceBadge source={sourceFor(FIELD_PATHS.jiraBaseUrl)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-dim text-xs">Base URL</span>
                  <Input
                    placeholder="https://company.atlassian.net"
                    value={form.jiraBaseUrl}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, jiraBaseUrl: event.target.value }));
                    }}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-dim text-xs">Profile</span>
                  <Input
                    placeholder="default"
                    value={form.jiraProfile}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, jiraProfile: event.target.value }));
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="border-edge border-t" />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-light text-sm font-medium">GitHub</span>
                <SourceBadge source={sourceFor(FIELD_PATHS.githubProfile)} />
              </div>
              <label className="block space-y-1">
                <span className="text-dim text-xs">Profile</span>
                <Input
                  placeholder="default"
                  value={form.githubProfile}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, githubProfile: event.target.value }));
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {validation && !validation.valid ? (
          <div className="border-red/40 bg-red-bg mt-4 rounded-md border p-3">
            <p className="text-red mb-2 text-sm">Validation issues:</p>
            <ul className="text-red space-y-1 text-xs">
              {validation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Action buttons */}
      <div className="border-edge mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <Button
          variant="outline"
          onClick={() => {
            if (!localConfigPath) {
              error({ title: 'No local config file found for active project' });
              return;
            }

            onEditJson(localConfigPath);
          }}
        >
          <Code className="size-3.5" />
          Edit as JSON
        </Button>
        <Button
          variant="outline"
          disabled={isResettingGui}
          onClick={() => {
            void resetGui();
          }}
        >
          Reset GUI Overrides
        </Button>
        <Button
          variant="outline"
          disabled={isSavingGlobal}
          onClick={() => {
            void save('global');
          }}
        >
          Save to Global
        </Button>
        <Button
          disabled={isSavingProject}
          onClick={() => {
            void save('gui');
          }}
        >
          Save to Project
        </Button>
      </div>
    </section>
  );
};
