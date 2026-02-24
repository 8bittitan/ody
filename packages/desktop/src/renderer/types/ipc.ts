export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type ThemeSource = 'system' | 'light' | 'dark';
export type ThemeResolved = 'light' | 'dark';
export type MenuAction =
  | 'project:add'
  | 'view:tasks'
  | 'view:run'
  | 'view:plan'
  | 'view:config'
  | 'editor:save';

export type RunOptions = {
  projectDir: string;
  taskFiles?: string[];
  iterations?: number;
};

export type RunOnceOptions = {
  projectDir: string;
  prompt?: string;
  filePath?: string;
};

export type TaskSummary = {
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

export type TaskState = {
  filePath: string;
  status: TaskStatus;
};

export type ArchiveEntry = {
  filePath: string;
  createdAt: string;
  taskCount: number;
  content: string;
};

export type ImportSource = 'jira' | 'github';

export type JiraImportTicket = {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  labels: string[];
  components: string[];
  comments: string[];
};

export type GitHubImportIssue = {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  comments: string[];
};

export type ConfigLoadResult = {
  merged: Record<string, unknown> | null;
  localConfigPath: string | null;
  layers: {
    gui: Record<string, unknown> | null;
    local: Record<string, unknown> | null;
    global: Record<string, unknown> | null;
  };
};

export type IpcChannels = {
  'config:load': () => ConfigLoadResult;
  'config:save': (scope: 'gui' | 'local', config: Record<string, unknown>) => { ok: true };
  'config:saveGlobal': (config: Record<string, unknown>) => { ok: true };
  'config:validate': (config: Record<string, unknown>) => { valid: boolean; issues: string[] };
  'config:resetGuiOverrides': () => { ok: true };
  'backends:available': () => string[];
  'backends:models': (backend: string) => string[];
  'tasks:list': () => TaskSummary[];
  'tasks:read': (filePath: string) => { filePath: string; content: string };
  'tasks:delete': (filePaths: string[]) => { deleted: string[] };
  'tasks:byLabel': (label: string) => TaskSummary[];
  'tasks:states': (filePaths?: string[]) => TaskState[];
  'agent:run': (opts: RunOptions) => { started: boolean };
  'agent:runOnce': (opts: RunOnceOptions) => { started: boolean };
  'agent:stop': (force?: boolean) => { stopped: boolean };
  'agent:planNew': (description: string) => { started: boolean };
  'agent:planBatch': (filePath: string) => { started: boolean };
  'agent:planPreview': (description: string) => { prompt: string };
  'agent:planEdit': (filePath: string, prompt: string) => { started: boolean };
  'agent:dryRun': (opts: RunOptions) => { command: string[] };
  'agent:editInline': (opts: {
    filePath: string;
    fileContent: string;
    selection: { from: number; to: number } | null;
    instruction: string;
  }) => { started: boolean };
  'editor:save': (filePath: string, content: string) => { ok: true };
  'editor:snapshot': (filePath: string) => { filePath: string; content: string };
  'import:fetchJira': (opts: { input: string }) => {
    ticket: JiraImportTicket;
    formatted: string;
  };
  'import:fetchGitHub': (opts: { input: string }) => {
    issue: GitHubImportIssue;
    owner: string;
    repo: string;
    formatted: string;
  };
  'agent:importFromJira': (opts: { input: string }) => { started: boolean };
  'agent:importFromGitHub': (opts: { input: string }) => { started: boolean };
  'agent:importDryRun': (opts: { source: ImportSource; input: string }) => { prompt: string };
  'pty:input': (data: string) => { ok: true };
  'pty:resize': (size: { cols: number; rows: number }) => { ok: true };
  'auth:list': () => { jira: Record<string, unknown>; github: Record<string, unknown> };
  'auth:setJira': (profile: string, credentials: Record<string, unknown>) => { ok: true };
  'auth:setGitHub': (profile: string, credentials: Record<string, unknown>) => { ok: true };
  'auth:removeJira': (profile: string) => { ok: true };
  'auth:removeGitHub': (profile: string) => { ok: true };
  'progress:read': () => { content: string };
  'progress:clear': () => { ok: true };
  'archive:compact': () => { archived: string[]; archiveFilePath: string | null };
  'archive:list': () => ArchiveEntry[];
  'projects:list': () => Array<{ name: string; path: string }>;
  'projects:add': () => { added: { name: string; path: string } | null };
  'projects:remove': (path: string) => { ok: true };
  'projects:switch': (path: string) => { ok: boolean };
  'projects:active': () => { path: string | null };
  'theme:get': () => { source: ThemeSource; resolved: ThemeResolved };
  'theme:set': (source: ThemeSource) => { source: ThemeSource; resolved: ThemeResolved };
  'notifications:sound:get': () => { enabled: boolean };
  'notifications:sound:set': (enabled: boolean) => { enabled: boolean };
  'system:openExternal': (url: string) => { ok: true };
};

export type IpcEvents = {
  'agent:started': [];
  'agent:iteration': [iteration: number, maxIterations: number];
  'agent:output': [chunk: string];
  'agent:complete': [];
  'agent:stopped': [];
  'agent:verifyFailed': [message: string];
  'agent:ambiguousMarker': [];
  'agent:editResult': [content: string];
  'projects:switched': [path: string | null];
  'theme:changed': [{ source: ThemeSource; resolved: ThemeResolved }];
  'app:menuAction': [action: MenuAction];
};

export type InvokeChannel = keyof IpcChannels;
export type EventChannel = keyof IpcEvents;

type Asyncify<T> = T extends (...args: infer TArgs) => infer TResult
  ? (...args: TArgs) => Promise<TResult>
  : never;

type Listener<T extends unknown[]> = (...args: T) => void;

export type OdyApi = {
  config: {
    load: Asyncify<IpcChannels['config:load']>;
    save: Asyncify<IpcChannels['config:save']>;
    saveGlobal: Asyncify<IpcChannels['config:saveGlobal']>;
    validate: Asyncify<IpcChannels['config:validate']>;
    resetGuiOverrides: Asyncify<IpcChannels['config:resetGuiOverrides']>;
  };
  backends: {
    available: Asyncify<IpcChannels['backends:available']>;
    models: Asyncify<IpcChannels['backends:models']>;
  };
  tasks: {
    list: Asyncify<IpcChannels['tasks:list']>;
    read: Asyncify<IpcChannels['tasks:read']>;
    delete: Asyncify<IpcChannels['tasks:delete']>;
    byLabel: Asyncify<IpcChannels['tasks:byLabel']>;
    states: Asyncify<IpcChannels['tasks:states']>;
  };
  agent: {
    run: Asyncify<IpcChannels['agent:run']>;
    runOnce: Asyncify<IpcChannels['agent:runOnce']>;
    stop: Asyncify<IpcChannels['agent:stop']>;
    planNew: Asyncify<IpcChannels['agent:planNew']>;
    planBatch: Asyncify<IpcChannels['agent:planBatch']>;
    planPreview: Asyncify<IpcChannels['agent:planPreview']>;
    planEdit: Asyncify<IpcChannels['agent:planEdit']>;
    dryRun: Asyncify<IpcChannels['agent:dryRun']>;
    editInline: Asyncify<IpcChannels['agent:editInline']>;
    importFromJira: Asyncify<IpcChannels['agent:importFromJira']>;
    importFromGitHub: Asyncify<IpcChannels['agent:importFromGitHub']>;
    importDryRun: Asyncify<IpcChannels['agent:importDryRun']>;
    onStarted: (listener: Listener<IpcEvents['agent:started']>) => () => void;
    onIteration: (listener: Listener<IpcEvents['agent:iteration']>) => () => void;
    onOutput: (listener: Listener<IpcEvents['agent:output']>) => () => void;
    onComplete: (listener: Listener<IpcEvents['agent:complete']>) => () => void;
    onStopped: (listener: Listener<IpcEvents['agent:stopped']>) => () => void;
    onVerifyFailed: (listener: Listener<IpcEvents['agent:verifyFailed']>) => () => void;
    onAmbiguousMarker: (listener: Listener<IpcEvents['agent:ambiguousMarker']>) => () => void;
    onEditResult: (listener: Listener<IpcEvents['agent:editResult']>) => () => void;
    removeAllListeners: () => void;
  };
  editor: {
    save: Asyncify<IpcChannels['editor:save']>;
    snapshot: Asyncify<IpcChannels['editor:snapshot']>;
  };
  import: {
    fetchJira: Asyncify<IpcChannels['import:fetchJira']>;
    fetchGitHub: Asyncify<IpcChannels['import:fetchGitHub']>;
  };
  pty: {
    input: Asyncify<IpcChannels['pty:input']>;
    resize: Asyncify<IpcChannels['pty:resize']>;
  };
  auth: {
    list: Asyncify<IpcChannels['auth:list']>;
    setJira: Asyncify<IpcChannels['auth:setJira']>;
    setGitHub: Asyncify<IpcChannels['auth:setGitHub']>;
    removeJira: Asyncify<IpcChannels['auth:removeJira']>;
    removeGitHub: Asyncify<IpcChannels['auth:removeGitHub']>;
  };
  progress: {
    read: Asyncify<IpcChannels['progress:read']>;
    clear: Asyncify<IpcChannels['progress:clear']>;
  };
  archive: {
    compact: Asyncify<IpcChannels['archive:compact']>;
    list: Asyncify<IpcChannels['archive:list']>;
  };
  projects: {
    list: Asyncify<IpcChannels['projects:list']>;
    add: Asyncify<IpcChannels['projects:add']>;
    remove: Asyncify<IpcChannels['projects:remove']>;
    switch: Asyncify<IpcChannels['projects:switch']>;
    active: Asyncify<IpcChannels['projects:active']>;
    onSwitched: (listener: Listener<IpcEvents['projects:switched']>) => () => void;
    removeAllListeners: () => void;
  };
  theme: {
    get: Asyncify<IpcChannels['theme:get']>;
    set: Asyncify<IpcChannels['theme:set']>;
    onChanged: (listener: Listener<IpcEvents['theme:changed']>) => () => void;
    removeAllListeners: () => void;
  };
  notifications: {
    getSoundEnabled: Asyncify<IpcChannels['notifications:sound:get']>;
    setSoundEnabled: Asyncify<IpcChannels['notifications:sound:set']>;
  };
  app: {
    onMenuAction: (listener: Listener<IpcEvents['app:menuAction']>) => () => void;
    removeAllListeners: () => void;
  };
  system: {
    openExternal: Asyncify<IpcChannels['system:openExternal']>;
  };
};

declare global {
  interface Window {
    ody: OdyApi;
  }
}
