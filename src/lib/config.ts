import { log } from '@clack/prompts';
import path from 'path';
import { z } from 'zod';

import { ALLOWED_BACKENDS, BASE_DIR, ODY_FILE } from '../util/constants';

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
});

export type OdyConfig = z.infer<typeof configSchema>;

export namespace Config {
  let config: OdyConfig | undefined = undefined;

  export async function load() {
    if (config) {
      return;
    }

    const file = Bun.file(path.join(BASE_DIR, ODY_FILE));

    if (!(await file.exists())) {
      return;
    }

    log.info('Loading configuration');

    try {
      const input = await file.text();
      const parsed = JSON.parse(input);

      config = parse(parsed);
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
      log.error('Must `.load` configuration first');
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
