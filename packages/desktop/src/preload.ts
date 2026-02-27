import { contextBridge, ipcRenderer } from 'electron';

import type { IpcEvents, OdyApi } from './renderer/types/ipc';

const addListener = <TChannel extends keyof IpcEvents>(
  channel: TChannel,
  listener: (...args: IpcEvents[TChannel]) => void,
) => {
  const wrapped = (_event: unknown, ...args: IpcEvents[TChannel]) => {
    listener(...args);
  };

  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

const ody: OdyApi = {
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (scope, config) => ipcRenderer.invoke('config:save', scope, config),
    saveGlobal: (config) => ipcRenderer.invoke('config:saveGlobal', config),
    validate: (config) => ipcRenderer.invoke('config:validate', config),
    resetGuiOverrides: () => ipcRenderer.invoke('config:resetGuiOverrides'),
  },
  backends: {
    available: () => ipcRenderer.invoke('backends:available'),
    models: (backend) => ipcRenderer.invoke('backends:models', backend),
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    read: (filePath) => ipcRenderer.invoke('tasks:read', filePath),
    delete: (filePaths) => ipcRenderer.invoke('tasks:delete', filePaths),
    byLabel: (label) => ipcRenderer.invoke('tasks:byLabel', label),
    states: (filePaths) => ipcRenderer.invoke('tasks:states', filePaths),
  },
  agent: {
    run: (opts) => ipcRenderer.invoke('agent:run', opts),
    stop: (force) => ipcRenderer.invoke('agent:stop', force),
    planNew: (description) => ipcRenderer.invoke('agent:planNew', description),
    planBatch: (filePath) => ipcRenderer.invoke('agent:planBatch', filePath),
    planPreview: (description) => ipcRenderer.invoke('agent:planPreview', description),
    planEdit: (filePath, prompt) => ipcRenderer.invoke('agent:planEdit', filePath, prompt),
    dryRun: (opts) => ipcRenderer.invoke('agent:dryRun', opts),
    editInline: (opts) => ipcRenderer.invoke('agent:editInline', opts),
    importFromJira: (opts) => ipcRenderer.invoke('agent:importFromJira', opts),
    importFromGitHub: (opts) => ipcRenderer.invoke('agent:importFromGitHub', opts),
    importDryRun: (opts) => ipcRenderer.invoke('agent:importDryRun', opts),
    onStarted: (listener) => addListener('agent:started', listener),
    onIteration: (listener) => addListener('agent:iteration', listener),
    onOutput: (listener) => addListener('agent:output', listener),
    onComplete: (listener) => addListener('agent:complete', listener),
    onStopped: (listener) => addListener('agent:stopped', listener),
    onVerifyFailed: (listener) => addListener('agent:verifyFailed', listener),
    onAmbiguousMarker: (listener) => addListener('agent:ambiguousMarker', listener),
    onEditResult: (listener) => addListener('agent:editResult', listener),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('agent:started');
      ipcRenderer.removeAllListeners('agent:iteration');
      ipcRenderer.removeAllListeners('agent:output');
      ipcRenderer.removeAllListeners('agent:complete');
      ipcRenderer.removeAllListeners('agent:stopped');
      ipcRenderer.removeAllListeners('agent:verifyFailed');
      ipcRenderer.removeAllListeners('agent:ambiguousMarker');
      ipcRenderer.removeAllListeners('agent:editResult');
    },
  },
  editor: {
    save: (filePath, content) => ipcRenderer.invoke('editor:save', filePath, content),
    snapshot: (filePath) => ipcRenderer.invoke('editor:snapshot', filePath),
  },
  import: {
    fetchJira: (opts) => ipcRenderer.invoke('import:fetchJira', opts),
    fetchGitHub: (opts) => ipcRenderer.invoke('import:fetchGitHub', opts),
  },
  auth: {
    list: () => ipcRenderer.invoke('auth:list'),
    setJira: (profile, credentials) => ipcRenderer.invoke('auth:setJira', profile, credentials),
    setGitHub: (profile, credentials) => ipcRenderer.invoke('auth:setGitHub', profile, credentials),
    removeJira: (profile) => ipcRenderer.invoke('auth:removeJira', profile),
    removeGitHub: (profile) => ipcRenderer.invoke('auth:removeGitHub', profile),
  },
  progress: {
    read: () => ipcRenderer.invoke('progress:read'),
    clear: () => ipcRenderer.invoke('progress:clear'),
  },
  archive: {
    compact: () => ipcRenderer.invoke('archive:compact'),
    list: () => ipcRenderer.invoke('archive:list'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    add: () => ipcRenderer.invoke('projects:add'),
    remove: (path) => ipcRenderer.invoke('projects:remove', path),
    switch: (path) => ipcRenderer.invoke('projects:switch', path),
    active: () => ipcRenderer.invoke('projects:active'),
    onSwitched: (listener) => addListener('projects:switched', listener),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('projects:switched');
    },
  },
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (source) => ipcRenderer.invoke('theme:set', source),
    onChanged: (listener) => addListener('theme:changed', listener),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('theme:changed');
    },
  },
  notifications: {
    getSoundEnabled: () => ipcRenderer.invoke('notifications:sound:get'),
    setSoundEnabled: (enabled) => ipcRenderer.invoke('notifications:sound:set', enabled),
  },
  app: {
    onFullscreen: (listener) => addListener('app:fullscreen-status', listener),
    onMenuAction: (listener) => addListener('app:menuAction', listener),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('app:menuAction');
    },
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
  },
};

contextBridge.exposeInMainWorld('ody', ody);
