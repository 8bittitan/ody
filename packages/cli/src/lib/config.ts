import { log } from '@clack/prompts';
import os from 'os';
import path from 'path';
import { z } from 'zod';

import { ALLOWED_BACKENDS, BASE_DIR, ODY_FILE, TASKS_DIR } from '../util/constants';

export const backendsSchema = z.union(ALLOWED_BACKENDS.map((backend) => z.literal(backend)));
const notifySchema = z
  .union([z.boolean(), z.enum(['all', 'individual'])])
  .default(false)
  .optional();

const configSchema = z.object({
  backend: backendsSchema,
  maxIterations: z.number().int().nonnegative(),
  shouldCommit: z.boolean().default(false),
  validatorCommands: z.array(z.string()).default([]).optional(),
  model: z.string().optional(),
  skipPermissions: z.boolean().default(true).optional(),
  agent: z.string().nonempty().default('build').optional(),
  tasksDir: z.string().nonempty().default(TASKS_DIR).optional(),
  notify: notifySchema,
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

  export const Schema = z
    .object({
      $schema: z.string().optional().describe('JSON schema reference for configuration validation'),
      backend: backendsSchema.describe('Backend harness to use for agent'),
      maxIterations: z
        .number()
        .int()
        .nonnegative()
        .describe('Max number of iterations to run in the loop (0 = infinite)'),
      shouldCommit: z
        .boolean()
        .default(false)
        .describe('Generate a commit after each loop iteration'),
      validatorCommands: z
        .array(z.string())
        .default([])
        .optional()
        .describe('Specific commands the agent can use to verify the code is in good shape'),
      model: z.string().optional().describe('What model the agent should use for the backend'),
      skipPermissions: z.boolean().default(true).optional(),
      agent: z
        .string()
        .nonempty()
        .default('build')
        .optional()
        .describe('What harness agent should be used'),
      tasksDir: z
        .string()
        .nonempty()
        .default(TASKS_DIR)
        .optional()
        .describe('Custom path for the tasks directory'),
      notify: notifySchema.describe('Whether to dispatch OS notification'),
    })
    .strict()
    .meta({
      ref: 'Config',
    });

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
