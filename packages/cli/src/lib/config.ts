import { log } from '@clack/prompts';
import os from 'os';
import path from 'path';
import { z } from 'zod';

import { ALLOWED_BACKENDS, BASE_DIR, ODY_FILE, TASKS_DIR } from '../util/constants';

const configSchema = z.object({
  backend: z
    .string()
    .nonempty()
    .refine((val) => {
      return ALLOWED_BACKENDS.includes(val);
    }),
  maxIterations: z.number().int().nonnegative(),
  shouldCommit: z.boolean().default(false),
  validatorCommands: z.array(z.string()).default([]).optional(),
  model: z.string().optional(),
  skipPermissions: z.boolean().default(true).optional(),
  agent: z.string().nonempty().default('build').optional(),
  tasksDir: z.string().nonempty().default(TASKS_DIR).optional(),
  notify: z
    .union([z.boolean(), z.enum(['all', 'individual'])])
    .default(false)
    .optional(),
});

export type OdyConfig = z.infer<typeof configSchema>;

function getHomeDir(): string {
  return Bun.env.HOME ?? Bun.env.USERPROFILE ?? os.homedir();
}

async function resolveGlobalConfigPath(): Promise<string | undefined> {
  const home = getHomeDir();

  const primaryPath = path.join(home, '.ody', ODY_FILE);
  const primaryFile = Bun.file(primaryPath);

  if (await primaryFile.exists()) {
    return primaryPath;
  }

  const xdgPath = path.join(home, '.config', 'ody', ODY_FILE);
  const xdgFile = Bun.file(xdgPath);

  if (await xdgFile.exists()) {
    return xdgPath;
  }

  return undefined;
}

async function loadJsonFile(filePath: string): Promise<Record<string, unknown> | undefined> {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return undefined;
  }

  const input = await file.text();

  return JSON.parse(input) as Record<string, unknown>;
}

export namespace Config {
  let config: OdyConfig | undefined = undefined;

  export async function load() {
    if (config) {
      return;
    }

    try {
      let globalRaw: Record<string, unknown> | undefined;
      let localRaw: Record<string, unknown> | undefined;

      const globalConfigPath = await resolveGlobalConfigPath();

      if (globalConfigPath) {
        globalRaw = await loadJsonFile(globalConfigPath);
      }

      const localPath = path.join(BASE_DIR, ODY_FILE);
      const localFile = Bun.file(localPath);

      if (await localFile.exists()) {
        localRaw = await loadJsonFile(localPath);
      }

      if (!globalRaw && !localRaw) {
        return;
      }

      const merged = { ...globalRaw, ...localRaw };

      config = parse(merged);
    } catch (err) {
      if (Error.isError(err)) {
        log.error(err.message);
      } else {
        log.error(String(err));
      }

      process.exit(1);
    }
  }

  export function parse(raw: any) {
    return configSchema.parse(raw);
  }

  export function all() {
    if (!config) {
      throw new Error('Config not loaded');
    }

    return config;
  }

  export function get<K extends keyof OdyConfig>(key: K): OdyConfig[K] {
    if (!config) {
      log.error('Must `.load` configuration first');
      throw new Error('Config not loaded');
    }

    return config[key];
  }
}
