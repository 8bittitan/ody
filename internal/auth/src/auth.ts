import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type JiraCredentials = {
  email: string;
  apiToken: string;
};

export type GitHubCredentials = {
  token: string;
};

export type AuthStore = {
  jira?: Record<string, JiraCredentials>;
  github?: Record<string, GitHubCredentials>;
};

function resolveDataDir(): string {
  return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
}

function resolveAuthDir(): string {
  return path.join(resolveDataDir(), 'ody');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJiraCredentials(value: unknown): value is JiraCredentials {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.email === 'string' && typeof value.apiToken === 'string';
}

function isGitHubCredentials(value: unknown): value is GitHubCredentials {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.token === 'string';
}

function parseCredentialsMap<T>(
  value: unknown,
  validator: (credential: unknown) => credential is T,
): Record<string, T> {
  if (!isObject(value)) {
    throw new Error('Invalid auth store format.');
  }

  const credentials: Record<string, T> = {};

  for (const [profile, credential] of Object.entries(value)) {
    if (!validator(credential)) {
      throw new Error('Invalid auth store format.');
    }

    credentials[profile] = credential;
  }

  return credentials;
}

function parseAuthStore(raw: unknown): AuthStore {
  if (!isObject(raw)) {
    throw new Error('Invalid auth store format.');
  }

  const store: AuthStore = {};

  if (raw.jira !== undefined) {
    store.jira = parseCredentialsMap(raw.jira, isJiraCredentials);
  }

  if (raw.github !== undefined) {
    store.github = parseCredentialsMap(raw.github, isGitHubCredentials);
  }

  return store;
}

export namespace Auth {
  export function resolveAuthPath(): string {
    return path.join(resolveAuthDir(), 'auth.json');
  }

  export async function load(): Promise<AuthStore> {
    const authPath = resolveAuthPath();

    try {
      const content = await readFile(authPath, 'utf-8');
      return parseAuthStore(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }

      throw error;
    }
  }

  export async function save(store: AuthStore): Promise<void> {
    const authPath = resolveAuthPath();
    const dir = path.dirname(authPath);

    await mkdir(dir, { recursive: true });
    await writeFile(authPath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
    await chmod(authPath, 0o600);
  }

  export async function getJira(profile = 'default'): Promise<JiraCredentials | undefined> {
    const store = await load();
    return store.jira?.[profile];
  }

  export async function setJira(profile: string, credentials: JiraCredentials): Promise<void> {
    const store = await load();

    if (!store.jira) {
      store.jira = {};
    }

    store.jira[profile] = credentials;
    await save(store);
  }

  export async function getGitHub(profile = 'default'): Promise<GitHubCredentials | undefined> {
    const store = await load();
    return store.github?.[profile];
  }

  export async function setGitHub(profile: string, credentials: GitHubCredentials): Promise<void> {
    const store = await load();

    if (!store.github) {
      store.github = {};
    }

    store.github[profile] = credentials;
    await save(store);
  }
}
