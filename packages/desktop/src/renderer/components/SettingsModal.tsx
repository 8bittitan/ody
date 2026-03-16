import {
  createDefaultConfigForm,
  toConfigFormState,
  toConfigPayload,
} from '@/components/config/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { ThemeSource } from '@/types/ipc';
import { useQueries, useQuery } from '@tanstack/react-query';
import { FolderSearch, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Label } from './ui/label';

type SettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProjectPath: string | null;
  onBrowseProject: () => Promise<string | null>;
  onOpenConfigView: () => void;
};

type SettingsTab = 'general' | 'backend' | 'validators';

const DEFAULT_BACKENDS = ['opencode', 'claude', 'codex'] as const;

export const SettingsModal = ({
  open,
  onOpenChange,
  activeProjectPath,
  onBrowseProject,
  onOpenConfigView,
}: SettingsModalProps) => {
  const { config, isLoading: loadingConfig, validateConfig, saveConfig } = useConfig();
  const { resolvedTheme, setTheme } = useTheme();
  const { success, error, accent } = useNotifications();
  const [projectDir, setProjectDir] = useState('');
  const [newValidator, setNewValidator] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(createDefaultConfigForm());
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { data: soundNotifications, isLoading: loadingSoundSettings } = useQuery({
    queryKey: queryKeys.settings.notifications.sound,
    queryFn: async () => {
      const soundSettings = await api.notifications.getSoundEnabled();

      return soundSettings.enabled;
    },
    enabled: open,
  });
  const { data: availableBackends = DEFAULT_BACKENDS, isLoading: loadingBackendList } = useQuery({
    queryKey: queryKeys.settings.backends.list,
    queryFn: async () => {
      const backends = await api.backends.available();

      return backends.length > 0 ? backends : [...DEFAULT_BACKENDS];
    },
    enabled: open && activeTab === 'backend',
  });
  const backendModelQueries = useQueries({
    queries: availableBackends.map((backendName) => ({
      queryKey: queryKeys.settings.backends.model(backendName),
      queryFn: async () => {
        const models = await api.backends.models(backendName);

        return models[0] ?? null;
      },
      enabled: open && activeTab === 'backend',
    })),
  });

  const loadingBackends =
    loadingBackendList || backendModelQueries.some((query) => query.isLoading);
  const backendCards = availableBackends.map((backendName, index) => ({
    name: backendName,
    model: backendModelQueries[index]?.data ?? null,
  }));

  const isLoading = loadingConfig || loadingSoundSettings;
  const hasConfig = config !== null;
  const fallbackModelLabel =
    form.modelMode === 'single'
      ? form.modelSingle.trim()
      : form.modelRun.trim() || form.modelPlan.trim() || form.modelEdit.trim();

  useEffect(() => {
    setProjectDir(activeProjectPath ?? '');
  }, [activeProjectPath]);

  useEffect(() => {
    setForm(toConfigFormState(config));
  }, [config]);

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
    accent({ title: 'Validator added', description: command });
  };

  const removeValidator = (index: number) => {
    const command = form.validatorCommands[index];

    setForm((prev) => ({
      ...prev,
      validatorCommands: prev.validatorCommands.filter((_, itemIndex) => itemIndex !== index),
    }));

    if (command) {
      accent({ title: 'Validator removed', description: command });
    }
  };

  const handleBrowseProject = async () => {
    const nextPath = await onBrowseProject();

    if (nextPath) {
      setProjectDir(nextPath);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const payload = toConfigPayload(form);
      const validation = await validateConfig(payload);

      if (!validation.valid) {
        error({ title: 'Fix settings validation errors before saving' });
        return;
      }

      await saveConfig('local', payload);
      await api.notifications.setSoundEnabled(soundNotifications ?? false);
      success({ title: 'Settings saved' });
      onOpenChange(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error({ title: 'Failed to save settings', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-edge max-w-140 p-0">
        <DialogHeader className="border-edge border-b px-5 py-4">
          <div className="flex items-start gap-3 pr-6">
            <div className="bg-accent-bg border-primary/35 text-primary mt-0.5 rounded-md border p-2">
              <Settings2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-light text-base">Settings</DialogTitle>
              <DialogDescription className="text-mid mt-1 text-sm">
                Manage your preferences
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4">
          {isLoading ? (
            <section className="text-mid py-8 text-sm">Loading settings...</section>
          ) : !hasConfig ? (
            <section className="bg-background/35 border-edge rounded-md border p-4">
              <p className="text-light text-sm">No project config found for this workspace.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  onOpenChange(false);
                  onOpenConfigView();
                }}
              >
                Open full config view
              </Button>
            </section>
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
              <TabsList className="bg-background/50 border-edge grid w-full grid-cols-3 border">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="backend">Backend</TabsTrigger>
                <TabsTrigger value="validators">Validators</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectDir">Project directory</Label>
                  <div className="flex gap-2">
                    <Input value={projectDir} readOnly placeholder="No project selected" />
                    <Button
                      id="projectDir"
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        void handleBrowseProject();
                      }}
                    >
                      <FolderSearch className="size-4" />
                      Browse
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxIterations">Max iterations</Label>
                  <Input
                    id="maxIterations"
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
                </div>

                <Label className="bg-background/35 border-edge flex items-center justify-between rounded-md border px-3 py-2.5">
                  <div>
                    <p className="text-light text-sm">Auto-commit</p>
                    <p className="text-mid text-xs">Save commits after successful runs.</p>
                  </div>
                  <Switch
                    checked={form.autoCommit}
                    onCheckedChange={(value) => {
                      setForm((prev) => ({ ...prev, autoCommit: value }));
                    }}
                  />
                </Label>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <RadioGroup
                    value={resolvedTheme}
                    onValueChange={(val) => {
                      setTheme(val as ThemeSource);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="light" id="light" />
                      <Label htmlFor="light">Light</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="dark" id="dark" />
                      <Label htmlFor="dark">Dark</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="system" id="system" />
                      <Label htmlFor="system">System</Label>
                    </div>
                  </RadioGroup>
                </div>
              </TabsContent>

              <TabsContent value="backend" className="mt-4">
                {loadingBackends ? (
                  <section className="text-mid py-4 text-sm">Loading backends...</section>
                ) : (
                  <RadioGroup
                    value={form.backend}
                    onValueChange={(value) => {
                      setForm((prev) => ({ ...prev, backend: String(value) }));
                    }}
                  >
                    {backendCards?.map((backend) => {
                      const isActive = form.backend === backend.name;
                      const modelLabel =
                        backend.model ?? (fallbackModelLabel || 'No model detected');

                      return (
                        <label
                          key={backend.name}
                          className={[
                            'bg-background/35 border-edge flex cursor-pointer items-start justify-between rounded-md border p-3 transition-colors',
                            isActive
                              ? 'border-primary/60 bg-accent-bg/65'
                              : 'hover:border-primary/35',
                          ].join(' ')}
                        >
                          <div>
                            <p className="text-light text-sm font-medium capitalize">
                              {backend.name}
                            </p>
                            <p className="text-mid mt-1 text-xs">Model: {modelLabel}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isActive ? <Badge className="text-[11px]">Active</Badge> : null}
                            <RadioGroupItem value={backend.name} className="mt-0.5" />
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                )}
              </TabsContent>

              <TabsContent value="validators" className="mt-4 space-y-3">
                {form.validatorCommands.length === 0 ? (
                  <p className="text-mid text-sm">No validator commands configured.</p>
                ) : (
                  form.validatorCommands.map((command, index) => (
                    <div
                      key={`${command}-${index}`}
                      className="bg-background/35 border-edge group flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <code className="text-light text-xs">{command}</code>
                      <button
                        type="button"
                        className="text-mid hover:text-red text-xs opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          removeValidator(index);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}

                <div className="flex gap-2">
                  <Input
                    value={newValidator}
                    placeholder="bun test"
                    onChange={(event) => {
                      setNewValidator(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addValidator();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addValidator}>
                    Add
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter className="border-edge border-t px-5 py-4 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving || isLoading || !hasConfig} onClick={() => handleSave()}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
