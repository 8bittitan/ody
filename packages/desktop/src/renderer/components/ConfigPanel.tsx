import {
  createDefaultConfigForm,
  hasLayerValue,
  toConfigFormState,
  toConfigPayload,
  type ConfigFormState,
} from '@/components/config/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible } from '@/components/ui/collapsible';
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
import { Code, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ConfigPanelProps = {
  onOpenInitWizard: () => void;
  onEditJson: (configPath: string) => void;
};

type FieldSource = 'gui' | 'local' | 'global' | 'default';

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

const coerceBackends = (backends: string[]) => {
  if (backends.length > 0) {
    return backends;
  }

  return ['opencode', 'claude', 'codex'];
};

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

  const renderSourceBadge = (source: FieldSource) => (
    <Badge variant="outline" className="text-dim border-edge rounded-md text-[11px] font-normal">
      {SOURCE_LABEL[source]}
    </Badge>
  );

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
    <section className="bg-panel border-edge h-full rounded-lg border p-4">
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

      <div className="max-h-[calc(100%-4.75rem)] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="flex items-center justify-between gap-2 text-sm">
              <span className="text-light">Backend</span>
              {renderSourceBadge(sourceFor(FIELD_PATHS.backend))}
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
              {renderSourceBadge(sourceFor(FIELD_PATHS.agent))}
            </span>
            <Input
              value={form.agent}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, agent: event.target.value }));
              }}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="flex items-center justify-between gap-2 text-sm">
              <span className="text-light">Max Iterations</span>
              {renderSourceBadge(sourceFor(FIELD_PATHS.maxIterations))}
            </span>
            <Input
              type="number"
              min={0}
              value={form.maxIterations}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, maxIterations: Number(event.target.value) || 0 }));
              }}
            />
          </label>

          <label className="space-y-1">
            <span className="flex items-center justify-between gap-2 text-sm">
              <span className="text-light">Tasks Directory</span>
              {renderSourceBadge(sourceFor(FIELD_PATHS.tasksDir))}
            </span>
            <Input
              value={form.tasksDir}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, tasksDir: event.target.value }));
              }}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="bg-background/40 border-edge flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-light text-sm">Auto Commit</span>
            <div className="flex items-center gap-2">
              {renderSourceBadge(sourceFor(FIELD_PATHS.shouldCommit))}
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
              {renderSourceBadge(sourceFor(FIELD_PATHS.skipPermissions))}
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
            <span className="text-light text-sm">Model</span>
            {renderSourceBadge(sourceFor(FIELD_PATHS.model))}
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

          {form.modelMode === 'single' ? (
            <Input
              value={form.modelSingle}
              placeholder="Model"
              onChange={(event) => {
                setForm((prev) => ({ ...prev, modelSingle: event.target.value }));
              }}
            />
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-light flex items-center justify-between gap-2 text-xs">
                  Run
                  {renderSourceBadge(sourceFor(FIELD_PATHS.modelRun))}
                </span>
                <Input
                  value={form.modelRun}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, modelRun: event.target.value }));
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-light flex items-center justify-between gap-2 text-xs">
                  Plan
                  {renderSourceBadge(sourceFor(FIELD_PATHS.modelPlan))}
                </span>
                <Input
                  value={form.modelPlan}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, modelPlan: event.target.value }));
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-light flex items-center justify-between gap-2 text-xs">
                  Edit
                  {renderSourceBadge(sourceFor(FIELD_PATHS.modelEdit))}
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
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-light text-sm">Notifications</span>
            {renderSourceBadge(sourceFor(FIELD_PATHS.notify))}
          </div>
          <RadioGroup
            value={form.notify}
            onValueChange={(value) => {
              if (value === 'false' || value === 'individual' || value === 'all') {
                setForm((prev) => ({ ...prev, notify: value }));
              }
            }}
            className="grid gap-2 md:grid-cols-3"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-light text-sm">Validator Commands</span>
            {renderSourceBadge(sourceFor(FIELD_PATHS.validatorCommands))}
          </div>

          {form.validatorCommands.map((command, index) => (
            <div
              key={`${command}-${index}`}
              className="bg-background/40 border-edge flex items-center justify-between rounded-md border px-3 py-2"
            >
              <code className="text-light text-xs">{command}</code>
              <button
                type="button"
                className="text-mid hover:text-red text-xs"
                onClick={() => {
                  removeValidator(index);
                }}
              >
                Remove
              </button>
            </div>
          ))}

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
            />
            <Button variant="outline" onClick={addValidator}>
              Add command
            </Button>
          </div>
        </div>

        <Collapsible
          label="Jira Integration"
          badge={SOURCE_LABEL[sourceFor(FIELD_PATHS.jiraBaseUrl)]}
          defaultOpen={true}
          className="bg-background/40 border-edge rounded-md border p-3"
        >
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-light flex items-center justify-between gap-2 text-xs">
                Base URL
                {renderSourceBadge(sourceFor(FIELD_PATHS.jiraBaseUrl))}
              </span>
              <Input
                placeholder="https://company.atlassian.net"
                value={form.jiraBaseUrl}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, jiraBaseUrl: event.target.value }));
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-light flex items-center justify-between gap-2 text-xs">
                Profile
                {renderSourceBadge(sourceFor(FIELD_PATHS.jiraProfile))}
              </span>
              <Input
                placeholder="default"
                value={form.jiraProfile}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, jiraProfile: event.target.value }));
                }}
              />
            </label>
          </div>
        </Collapsible>

        <Collapsible
          label="GitHub Integration"
          badge={SOURCE_LABEL[sourceFor(FIELD_PATHS.githubProfile)]}
          defaultOpen={true}
          className="bg-background/40 border-edge rounded-md border p-3"
        >
          <label className="space-y-1">
            <span className="text-light flex items-center justify-between gap-2 text-xs">
              Profile
              {renderSourceBadge(sourceFor(FIELD_PATHS.githubProfile))}
            </span>
            <Input
              placeholder="default"
              value={form.githubProfile}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, githubProfile: event.target.value }));
              }}
            />
          </label>
        </Collapsible>

        {validation && !validation.valid ? (
          <div className="border-red/40 bg-red-bg rounded-md border p-3">
            <p className="text-red mb-2 text-sm">Validation issues:</p>
            <ul className="text-red space-y-1 text-xs">
              {validation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-edge mt-1 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
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
      </div>
    </section>
  );
};
