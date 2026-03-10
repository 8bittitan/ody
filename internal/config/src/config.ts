import { access, readFile } from 'node:fs/promises';
import os from 'os';
import path from 'path';

import { z } from 'zod';

import { ALLOWED_BACKENDS, BASE_DIR, ODY_FILE, TASKS_DIR } from './constants';

export const backendsSchema = z.union(ALLOWED_BACKENDS.map((backend) => z.literal(backend)));
const notifySchema = z
  .union([z.boolean(), z.enum(['all', 'individual'])])
  .default(false)
  .optional();

const jiraSchema = z
  .object({
    baseUrl: z.url(),
    profile: z.string().optional(),
  })
  .optional();

const githubSchema = z
  .object({
    profile: z.string().optional(),
  })
  .optional();

const commandModelsSchema = z.object({
  run: z.string(),
  plan: z.string(),
  edit: z.string(),
});

export const configSchema = z.object({
  backend: backendsSchema,
  maxIterations: z.number().int().nonnegative(),
  autoCommit: z.boolean().default(false),
  validatorCommands: z.array(z.string()).default([]).optional(),
  model: z.union([z.string(), commandModelsSchema]).optional(),
  skipPermissions: z.boolean().default(true).optional(),
  agent: z.string().nonempty().default('build').optional(),
  tasksDir: z.string().nonempty().default(TASKS_DIR).optional(),
  notify: notifySchema,
  jira: jiraSchema,
  github: githubSchema,
});

export type OdyConfig = z.infer<typeof configSchema>;

function getHomeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveGlobalConfigPath(): Promise<string | undefined> {
  const home = getHomeDir();

  const primaryPath = path.join(home, '.ody', ODY_FILE);
  if (await exists(primaryPath)) {
    return primaryPath;
  }

  const xdgPath = path.join(home, '.config', 'ody', ODY_FILE);
  if (await exists(xdgPath)) {
    return xdgPath;
  }

  return undefined;
}

async function loadJsonFile(filePath: string): Promise<Record<string, unknown> | undefined> {
  if (!(await exists(filePath))) {
    return undefined;
  }

  const input = await readFile(filePath, 'utf-8');
  return JSON.parse(input) as Record<string, unknown>;
}

function migrateDeprecatedKeys(raw: Record<string, unknown>): void {
  if ('shouldCommit' in raw) {
    console.warn('[ody] Config key "shouldCommit" is deprecated. Use "autoCommit" instead.');

    if (!('autoCommit' in raw)) {
      raw.autoCommit = raw.shouldCommit;
    }

    delete raw.shouldCommit;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override ?? {})) {
    const current = result[key];

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

export namespace Config {
  let config: OdyConfig | undefined = undefined;

  export const SKIPPABLE_COMMANDS = ['auth', 'init', 'update'];

  export function shouldSkipConfig(cmd: string) {
    let shouldSkip = false;

    for (const c of SKIPPABLE_COMMANDS) {
      if (c === cmd) {
        shouldSkip = true;
        break;
      }
    }

    return shouldSkip;
  }

  export const Schema = z
    .object({
      $schema: z.string().optional().describe('JSON schema reference for configuration validation'),
      backend: backendsSchema.describe('Backend harness to use for agent'),
      maxIterations: z
        .number()
        .int()
        .nonnegative()
        .describe('Max number of iterations to run in the loop (0 = infinite)'),
      autoCommit: z
        .boolean()
        .default(false)
        .describe('Generate a commit after each loop iteration'),
      validatorCommands: z
        .array(z.string())
        .default([])
        .optional()
        .describe('Specific commands the agent can use to verify the code is in good shape'),
      model: z
        .union([
          z.string().describe('What model the agent should use for the backend'),
          commandModelsSchema.describe('Per-command model overrides'),
        ])
        .optional()
        .describe('What model the agent should use for the backend'),
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
      jira: z
        .object({
          baseUrl: z.url().describe('Jira instance base URL (e.g., https://company.atlassian.net)'),
          profile: z
            .string()
            .optional()
            .describe('Named credential profile from auth store (defaults to "default")'),
        })
        .optional()
        .describe('Jira integration settings'),
      github: z
        .object({
          profile: z
            .string()
            .optional()
            .describe('Named credential profile from auth store (defaults to "default")'),
        })
        .optional()
        .describe('GitHub integration settings'),
    })
    .strict()
    .meta({
      ref: 'Config',
    });

  export async function load() {
    if (config) {
      return;
    }

    let globalRaw: Record<string, unknown> | undefined;
    let localRaw: Record<string, unknown> | undefined;

    const globalConfigPath = await resolveGlobalConfigPath();
    if (globalConfigPath) {
      globalRaw = await loadJsonFile(globalConfigPath);
    }

    const localPath = path.join(BASE_DIR, ODY_FILE);
    if (await exists(localPath)) {
      localRaw = await loadJsonFile(localPath);
    }

    if (!globalRaw && !localRaw) {
      throw new Error('No Ody configuration found. Run `ody init` to get started.');
    }

    const merged = deepMerge(globalRaw, localRaw);
    migrateDeprecatedKeys(merged);
    config = parse(merged);
  }

  export function parse(raw: unknown) {
    return configSchema.parse(raw);
  }

  export function all() {
    if (!config) {
      throw new Error('No Ody configuration found. Run `ody init` to get started.');
    }

    return config;
  }

  export function get<K extends keyof OdyConfig>(key: K): OdyConfig[K] {
    if (!config) {
      throw new Error('No Ody configuration found. Run `ody init` to get started.');
    }

    return config[key];
  }

  export function resolveModel(
    command: 'run' | 'plan' | 'edit',
    source: Pick<OdyConfig, 'model'> = all(),
  ) {
    if (typeof source.model === 'string') {
      return source.model;
    }

    return source.model?.[command];
  }
}
