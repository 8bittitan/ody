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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/hooks/useConfig';
import { api } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

import { createDefaultConfigForm, toConfigPayload, type ConfigFormState } from './config/form';

type InitWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInitialized: () => void;
};

export const InitWizard = ({ open, onOpenChange, onInitialized }: InitWizardProps) => {
  const { validateConfig, saveConfig } = useConfig();
  const [availableBackends, setAvailableBackends] = useState<string[]>([]);
  const [form, setForm] = useState<ConfigFormState>(createDefaultConfigForm());
  const [newValidator, setNewValidator] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    void api.backends.available().then((result) => {
      setAvailableBackends(result);
    });
  }, [open]);

  const backendOptions = useMemo(
    () => (availableBackends.length > 0 ? availableBackends : ['opencode', 'claude', 'codex']),
    [availableBackends],
  );

  const preview = JSON.stringify(toConfigPayload(form), null, 2);

  const addValidator = () => {
    const value = newValidator.trim();
    if (value.length === 0) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      validatorCommands: [...prev.validatorCommands, value],
    }));
    setNewValidator('');
  };

  const submit = async () => {
    setIsSubmitting(true);

    try {
      const payload = toConfigPayload(form);
      const result = await validateConfig(payload);
      if (!result.valid) {
        setIssues(result.issues);
        return;
      }

      await saveConfig('local', payload);
      setIssues([]);
      onInitialized();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-edge max-w-2xl">
        <DialogHeader>
          <DialogTitle>Initialize project configuration</DialogTitle>
          <DialogDescription>
            This wizard creates `.ody/ody.json` for the active project.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <label className="block space-y-1">
            <span className="text-light text-sm">Backend</span>
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
                {backendOptions.map((backend) => (
                  <SelectItem key={backend} value={backend}>
                    {backend}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-light text-sm">Max Iterations</span>
              <Input
                type="number"
                min={0}
                value={form.maxIterations}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, maxIterations: Number(event.target.value) || 0 }));
                }}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-light text-sm">Agent Profile</span>
              <Input
                value={form.agent}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, agent: event.target.value }));
                }}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="bg-background/40 border-edge flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-light text-sm">Auto Commit</span>
              <Switch
                checked={form.shouldCommit}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({ ...prev, shouldCommit: checked }));
                }}
              />
            </label>

            <label className="bg-background/40 border-edge flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-light text-sm">Skip Permissions</span>
              <Switch
                checked={form.skipPermissions}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({ ...prev, skipPermissions: checked }));
                }}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-light text-sm">Tasks Directory</span>
            <Input
              value={form.tasksDir}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, tasksDir: event.target.value }));
              }}
            />
          </label>

          <div className="space-y-2">
            <span className="text-light text-sm">Model</span>
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
                placeholder="Model"
                value={form.modelSingle}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, modelSingle: event.target.value }));
                }}
              />
            ) : (
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="Run"
                  value={form.modelRun}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, modelRun: event.target.value }));
                  }}
                />
                <Input
                  placeholder="Plan"
                  value={form.modelPlan}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, modelPlan: event.target.value }));
                  }}
                />
                <Input
                  placeholder="Edit"
                  value={form.modelEdit}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, modelEdit: event.target.value }));
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-light text-sm">Notifications</span>
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
            <span className="text-light text-sm">Validator Commands</span>
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
                    setForm((prev) => ({
                      ...prev,
                      validatorCommands: prev.validatorCommands.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }));
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
                Add
              </Button>
            </div>
          </div>

          <details className="bg-background/40 border-edge rounded-md border p-3" open>
            <summary className="text-light cursor-pointer text-sm">Jira Integration</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Input
                placeholder="https://company.atlassian.net"
                value={form.jiraBaseUrl}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, jiraBaseUrl: event.target.value }));
                }}
              />
              <Input
                placeholder="Profile"
                value={form.jiraProfile}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, jiraProfile: event.target.value }));
                }}
              />
            </div>
          </details>

          <details className="bg-background/40 border-edge rounded-md border p-3" open>
            <summary className="text-light cursor-pointer text-sm">GitHub Integration</summary>
            <div className="mt-2">
              <Input
                placeholder="Profile"
                value={form.githubProfile}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, githubProfile: event.target.value }));
                }}
              />
            </div>
          </details>

          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-dim border-edge">
              Preview JSON
            </Badge>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreview((prev) => !prev);
              }}
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>

          {showPreview && (
            <pre className="bg-background/40 border-edge text-light overflow-x-auto rounded-md border p-3 text-xs">
              {preview}
            </pre>
          )}

          {issues.length > 0 && (
            <div className="border-red/40 bg-red-bg rounded-md border p-3">
              <p className="text-red mb-2 text-sm">Fix these issues before continuing:</p>
              <ul className="text-red space-y-1 text-xs">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={() => {
              void submit();
            }}
          >
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
