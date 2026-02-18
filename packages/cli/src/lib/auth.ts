import { chmod, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { xdgData } from 'xdg-basedir';
import { z } from 'zod';

const jiraCredentialsSchema = z.object({
  email: z.string(),
  apiToken: z.string(),
});

const authStoreSchema = z.object({
  jira: z.record(z.string(), jiraCredentialsSchema).optional(),
});

export type JiraCredentials = z.infer<typeof jiraCredentialsSchema>;
export type AuthStore = z.infer<typeof authStoreSchema>;

function resolveDataDir(): string {
  return xdgData ?? path.join(os.homedir(), '.local', 'share');
}

function resolveAuthDir(): string {
  return path.join(resolveDataDir(), 'ody');
}

export namespace Auth {
  export function resolveAuthPath(): string {
    return path.join(resolveAuthDir(), 'auth.json');
  }

  export async function load(): Promise<AuthStore> {
    const authPath = resolveAuthPath();
    const file = Bun.file(authPath);

    if (!(await file.exists())) {
      return {};
    }

    const content = await file.text();
    const raw = JSON.parse(content);

    return authStoreSchema.parse(raw);
  }

  export async function save(store: AuthStore): Promise<void> {
    const authPath = resolveAuthPath();
    const dir = path.dirname(authPath);

    await mkdir(dir, { recursive: true });
    await Bun.write(authPath, JSON.stringify(store, null, 2) + '\n');
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
}
