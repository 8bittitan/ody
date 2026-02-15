import { z } from 'zod';

import { Config } from '../src/lib/config';

const OUT_FILE = './dist/configuration_schema.json';

const result = z.toJSONSchema(Config.Schema, {
  io: 'input',
});

await Bun.write(OUT_FILE, JSON.stringify(result, null, 2));
