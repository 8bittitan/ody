import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { Auth } from '@internal/auth';
import { Backend, getAvailableBackends } from '@internal/backends';
import {
  buildBatchPlanPrompt,
  buildImportPrompt,
  buildInlineEditPrompt,
  buildPlanPrompt,
  buildRunPrompt,
} from '@internal/builders';
import { BASE_DIR, Config, ODY_FILE, TASKS_DIR, configSchema } from '@internal/config';
import { GitHub, Jira } from '@internal/integrations';
import {
  getTaskFilesByLabel,
  getTaskFilesInDir,
  getTaskStates,
  parseDescription,
  parseFrontmatter,
  parseTitle,
} from '@internal/tasks';
import type { BrowserWindow } from 'electron';
import { dialog, ipcMain, nativeTheme, shell } from 'electron';
import Store from 'electron-store';

import { AgentRunner } from './agent';

type ProjectItem = {
  name: string;
  path: string;
};

type TaskStatus = 'pending' | 'in_progress' | 'completed';

type TaskSummary = {
  filePath: string;
  title: string;
  description: string;
  status: TaskStatus;
  labels: string[];
  complexity: string | null;
  created: string | null;
  started: string | null;
  completed: string | null;
};

type DesktopStore = {
  projects: ProjectItem[];
  activeProject: string | null;
  guiConfigByProject: Record<string, Record<string, unknown>>;
  themePreference: ThemeSource;
  soundNotifications: boolean;
};

type ThemeSource = 'system' | 'light' | 'dark';
type ThemeResolved = 'light' | 'dark';

const appStore = new Store<DesktopStore>({
  name: 'ody-desktop',
  defaults: {
    projects: [],
    activeProject: null,
    guiConfigByProject: {},
    themePreference: 'system',
    soundNotifications: false,
  },
});

const resolveTheme = (source: ThemeSource): ThemeResolved => {
  if (source === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }

  return source;
};

const normalizeThemeSource = (source: unknown): ThemeSource => {
  if (source === 'light' || source === 'dark' || source === 'system') {
    return source;
  }

  return 'system';
};

const getThemeState = () => {
  const source = normalizeThemeSource(appStore.get('themePreference', 'system'));
  return {
    source,
    resolved: resolveTheme(source),
  };
};

const getGlobalConfigPath = () => join(homedir(), BASE_DIR, ODY_FILE);

const getLocalConfigPath = (projectPath: string) => join(projectPath, BASE_DIR, ODY_FILE);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeConfigLayers = (
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override ?? {})) {
    const current = merged[key];

    if (isObject(current) && isObject(value)) {
      merged[key] = mergeConfigLayers(current, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
};

const readJsonFile = async (filePath: string) => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeJsonFile = async (filePath: string, payload: Record<string, unknown>) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
};

const readGuiConfigForProject = (projectPath: string | null) => {
  if (!projectPath) {
    return null;
  }

  const byProject = appStore.get('guiConfigByProject', {});
  return byProject[projectPath] ?? null;
};

const saveGuiConfigForProject = (projectPath: string, config: Record<string, unknown>) => {
  const byProject = appStore.get('guiConfigByProject', {});
  appStore.set('guiConfigByProject', {
    ...byProject,
    [projectPath]: config,
  });
};

const clearGuiConfigForProject = (projectPath: string) => {
  const byProject = appStore.get('guiConfigByProject', {});

  if (!(projectPath in byProject)) {
    return;
  }

  const { [projectPath]: _removed, ...rest } = byProject;
  appStore.set('guiConfigByProject', rest);
};

const projectNameFromPath = (projectPath: string) => basename(projectPath) || projectPath;

const readMergedRawConfig = async (projectPath: string | null) => {
  const globalConfigPath = getGlobalConfigPath();
  const localConfigPath = projectPath ? getLocalConfigPath(projectPath) : null;

  const globalLayer = await readJsonFile(globalConfigPath);
  const localLayer = localConfigPath ? await readJsonFile(localConfigPath) : null;
  const guiLayer = readGuiConfigForProject(projectPath);

  return mergeConfigLayers(
    mergeConfigLayers(globalLayer ?? undefined, localLayer ?? undefined),
    guiLayer ?? undefined,
  );
};

const resolveAgentConfig = async (projectPath: string | null) => {
  const mergedRaw = await readMergedRawConfig(projectPath);

  if (Object.keys(mergedRaw).length === 0) {
    throw new Error('No Ody configuration found. Run `ody init` to get started.');
  }

  return Config.parse(mergedRaw);
};

const readImportSettings = async (projectPath: string | null) => {
  const mergedConfig = await readMergedRawConfig(projectPath);
  const jiraConfig = isObject(mergedConfig.jira) ? mergedConfig.jira : null;
  const githubConfig = isObject(mergedConfig.github) ? mergedConfig.github : null;

  return {
    jiraBaseUrl: typeof jiraConfig?.baseUrl === 'string' ? jiraConfig.baseUrl : undefined,
    jiraProfile: typeof jiraConfig?.profile === 'string' ? jiraConfig.profile : 'default',
    githubProfile: typeof githubConfig?.profile === 'string' ? githubConfig.profile : 'default',
  };
};

const parseImportInput = (opts: unknown) => {
  if (!opts || typeof opts !== 'object') {
    throw new Error('Invalid import payload');
  }

  const payload = opts as { input?: unknown };
  const input = String(payload.input ?? '').trim();

  if (input.length === 0) {
    throw new Error('Ticket or issue reference is required');
  }

  return input;
};

const projectExists = async (projectPath: string) => {
  try {
    await access(projectPath);
    return true;
  } catch {
    return false;
  }
};

const readProjects = () => appStore.get('projects', []);

const saveProjects = (projects: ProjectItem[]) => {
  appStore.set('projects', projects);
};

const setActiveProject = (projectPath: string | null) => {
  appStore.set('activeProject', projectPath);
};

const readActiveProjectPath = () => appStore.get('activeProject', null);

const resolveTasksDirPath = (projectPath: string) => join(projectPath, BASE_DIR, TASKS_DIR);
const resolveProgressFilePath = (projectPath: string) =>
  join(projectPath, BASE_DIR, 'progress.txt');
const resolveHistoryDirPath = (projectPath: string) => join(projectPath, BASE_DIR, 'history');

const canonicalizeExistingPath = async (filePath: string) => {
  try {
    return await realpath(filePath);
  } catch {
    return null;
  }
};

const canonicalizePathForWrite = async (filePath: string) => {
  const existingPath = await canonicalizeExistingPath(filePath);

  if (existingPath) {
    return existingPath;
  }

  try {
    const parentPath = await realpath(dirname(filePath));
    return join(parentPath, basename(filePath));
  } catch {
    return null;
  }
};

const isPathInsideDirectory = (basePath: string, candidatePath: string) => {
  const pathFromBase = relative(basePath, candidatePath);
  return pathFromBase === '' || (!pathFromBase.startsWith('..') && !isAbsolute(pathFromBase));
};

const resolvePathWithinDirectory = async (
  basePath: string,
  requestedPath: string,
  allowMissing = false,
) => {
  const canonicalBasePath = (await canonicalizeExistingPath(basePath)) ?? resolve(basePath);
  const resolvedCandidatePath = resolve(canonicalBasePath, requestedPath);
  const canonicalCandidatePath = allowMissing
    ? await canonicalizePathForWrite(resolvedCandidatePath)
    : await canonicalizeExistingPath(resolvedCandidatePath);

  if (!canonicalCandidatePath) {
    return null;
  }

  return isPathInsideDirectory(canonicalBasePath, canonicalCandidatePath)
    ? canonicalCandidatePath
    : null;
};

const resolveTaskFilePath = async (
  projectPath: string,
  requestedPath: string,
  allowMissing = false,
) => {
  const trimmedPath = requestedPath.trim();

  if (trimmedPath.length === 0) {
    throw new Error('Task file path is required.');
  }

  const resolvedPath = await resolvePathWithinDirectory(
    resolveTasksDirPath(projectPath),
    trimmedPath,
    allowMissing,
  );

  if (!resolvedPath) {
    throw new Error(
      `Task file path must stay within ${BASE_DIR}/${TASKS_DIR} for the active project.`,
    );
  }

  return resolvedPath;
};

const resolveEditorFilePath = async (
  projectPath: string,
  requestedPath: string,
  allowMissing = false,
) => {
  const taskPath = await resolvePathWithinDirectory(
    resolveTasksDirPath(projectPath),
    requestedPath,
    allowMissing,
  );

  if (taskPath) {
    return taskPath;
  }

  const configPaths = [getLocalConfigPath(projectPath), getGlobalConfigPath()];
  const canonicalRequestedPath = allowMissing
    ? await canonicalizePathForWrite(resolve(requestedPath))
    : await canonicalizeExistingPath(resolve(requestedPath));

  if (canonicalRequestedPath) {
    for (const configPath of configPaths) {
      const canonicalConfigPath = allowMissing
        ? await canonicalizePathForWrite(configPath)
        : await canonicalizeExistingPath(configPath);

      if (canonicalConfigPath === canonicalRequestedPath) {
        return canonicalRequestedPath;
      }
    }
  }

  throw new Error(
    `Editor file path must reference a task in ${BASE_DIR}/${TASKS_DIR} or a known Ody config file.`,
  );
};

const parseTaskCountFromArchive = (content: string) => {
  // CLI format: "Total tasks archived: N"
  const cliMatch = content.match(/^Total tasks archived:\s*(\d+)/m);
  if (cliMatch?.[1]) {
    return Number.parseInt(cliMatch[1], 10);
  }

  // Desktop legacy format: "## Tasks (N)"
  const desktopMatch = content.match(/^## Tasks \((\d+)\)/m);
  if (desktopMatch?.[1]) {
    return Number.parseInt(desktopMatch[1], 10);
  }

  // Fallback: count ## headings (task entries)
  const headings = content.match(/^## /gm);
  return headings?.length ?? 0;
};

const normalizeTaskStatus = (status: string | undefined): TaskStatus => {
  if (status === 'in_progress') {
    return 'in_progress';
  }

  if (status === 'completed') {
    return 'completed';
  }

  return 'pending';
};

const parseLabels = (content: string) => {
  const labelsMatch = content.match(/\*\*Labels\*\*:\s*(.+)/i);

  if (!labelsMatch?.[1]) {
    return [];
  }

  return labelsMatch[1]
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
};

const parseComplexity = (content: string) => {
  const complexityMatch = content.match(/\*\*Complexity\*\*:\s*(.+)/i);
  return complexityMatch?.[1]?.trim() ?? null;
};

const buildTaskSummary = async (
  taskFile: string,
  tasksDirPath: string,
): Promise<TaskSummary | null> => {
  const filePath = join(tasksDirPath, taskFile);

  try {
    const content = await readFile(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    return {
      filePath,
      title: parseTitle(content),
      description: parseDescription(content),
      status: normalizeTaskStatus(frontmatter.status),
      labels: parseLabels(content),
      complexity: parseComplexity(content),
      created: frontmatter.created ?? null,
      started: frontmatter.started ?? null,
      completed: frontmatter.completed ?? null,
    };
  } catch {
    return null;
  }
};

const cleanupProjects = async () => {
  const projects = readProjects();
  const keptProjects: ProjectItem[] = [];

  for (const project of projects) {
    if (await projectExists(project.path)) {
      keptProjects.push(project);
    }
  }

  if (keptProjects.length !== projects.length) {
    saveProjects(keptProjects);
  }

  const activeProject = appStore.get('activeProject', null);
  if (activeProject && !(await projectExists(activeProject))) {
    const fallback = keptProjects[0]?.path ?? null;
    setActiveProject(fallback);
    return {
      projects: keptProjects,
      activeProject: fallback,
    };
  }

  return {
    projects: keptProjects,
    activeProject,
  };
};

const registerHandler = (channel: string, handler: (...args: unknown[]) => unknown) => {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, (_event, ...args) => handler(...args));
};

const extractModifiedFile = (output: string) => {
  const match = output.match(/<modified_file>\s*([\s\S]*?)\s*<\/modified_file>/i);
  return match?.[1] ?? null;
};

export const registerIpcHandlers = (win: BrowserWindow) => {
  const agentRunner = new AgentRunner({
    shouldPlaySound: () => appStore.get('soundNotifications', false),
    playSound: () => {
      shell.beep();
    },
  });
  let inlineEditProc: ChildProcessWithoutNullStreams | null = null;
  let inlineEditSnapshot: { filePath: string; content: string } | null = null;
  const handleNativeThemeUpdated = () => {
    const state = getThemeState();
    if (state.source !== 'system') {
      return;
    }

    win.webContents.send('theme:changed', state);
  };

  nativeTheme.on('updated', handleNativeThemeUpdated);
  win.on('closed', () => {
    nativeTheme.removeListener('updated', handleNativeThemeUpdated);
  });

  win.on('enter-full-screen', () => {
    win.webContents.send('app:fullscreen-status', true);
  });

  win.on('leave-full-screen', () => {
    win.webContents.send('app:fullscreen-status', false);
  });

  registerHandler('config:load', async () => {
    const activeProjectPath = readActiveProjectPath();
    const globalConfigPath = getGlobalConfigPath();
    const localConfigPath = activeProjectPath ? getLocalConfigPath(activeProjectPath) : null;

    const globalLayer = await readJsonFile(globalConfigPath);
    const localLayer = localConfigPath ? await readJsonFile(localConfigPath) : null;
    const guiLayer = readGuiConfigForProject(activeProjectPath);

    const mergedRaw = mergeConfigLayers(
      mergeConfigLayers(globalLayer ?? undefined, localLayer ?? undefined),
      guiLayer ?? undefined,
    );

    const hasAnyLayer = Boolean(globalLayer || localLayer || guiLayer);

    if (!hasAnyLayer) {
      return {
        merged: null,
        localConfigPath,
        layers: {
          gui: guiLayer,
          local: localLayer,
          global: globalLayer,
        },
      };
    }

    try {
      return {
        merged: Config.parse(mergedRaw),
        localConfigPath,
        layers: {
          gui: guiLayer,
          local: localLayer,
          global: globalLayer,
        },
      };
    } catch {
      return {
        merged: null,
        localConfigPath,
        layers: {
          gui: guiLayer,
          local: localLayer,
          global: globalLayer,
        },
      };
    }
  });
  registerHandler('config:save', async (scope: unknown, config: unknown) => {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error('Invalid config payload');
    }

    const normalizedScope = scope === 'gui' || scope === 'local' ? scope : 'local';
    const activeProjectPath = readActiveProjectPath();

    if (normalizedScope === 'gui') {
      if (!activeProjectPath) {
        throw new Error('No active project selected');
      }

      saveGuiConfigForProject(activeProjectPath, parsed.data as Record<string, unknown>);
      return { ok: true };
    }

    if (!activeProjectPath) {
      throw new Error('No active project selected');
    }

    const localConfigPath = getLocalConfigPath(activeProjectPath);
    await writeJsonFile(localConfigPath, parsed.data as Record<string, unknown>);
    return { ok: true };
  });
  registerHandler('config:saveGlobal', async (config: unknown) => {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error('Invalid config payload');
    }

    const globalConfigPath = getGlobalConfigPath();
    await writeJsonFile(globalConfigPath, parsed.data as Record<string, unknown>);
    return { ok: true };
  });
  registerHandler('config:validate', (config: unknown) => {
    const parsed = configSchema.safeParse(config);

    if (parsed.success) {
      return { valid: true, issues: [] };
    }

    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  });
  registerHandler('config:resetGuiOverrides', () => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath) {
      return { ok: true };
    }

    clearGuiConfigForProject(activeProjectPath);
    return { ok: true };
  });

  registerHandler('backends:available', () =>
    getAvailableBackends().map((backend) => backend.value),
  );
  registerHandler('backends:models', () => []);

  registerHandler('tasks:list', async () => {
    const activeProjectPath = readActiveProjectPath();
    if (!activeProjectPath) {
      return [];
    }

    const tasksDirPath = resolveTasksDirPath(activeProjectPath);
    const taskFiles = await getTaskFilesInDir(tasksDirPath);
    const summaries = await Promise.all(
      taskFiles.map((taskFile) => buildTaskSummary(taskFile, tasksDirPath)),
    );

    return summaries.filter((summary): summary is TaskSummary => summary !== null);
  });
  registerHandler('tasks:read', async (filePath: unknown) => {
    const requestedPath = String(filePath ?? '');
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath || requestedPath.length === 0) {
      return {
        filePath: requestedPath,
        content: '',
      };
    }

    const resolvedPath = await resolveTaskFilePath(activeProjectPath, requestedPath);

    try {
      const content = await readFile(resolvedPath, 'utf-8');
      return {
        filePath: resolvedPath,
        content,
      };
    } catch {
      return {
        filePath: resolvedPath,
        content: '',
      };
    }
  });
  registerHandler('tasks:delete', async (filePaths: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    if (!activeProjectPath || !Array.isArray(filePaths)) {
      return { deleted: [] };
    }

    const deleted: string[] = [];

    for (const rawPath of filePaths) {
      const value = String(rawPath ?? '');
      if (value.length === 0) {
        continue;
      }

      const targetPath = await resolveTaskFilePath(activeProjectPath, value);

      try {
        await rm(targetPath);
        deleted.push(targetPath);
      } catch {
        // ignore missing files and continue
      }
    }

    return { deleted };
  });
  registerHandler('tasks:byLabel', async (label: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    const labelValue = String(label ?? '').trim();

    if (!activeProjectPath || labelValue.length === 0) {
      return [];
    }

    const tasksDirPath = resolveTasksDirPath(activeProjectPath);
    const taskFiles = await getTaskFilesByLabel(labelValue, tasksDirPath);
    const summaries = await Promise.all(
      taskFiles.map((taskFile) => buildTaskSummary(taskFile, tasksDirPath)),
    );

    return summaries.filter((summary): summary is TaskSummary => summary !== null);
  });
  registerHandler('tasks:states', async (filePaths: unknown) => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath) {
      return [];
    }

    const tasksDirPath = resolveTasksDirPath(activeProjectPath);
    const taskFiles = Array.isArray(filePaths)
      ? filePaths.map((filePath) => basename(String(filePath ?? '')))
      : undefined;
    const states = await getTaskStates(taskFiles, tasksDirPath);

    return states.map((state) => ({
      filePath: join(tasksDirPath, state.taskFile),
      status: normalizeTaskStatus(state.status),
    }));
  });

  registerHandler('agent:run', (opts: unknown) => {
    if (!opts || typeof opts !== 'object') {
      return { started: false };
    }

    if (agentRunner.isRunning()) {
      return { started: false };
    }

    const options = opts as { projectDir?: unknown; taskFiles?: string[]; iterations?: number };
    const projectDir = String(options.projectDir ?? '').trim();

    if (projectDir.length === 0) {
      return { started: false };
    }

    void (async () => {
      try {
        const config = await resolveAgentConfig(projectDir);
        await agentRunner.runLoop(
          win,
          {
            projectDir,
            taskFiles: options.taskFiles,
            iterations: options.iterations,
          },
          config,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        win.webContents.send('agent:verifyFailed', message);
        win.webContents.send('agent:stopped');
      }
    })();

    return { started: true };
  });
  registerHandler('agent:stop', async (force: unknown) => {
    const stoppedAgent = await agentRunner.stop(force === true);
    const hadInlineEditProc = inlineEditProc !== null;
    const hadInlineEditSnapshot = inlineEditSnapshot !== null;

    if (inlineEditProc) {
      inlineEditProc.kill(force === true ? 'SIGKILL' : 'SIGTERM');
      inlineEditProc = null;
    }

    if (inlineEditSnapshot) {
      const snapshot = inlineEditSnapshot;
      inlineEditSnapshot = null;
      void writeFile(snapshot.filePath, snapshot.content, 'utf-8');
    }

    if (!stoppedAgent && !hadInlineEditProc) {
      win.webContents.send('agent:stopped');
    }

    return { stopped: stoppedAgent || hadInlineEditProc || hadInlineEditSnapshot };
  });
  registerHandler('agent:planNew', async (description: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    const promptInput = String(description ?? '').trim();

    if (!activeProjectPath || promptInput.length === 0 || agentRunner.isRunning()) {
      return { started: false };
    }

    try {
      const config = await resolveAgentConfig(activeProjectPath);
      const prompt = buildPlanPrompt({
        description: promptInput,
        tasksDir: config.tasksDir ?? TASKS_DIR,
      });
      const backend = new Backend(config.backend, config);
      const model = Config.resolveModel('plan', config);
      const command = backend.buildCommand(prompt, model);

      win.webContents.send('agent:started');
      await agentRunner.spawnAndStream(win, command, activeProjectPath);
      win.webContents.send('agent:complete');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      win.webContents.send('agent:verifyFailed', message);
      win.webContents.send('agent:stopped');
    }

    return { started: true };
  });
  registerHandler('agent:planBatch', (filePath: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    const planFilePath = String(filePath ?? '').trim();

    if (!activeProjectPath || planFilePath.length === 0 || agentRunner.isRunning()) {
      return { started: false };
    }

    void (async () => {
      try {
        const config = await resolveAgentConfig(activeProjectPath);
        const prompt = buildBatchPlanPrompt({
          filePath: planFilePath,
          tasksDir: config.tasksDir ?? TASKS_DIR,
        });
        const backend = new Backend(config.backend, config);
        const model = Config.resolveModel('plan', config);
        const command = backend.buildCommand(prompt, model);

        win.webContents.send('agent:started');
        await agentRunner.spawnAndStream(win, command, activeProjectPath);
        win.webContents.send('agent:complete');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        win.webContents.send('agent:verifyFailed', message);
        win.webContents.send('agent:stopped');
      }
    })();

    return { started: true };
  });
  registerHandler('agent:planPreview', async (description: unknown) => {
    const promptInput = String(description ?? '').trim();
    if (promptInput.length === 0) {
      return { prompt: '' };
    }

    try {
      const config = await resolveAgentConfig(readActiveProjectPath());

      return {
        prompt: buildPlanPrompt({
          description: promptInput,
          tasksDir: config.tasksDir ?? TASKS_DIR,
        }),
      };
    } catch {
      return { prompt: '' };
    }
  });
  registerHandler('agent:planEdit', () => ({ started: false }));
  registerHandler('agent:dryRun', async (opts: unknown) => {
    if (!opts || typeof opts !== 'object') {
      return { command: [] };
    }

    const config = await resolveAgentConfig(readActiveProjectPath());
    const backend = new Backend(config.backend, config);
    const model = Config.resolveModel('run', config);
    const options = opts as { taskFiles?: string[] };
    const singleTaskFile = options.taskFiles?.length === 1 ? options.taskFiles[0] : undefined;
    const prompt = buildRunPrompt({
      taskFiles: options.taskFiles,
      taskFile: singleTaskFile,
      config,
    });

    return {
      command: backend.buildCommand(prompt, model),
    };
  });
  registerHandler('agent:editInline', (opts: unknown) => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath || !opts || typeof opts !== 'object') {
      return { started: false };
    }

    if (agentRunner.isRunning() || inlineEditProc) {
      return { started: false };
    }

    const payload = opts as {
      filePath?: unknown;
      fileContent?: unknown;
      instruction?: unknown;
      selection?: { from?: unknown; to?: unknown } | null;
    };
    const requestedPath = String(payload.filePath ?? '').trim();
    const fileContent = String(payload.fileContent ?? '');
    const instruction = String(payload.instruction ?? '').trim();

    if (requestedPath.length === 0 || instruction.length === 0) {
      return { started: false };
    }

    const rawFrom = Number(payload.selection?.from ?? Number.NaN);
    const rawTo = Number(payload.selection?.to ?? Number.NaN);
    const selection =
      Number.isFinite(rawFrom) && Number.isFinite(rawTo)
        ? {
            from: Math.max(0, Math.floor(Math.min(rawFrom, rawTo))),
            to: Math.max(0, Math.floor(Math.max(rawFrom, rawTo))),
          }
        : undefined;

    void (async () => {
      try {
        const resolvedPath = await resolveTaskFilePath(activeProjectPath, requestedPath, true);
        const config = await resolveAgentConfig(activeProjectPath);
        const backend = new Backend(config.backend, config);
        const model = Config.resolveModel('edit', config);

        const snapshotContent = await readFile(resolvedPath, 'utf-8');
        inlineEditSnapshot = { filePath: resolvedPath, content: snapshotContent };

        await writeFile(resolvedPath, fileContent, 'utf-8');

        const prompt = buildInlineEditPrompt({
          fileContent,
          selection,
          instruction,
        });
        const [bin, ...args] = backend.buildCommand(prompt, model);

        if (!bin) {
          throw new Error('Cannot start inline edit: command is empty');
        }

        const proc = spawn(bin, args, {
          cwd: activeProjectPath,
          stdio: 'pipe',
        });
        inlineEditProc = proc;
        win.webContents.send('agent:started');

        let fullOutput = '';
        proc.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          fullOutput += text;
          win.webContents.send('agent:output', text);
        });
        proc.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          fullOutput += text;
          win.webContents.send('agent:output', text);
        });

        const exitCode = await new Promise<number | null>((resolve, reject) => {
          proc.once('error', reject);
          proc.once('close', (code) => resolve(code));
        });

        inlineEditProc = null;

        if (exitCode !== 0) {
          throw new Error(`Inline edit exited with code ${exitCode ?? 'unknown'}`);
        }

        const modifiedContent = extractModifiedFile(fullOutput);

        if (!modifiedContent) {
          throw new Error('Inline edit did not return <modified_file> output.');
        }

        await writeFile(resolvedPath, modifiedContent, 'utf-8');
        win.webContents.send('agent:editResult', modifiedContent);

        const snapshot = inlineEditSnapshot;
        inlineEditSnapshot = null;
        if (snapshot) {
          await writeFile(snapshot.filePath, snapshot.content, 'utf-8');
        }

        win.webContents.send('agent:complete');
      } catch (cause) {
        inlineEditProc = null;

        const snapshot = inlineEditSnapshot;
        inlineEditSnapshot = null;
        if (snapshot) {
          try {
            await writeFile(snapshot.filePath, snapshot.content, 'utf-8');
          } catch {
            // ignore restore failures after inline edit errors
          }
        }

        const message = cause instanceof Error ? cause.message : String(cause);
        win.webContents.send('agent:verifyFailed', message);
        win.webContents.send('agent:stopped');
      }
    })();

    return { started: true };
  });
  registerHandler('agent:importFromJira', (opts: unknown) => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath || agentRunner.isRunning()) {
      return { started: false };
    }

    const input = parseImportInput(opts);

    void (async () => {
      try {
        const settings = await readImportSettings(activeProjectPath);
        const parsed = Jira.parseInput(input, settings.jiraBaseUrl);
        const auth = await Auth.getJira(settings.jiraProfile);

        if (!auth) {
          throw new Error(
            `Missing Jira credentials for profile "${settings.jiraProfile}". Configure credentials in the Auth view first.`,
          );
        }

        const ticket = await Jira.fetchTicket(parsed.baseUrl, parsed.ticketKey, auth);
        const formatted = Jira.formatAsDescription(ticket);

        const config = await resolveAgentConfig(activeProjectPath);
        const backend = new Backend(config.backend, config);
        const model = Config.resolveModel('plan', config);
        const prompt = buildImportPrompt({
          data: formatted,
          source: 'jira',
          tasksDir: config.tasksDir ?? TASKS_DIR,
        });
        const command = backend.buildCommand(prompt, model);

        win.webContents.send('agent:started');
        await agentRunner.spawnAndStream(win, command, activeProjectPath);
        win.webContents.send('agent:complete');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        win.webContents.send('agent:verifyFailed', message);
        win.webContents.send('agent:stopped');
      }
    })();

    return { started: true };
  });
  registerHandler('agent:importFromGitHub', (opts: unknown) => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath || agentRunner.isRunning()) {
      return { started: false };
    }

    const input = parseImportInput(opts);

    void (async () => {
      try {
        const settings = await readImportSettings(activeProjectPath);
        const parsed = GitHub.parseInput(input);
        const auth = await Auth.getGitHub(settings.githubProfile);

        if (!auth) {
          throw new Error(
            `Missing GitHub credentials for profile "${settings.githubProfile}". Configure credentials in the Auth view first.`,
          );
        }

        const issue = await GitHub.fetchIssue(
          parsed.owner,
          parsed.repo,
          parsed.issueNumber,
          auth.token,
        );
        const formatted = GitHub.formatAsDescription(issue, parsed.owner, parsed.repo);

        const config = await resolveAgentConfig(activeProjectPath);
        const backend = new Backend(config.backend, config);
        const model = Config.resolveModel('plan', config);
        const prompt = buildImportPrompt({
          data: formatted,
          source: 'github',
          tasksDir: config.tasksDir ?? TASKS_DIR,
        });
        const command = backend.buildCommand(prompt, model);

        win.webContents.send('agent:started');
        await agentRunner.spawnAndStream(win, command, activeProjectPath);
        win.webContents.send('agent:complete');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        win.webContents.send('agent:verifyFailed', message);
        win.webContents.send('agent:stopped');
      }
    })();

    return { started: true };
  });
  registerHandler('agent:importDryRun', async (opts: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    const input = parseImportInput(opts);

    if (!activeProjectPath) {
      return { prompt: '' };
    }

    const payload = opts as { source?: unknown };
    const source = payload.source === 'github' ? 'github' : 'jira';
    const settings = await readImportSettings(activeProjectPath);

    let formatted = '';

    if (source === 'jira') {
      const parsed = Jira.parseInput(input, settings.jiraBaseUrl);
      const auth = await Auth.getJira(settings.jiraProfile);

      if (!auth) {
        throw new Error(
          `Missing Jira credentials for profile "${settings.jiraProfile}". Configure credentials in the Auth view first.`,
        );
      }

      const ticket = await Jira.fetchTicket(parsed.baseUrl, parsed.ticketKey, auth);
      formatted = Jira.formatAsDescription(ticket);
    } else {
      const parsed = GitHub.parseInput(input);
      const auth = await Auth.getGitHub(settings.githubProfile);

      if (!auth) {
        throw new Error(
          `Missing GitHub credentials for profile "${settings.githubProfile}". Configure credentials in the Auth view first.`,
        );
      }

      const issue = await GitHub.fetchIssue(
        parsed.owner,
        parsed.repo,
        parsed.issueNumber,
        auth.token,
      );
      formatted = GitHub.formatAsDescription(issue, parsed.owner, parsed.repo);
    }

    const config = await resolveAgentConfig(activeProjectPath);

    return {
      prompt: buildImportPrompt({
        data: formatted,
        source,
        tasksDir: config.tasksDir ?? TASKS_DIR,
      }),
    };
  });

  registerHandler('editor:save', async (filePath: unknown, content: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    const requestedPath = String(filePath ?? '');

    if (!activeProjectPath || requestedPath.length === 0) {
      throw new Error('No active project selected');
    }

    const resolvedPath = await resolveEditorFilePath(activeProjectPath, requestedPath, true);

    await writeFile(resolvedPath, String(content ?? ''), 'utf-8');
    return { ok: true };
  });
  registerHandler('editor:snapshot', async (filePath: unknown) => {
    const activeProjectPath = readActiveProjectPath();
    const requestedPath = String(filePath ?? '');

    if (!activeProjectPath || requestedPath.length === 0) {
      return {
        filePath: requestedPath,
        content: '',
      };
    }

    const resolvedPath = await resolveEditorFilePath(activeProjectPath, requestedPath);

    try {
      const snapshot = await readFile(resolvedPath, 'utf-8');
      return {
        filePath: resolvedPath,
        content: snapshot,
      };
    } catch {
      return {
        filePath: resolvedPath,
        content: '',
      };
    }
  });

  registerHandler('import:fetchJira', async (opts: unknown) => {
    const input = parseImportInput(opts);
    const activeProjectPath = readActiveProjectPath();
    const settings = await readImportSettings(activeProjectPath);
    const parsed = Jira.parseInput(input, settings.jiraBaseUrl);
    const auth = await Auth.getJira(settings.jiraProfile);

    if (!auth) {
      throw new Error(
        `Missing Jira credentials for profile "${settings.jiraProfile}". Configure credentials in the Auth view first.`,
      );
    }

    const ticket = await Jira.fetchTicket(parsed.baseUrl, parsed.ticketKey, auth);

    return {
      ticket,
      formatted: Jira.formatAsDescription(ticket),
    };
  });
  registerHandler('import:fetchGitHub', async (opts: unknown) => {
    const input = parseImportInput(opts);
    const activeProjectPath = readActiveProjectPath();
    const settings = await readImportSettings(activeProjectPath);
    const parsed = GitHub.parseInput(input);
    const auth = await Auth.getGitHub(settings.githubProfile);

    if (!auth) {
      throw new Error(
        `Missing GitHub credentials for profile "${settings.githubProfile}". Configure credentials in the Auth view first.`,
      );
    }

    const issue = await GitHub.fetchIssue(
      parsed.owner,
      parsed.repo,
      parsed.issueNumber,
      auth.token,
    );

    return {
      issue,
      owner: parsed.owner,
      repo: parsed.repo,
      formatted: GitHub.formatAsDescription(issue, parsed.owner, parsed.repo),
    };
  });

  registerHandler('auth:list', async () => {
    const store = await Auth.load();
    return {
      jira: store.jira ?? {},
      github: store.github ?? {},
    };
  });
  registerHandler('auth:setJira', async (profile: unknown, credentials: unknown) => {
    const profileName = String(profile ?? '').trim();

    if (profileName.length === 0) {
      throw new Error('Profile name is required');
    }

    if (!isObject(credentials)) {
      throw new Error('Invalid Jira credentials payload');
    }

    const email = String(credentials.email ?? '').trim();
    const apiToken = String(credentials.apiToken ?? '').trim();

    if (email.length === 0 || apiToken.length === 0) {
      throw new Error('Jira email and API token are required');
    }

    await Auth.setJira(profileName, {
      email,
      apiToken,
    });
    return { ok: true };
  });
  registerHandler('auth:setGitHub', async (profile: unknown, credentials: unknown) => {
    const profileName = String(profile ?? '').trim();

    if (profileName.length === 0) {
      throw new Error('Profile name is required');
    }

    if (!isObject(credentials)) {
      throw new Error('Invalid GitHub credentials payload');
    }

    const token = String(credentials.token ?? '').trim();

    if (token.length === 0) {
      throw new Error('GitHub token is required');
    }

    await Auth.setGitHub(profileName, {
      token,
    });
    return { ok: true };
  });
  registerHandler('auth:removeJira', async (profile: unknown) => {
    const profileName = String(profile ?? '').trim();

    if (profileName.length === 0) {
      return { ok: true };
    }

    const store = await Auth.load();

    if (store.jira) {
      delete store.jira[profileName];

      if (Object.keys(store.jira).length === 0) {
        delete store.jira;
      }
    }

    await Auth.save(store);
    return { ok: true };
  });
  registerHandler('auth:removeGitHub', async (profile: unknown) => {
    const profileName = String(profile ?? '').trim();

    if (profileName.length === 0) {
      return { ok: true };
    }

    const store = await Auth.load();

    if (store.github) {
      delete store.github[profileName];

      if (Object.keys(store.github).length === 0) {
        delete store.github;
      }
    }

    await Auth.save(store);
    return { ok: true };
  });

  registerHandler('progress:read', async () => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath) {
      return { content: '' };
    }

    const progressFilePath = resolveProgressFilePath(activeProjectPath);

    try {
      const content = await readFile(progressFilePath, 'utf-8');
      return { content };
    } catch {
      return { content: '' };
    }
  });
  registerHandler('progress:clear', async () => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath) {
      return { ok: true };
    }

    const progressFilePath = resolveProgressFilePath(activeProjectPath);
    await mkdir(dirname(progressFilePath), { recursive: true });
    await writeFile(progressFilePath, '', 'utf-8');

    return { ok: true };
  });

  registerHandler('archive:compact', async () => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath) {
      return { archived: [], archiveFilePath: null };
    }

    const tasksDirPath = resolveTasksDirPath(activeProjectPath);
    const taskFiles = await getTaskFilesInDir(tasksDirPath);
    const completedTasks: Array<{ filePath: string; title: string; content: string }> = [];

    for (const taskFile of taskFiles) {
      const filePath = join(tasksDirPath, taskFile);

      try {
        const content = await readFile(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        if (normalizeTaskStatus(frontmatter.status) !== 'completed') {
          continue;
        }

        completedTasks.push({
          filePath,
          title: parseTitle(content),
          content,
        });
      } catch {
        // skip unreadable task file
      }
    }

    if (completedTasks.length === 0) {
      return { archived: [], archiveFilePath: null };
    }

    const progressFilePath = resolveProgressFilePath(activeProjectPath);
    let progressContent = '';

    try {
      progressContent = await readFile(progressFilePath, 'utf-8');
    } catch {
      progressContent = '';
    }

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString();

    // Write to .ody/history/YYYY-MM-DD/ matching CLI compact format
    const historyDirPath = join(resolveHistoryDirPath(activeProjectPath), dateStamp);
    await mkdir(historyDirPath, { recursive: true });

    // Build tasks.md in CLI format
    let taskArchive = `# Task Archive\n\nGenerated: ${timestamp}\n\nTotal tasks archived: ${completedTasks.length}\n\n---\n\n`;
    for (const task of completedTasks) {
      taskArchive += `## ${task.title}\n\n`;
      taskArchive += `- File: ${task.filePath}\n\n`;
      taskArchive += '```markdown\n';
      taskArchive += `${task.content.trimEnd()}\n`;
      taskArchive += '```\n\n---\n\n';
    }

    const tasksFilePath = join(historyDirPath, 'tasks.md');
    await writeFile(tasksFilePath, taskArchive, 'utf-8');

    // Build progress.md in CLI format
    if (progressContent.trim().length > 0) {
      const progressArchive = `# Progress Log\n\nGenerated: ${timestamp}\n\n---\n\n${progressContent.trimEnd()}\n`;
      const progressArchivePath = join(historyDirPath, 'progress.md');
      await writeFile(progressArchivePath, progressArchive, 'utf-8');
    }

    for (const task of completedTasks) {
      try {
        await rm(task.filePath);
      } catch {
        // ignore delete failures and continue
      }
    }

    await mkdir(dirname(progressFilePath), { recursive: true });
    await writeFile(progressFilePath, '', 'utf-8');

    return {
      archived: completedTasks.map((task) => task.filePath),
      archiveFilePath: tasksFilePath,
    };
  });
  registerHandler('archive:list', async () => {
    const activeProjectPath = readActiveProjectPath();

    if (!activeProjectPath) {
      return [];
    }

    const historyDirPath = resolveHistoryDirPath(activeProjectPath);

    try {
      const entries = await readdir(historyDirPath, { withFileTypes: true });
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const legacyPattern = /^archive-(\d{4}-\d{2}-\d{2})/;

      const archiveMap = new Map<
        string,
        {
          tasks: { filePath: string; content: string; taskCount: number } | null;
          progress: { filePath: string; content: string; taskCount: number } | null;
          legacy: { filePath: string; content: string; taskCount: number } | null;
        }
      >();

      // Process date-stamped subdirectories (YYYY-MM-DD/)
      for (const entry of entries) {
        if (entry.isDirectory() && datePattern.test(entry.name)) {
          const date = entry.name;
          const dirPath = join(historyDirPath, date);
          const group = archiveMap.get(date) ?? { tasks: null, progress: null, legacy: null };

          try {
            const tasksPath = join(dirPath, 'tasks.md');
            const tasksContent = await readFile(tasksPath, 'utf-8');
            group.tasks = {
              filePath: tasksPath,
              content: tasksContent,
              taskCount: parseTaskCountFromArchive(tasksContent),
            };
          } catch {
            // tasks.md may not exist in this date directory
          }

          try {
            const progressPath = join(dirPath, 'progress.md');
            const progressContent = await readFile(progressPath, 'utf-8');
            group.progress = {
              filePath: progressPath,
              content: progressContent,
              taskCount: 0,
            };
          } catch {
            // progress.md may not exist in this date directory
          }

          if (group.tasks || group.progress) {
            archiveMap.set(date, group);
          }
        }
      }

      // Process legacy flat archive files (archive-YYYY-MM-DD*.md)
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const legacyMatch = entry.name.match(legacyPattern);
          if (legacyMatch?.[1]) {
            const date = legacyMatch[1];
            const filePath = join(historyDirPath, entry.name);
            const content = await readFile(filePath, 'utf-8');
            const group = archiveMap.get(date) ?? { tasks: null, progress: null, legacy: null };
            group.legacy = {
              filePath,
              content,
              taskCount: parseTaskCountFromArchive(content),
            };
            archiveMap.set(date, group);
          }
        }
      }

      // Sort by date descending (newest first)
      const sortedDates = [...archiveMap.keys()].sort((a, b) => b.localeCompare(a));

      return sortedDates.map((date) => {
        const group = archiveMap.get(date)!;
        return {
          date,
          tasks: group.tasks,
          progress: group.progress,
          legacy: group.legacy,
        };
      });
    } catch {
      return [];
    }
  });

  registerHandler('projects:list', async () => {
    const { projects } = await cleanupProjects();
    return projects;
  });
  registerHandler('projects:add', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { added: null };
    }

    const projectPath = result.filePaths[0]!;
    const exists = await projectExists(projectPath);
    if (!exists) {
      return { added: null };
    }

    const { projects } = await cleanupProjects();
    const existing = projects.find((project) => project.path === projectPath);
    const added = existing ?? {
      name: projectNameFromPath(projectPath),
      path: projectPath,
    };

    if (!existing) {
      saveProjects([...projects, added]);
    }

    setActiveProject(added.path);
    win.webContents.send('projects:switched', added.path);
    return { added };
  });
  registerHandler('projects:remove', async (projectPath: unknown) => {
    const target = String(projectPath ?? '');
    const { projects, activeProject } = await cleanupProjects();
    const nextProjects = projects.filter((project) => project.path !== target);

    saveProjects(nextProjects);

    if (activeProject === target) {
      const fallback = nextProjects[0]?.path ?? null;
      setActiveProject(fallback);
      win.webContents.send('projects:switched', fallback);
    }

    return { ok: true };
  });
  registerHandler('projects:switch', async (projectPath: unknown) => {
    const target = String(projectPath ?? '');

    if (!(await projectExists(target))) {
      return { ok: false };
    }

    const { projects } = await cleanupProjects();
    if (!projects.some((project) => project.path === target)) {
      saveProjects([...projects, { name: projectNameFromPath(target), path: target }]);
    }

    setActiveProject(target);
    win.webContents.send('projects:switched', target);
    return { ok: true };
  });
  registerHandler('projects:active', async () => {
    const { activeProject } = await cleanupProjects();
    return { path: activeProject };
  });

  registerHandler('theme:get', () => getThemeState());
  registerHandler('theme:set', (source: unknown) => {
    const value = normalizeThemeSource(source);
    appStore.set('themePreference', value);

    const state = {
      source: value,
      resolved: resolveTheme(value),
    };
    win.webContents.send('theme:changed', state);

    return state;
  });

  registerHandler('notifications:sound:get', () => ({
    enabled: appStore.get('soundNotifications', false),
  }));
  registerHandler('notifications:sound:set', (enabled: unknown) => {
    const nextValue = enabled === true;
    appStore.set('soundNotifications', nextValue);
    return { enabled: nextValue };
  });

  registerHandler('system:openExternal', async (url: unknown) => {
    const href = String(url ?? '');

    if (href.length > 0) {
      await shell.openExternal(href);
    }

    return { ok: true };
  });
};
