export type ModelMode = 'single' | 'per-command';

export type ConfigFormState = {
  backend: string;
  maxIterations: number;
  autoCommit: boolean;
  modelMode: ModelMode;
  modelSingle: string;
  modelRun: string;
  modelPlan: string;
  modelEdit: string;
  skipPermissions: boolean;
  agent: string;
  tasksDir: string;
  notify: 'false' | 'individual' | 'all';
  validatorCommands: string[];
  jiraBaseUrl: string;
  jiraProfile: string;
  githubProfile: string;
};

const getString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

const getNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const getBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const getStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const getRecord = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const createDefaultConfigForm = (): ConfigFormState => ({
  backend: 'opencode',
  maxIterations: 3,
  autoCommit: false,
  modelMode: 'single',
  modelSingle: '',
  modelRun: '',
  modelPlan: '',
  modelEdit: '',
  skipPermissions: true,
  agent: 'build',
  tasksDir: 'tasks',
  notify: 'false',
  validatorCommands: [],
  jiraBaseUrl: '',
  jiraProfile: '',
  githubProfile: '',
});

export const toConfigFormState = (config: Record<string, unknown> | null): ConfigFormState => {
  const form = createDefaultConfigForm();

  if (!config) {
    return form;
  }

  const modelValue = config.model;
  const modelRecord = getRecord(modelValue);
  const jira = getRecord(config.jira);
  const github = getRecord(config.github);
  const notify = config.notify;

  return {
    backend: getString(config.backend, form.backend),
    maxIterations: getNumber(config.maxIterations, form.maxIterations),
    autoCommit: getBoolean(config.autoCommit, form.autoCommit),
    modelMode:
      typeof modelValue === 'string' || modelValue === undefined ? 'single' : 'per-command',
    modelSingle: typeof modelValue === 'string' ? modelValue : '',
    modelRun: getString(modelRecord?.run),
    modelPlan: getString(modelRecord?.plan),
    modelEdit: getString(modelRecord?.edit),
    skipPermissions: getBoolean(config.skipPermissions, form.skipPermissions),
    agent: getString(config.agent, form.agent),
    tasksDir: getString(config.tasksDir, form.tasksDir),
    notify:
      notify === 'all' || notify === 'individual'
        ? notify
        : notify === false
          ? 'false'
          : form.notify,
    validatorCommands: getStringArray(config.validatorCommands),
    jiraBaseUrl: getString(jira?.baseUrl),
    jiraProfile: getString(jira?.profile),
    githubProfile: getString(github?.profile),
  };
};

export const toConfigPayload = (form: ConfigFormState) => {
  const payload: Record<string, unknown> = {
    backend: form.backend,
    maxIterations: form.maxIterations,
    autoCommit: form.autoCommit,
    skipPermissions: form.skipPermissions,
    agent: form.agent,
    tasksDir: form.tasksDir,
    notify: form.notify === 'false' ? false : form.notify,
    validatorCommands: form.validatorCommands,
  };

  if (form.modelMode === 'single') {
    if (form.modelSingle.trim().length > 0) {
      payload.model = form.modelSingle.trim();
    }
  } else {
    payload.model = {
      run: form.modelRun.trim(),
      plan: form.modelPlan.trim(),
      edit: form.modelEdit.trim(),
    };
  }

  if (form.jiraBaseUrl.trim().length > 0 || form.jiraProfile.trim().length > 0) {
    payload.jira = {
      baseUrl: form.jiraBaseUrl.trim(),
      ...(form.jiraProfile.trim().length > 0 ? { profile: form.jiraProfile.trim() } : {}),
    };
  }

  if (form.githubProfile.trim().length > 0) {
    payload.github = { profile: form.githubProfile.trim() };
  }

  return payload;
};

export const hasLayerValue = (layer: Record<string, unknown> | null, path: string[]) => {
  if (!layer) {
    return false;
  }

  let current: unknown = layer;

  for (const segment of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return false;
    }

    const record = current as Record<string, unknown>;
    if (!(segment in record)) {
      return false;
    }

    current = record[segment];
  }

  return true;
};
