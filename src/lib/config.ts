import path from 'path';
import { z } from 'zod';

import { ALLOWED_BACKENDS, BASE_DIR, ODY_FILE } from '../util/constants';
import { logger } from './logger';

const configSchema = z.object({
  backend: z
    .string()
    .nonempty()
    .refine((val) => {
      return ALLOWED_BACKENDS.includes(val);
    }),
  maxIterations: z.number(),
  shouldCommit: z.boolean().default(false),
  validatorCommands: z.array(z.string()).default([]),
  provider: z.string().optional(),
  model: z.string().optional(),
});

type OdyConfig = z.infer<typeof configSchema>;

export namespace Config {
  let config: OdyConfig | undefined = undefined;

  export async function load() {
    if (config) {
      return;
    }

    logger.debug('Loading configuration');

    try {
      const input = await Bun.file(path.join(BASE_DIR, ODY_FILE)).text();
      const parsed = JSON.parse(input);

      config = parse(parsed);
    } catch (err) {
      logger.fatal(err);
    }
  }

  export function parse(raw: any) {
    return configSchema.parse(raw);
  }

  export function all() {
    if (!config) {
      logger.fatal('Must `.load` Config first');
      throw new Error('Config not loaded');
    }

    return config;
  }

  export function get<K extends keyof OdyConfig>(key: K): OdyConfig[K] {
    if (!config) {
      logger.fatal('Must `.load` Config first');
      throw new Error('Config not loaded');
    }

    return config[key];
  }
}
