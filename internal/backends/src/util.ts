import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, extname, join } from 'node:path';

type AvailableBackend = {
  label: string;
  value: string;
};

const DEFAULT_WINDOWS_EXTENSIONS = ['.com', '.exe', '.bat', '.cmd'];

const getPathEntries = (): string[] => {
  const currentPath = process.env.PATH;

  if (!currentPath) {
    return [];
  }

  return currentPath.split(delimiter).filter(Boolean);
};

const getWindowsExtensions = (): string[] => {
  const pathExt = process.env.PATHEXT;

  if (!pathExt) {
    return DEFAULT_WINDOWS_EXTENSIONS;
  }

  const extensions = pathExt
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`));

  return extensions.length > 0 ? extensions : DEFAULT_WINDOWS_EXTENSIONS;
};

const getExecutableCandidates = (binary: string): string[] => {
  if (process.platform !== 'win32') {
    return [binary];
  }

  const windowsExtensions = getWindowsExtensions();
  const binaryExtension = extname(binary).toLowerCase();

  if (binaryExtension && windowsExtensions.includes(binaryExtension)) {
    return [binary];
  }

  return [binary, ...windowsExtensions.map((extension) => `${binary}${extension}`)];
};

const isExecutableFile = (path: string): boolean => {
  try {
    if (!statSync(path).isFile()) {
      return false;
    }

    if (process.platform === 'win32') {
      return true;
    }

    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const isOnPath = (binary: string): boolean => {
  const pathEntries = getPathEntries();
  const candidates = getExecutableCandidates(binary);

  for (const directory of pathEntries) {
    for (const candidate of candidates) {
      if (isExecutableFile(join(directory, candidate))) {
        return true;
      }
    }
  }

  return false;
};

export const getAvailableBackends = (): AvailableBackend[] => {
  const backends: AvailableBackend[] = [];

  if (isOnPath('opencode')) {
    backends.push({
      label: 'OpenCode',
      value: 'opencode',
    });
  }

  if (isOnPath('claude')) {
    backends.push({
      label: 'Claude Code',
      value: 'claude',
    });
  }

  if (isOnPath('codex')) {
    backends.push({
      label: 'Codex',
      value: 'codex',
    });
  }

  return backends;
};
