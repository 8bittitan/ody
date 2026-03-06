import { exists, mkdir } from 'fs/promises';
import path from 'path';

import {
  autocomplete,
  isCancel,
  outro,
  log,
  intro,
  text,
  cancel,
  confirm,
  select,
} from '@clack/prompts';
import { getAvailableBackends } from '@internal/backends';
import {
  BASE_DIR,
  DOCS_WEBSITE_URL,
  ODY_FILE,
  backendsSchema,
  Config,
  type OdyConfig,
} from '@internal/config';
import { defineCommand } from 'citty';

import { getRandomValidatorPlaceholder } from '../util/inputPrompt';

const CANCELLED_PROMPT = Symbol('cancelled-prompt');

export function normalizeOptionalPromptValue(value: string | symbol) {
  if (typeof value === 'symbol' || isCancel(value)) {
    return CANCELLED_PROMPT;
  }

  return value.trim();
}

async function getOpencodeModels() {
  try {
    const proc = Bun.spawn(['opencode', 'models'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdoutBuffer = await Bun.readableStreamToArrayBuffer(proc.stdout);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return [];
    }

    const output = new TextDecoder().decode(stdoutBuffer);

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export const initCmd = defineCommand({
  meta: {
    name: 'init',
    description: 'Initializes and sets up Ody for the current project',
  },
  args: {
    backend: {
      alias: 'b',
      required: false,
      description: 'Agent harness to use (claude, opencode, codex)',
      type: 'string',
    },
    maxIterations: {
      alias: 'i',
      required: false,
      default: '0',
      description: 'Max number of loops to run. 0 = infinite',
      valueHint: 'Default is 0 (infinite)',
      type: 'string',
    },
    model: {
      alias: 'm',
      required: false,
      description: 'Which model to use for the respective backend',
      type: 'string',
    },
    shouldCommit: {
      alias: 'c',
      required: false,
      default: false,
      description: 'If the agent should create commits after each task completion',
      type: 'boolean',
    },
    agent: {
      alias: 'a',
      required: false,
      description: 'Agent profile/persona for the backend harness (default: build)',
      type: 'string',
    },
    notify: {
      alias: 'n',
      required: false,
      description: 'Notification preference (false, all, individual)',
      type: 'string',
    },
    ['dry-run']: {
      default: false,
      description: "Don't save the configuration, just print out what would be saved at the end",
      type: 'boolean',
    },
  },
  async run({ args }) {
    try {
      const outDir = path.join(process.cwd(), BASE_DIR);

      intro(`Initializing Ody in ${outDir}`);

      if (!(await exists(outDir))) {
        await mkdir(outDir);
      }

      let backend = args.backend;

      const availableBackends = getAvailableBackends();

      const isBackendAvailable = backend && availableBackends.find((b) => b.value === backend);

      if (!isBackendAvailable) {
        if (backend) {
          log.warn(`Selected backend is not available on your system: ${backend}`);
        }

        const choice = await autocomplete({
          message: 'PLease select which backend to use: ',
          placeholder: 'Type to search',
          options: availableBackends,
        });

        if (isCancel(choice)) {
          cancel('Must provide a backend to use.');
          process.exit(0);
        }

        backend = choice;
      }

      if (!backend) {
        log.error('Must provide a backend to use');
        process.exit(0);
      }

      const configInput: OdyConfig = {
        backend: backendsSchema.parse(backend),
        maxIterations: parseInt(args.maxIterations, 10),
        shouldCommit: args.shouldCommit,
      };

      let model = args.model;

      if (!model) {
        if (backend === 'opencode') {
          const models = await getOpencodeModels();

          if (models.length > 0) {
            const modelChoice = await autocomplete({
              message: 'Select a model to use with OpenCode',
              placeholder: 'Type to search, leave blank for default',
              options: [
                { label: 'Default (backend decides)', value: '' },
                ...models.map((m) => ({ label: m, value: m })),
              ],
            });

            if (isCancel(modelChoice)) {
              cancel('Model selection cancelled.');
              process.exit(0);
            }

            model = modelChoice;
          } else {
            log.warn('Could not load models from `opencode models`. Falling back to manual entry.');
            const manualModelEntry = normalizeOptionalPromptValue(
              await text({
                message: 'You can choose a model to use for your backend',
                placeholder: 'Leave blank to use default model set on backend',
                defaultValue: '',
              }),
            );

            if (manualModelEntry === CANCELLED_PROMPT) {
              cancel('Model selection cancelled.');
              process.exit(0);
            }

            model = manualModelEntry;
          }
        } else {
          const manualModelEntry = normalizeOptionalPromptValue(
            await text({
              message: 'You can choose a model to use for your backend',
              placeholder: 'Leave blank to use default model set on backend',
              defaultValue: '',
            }),
          );

          if (manualModelEntry === CANCELLED_PROMPT) {
            cancel('Model selection cancelled.');
            process.exit(0);
          }

          model = manualModelEntry;
        }
      }

      if (model && model.trim() !== '') {
        configInput.model = model.trim();
      }

      let agent = args.agent;

      if (!agent) {
        const agentEntry = normalizeOptionalPromptValue(
          await text({
            message: 'Agent profile/persona for the backend harness',
            placeholder: 'Leave blank to use default (build)',
            defaultValue: '',
          }),
        );

        if (agentEntry === CANCELLED_PROMPT) {
          cancel('Agent selection cancelled.');
          process.exit(0);
        }

        agent = agentEntry;
      }

      if (agent && agent.trim() !== '') {
        configInput.agent = agent.trim();
      }

      const validatorCommands: string[] = [];

      const shouldPromptValidationCommands = await confirm({
        message:
          'Would you like to specify validation commands for agent to run after making changes?',
      });

      if (shouldPromptValidationCommands) {
        while (true) {
          const validationCommand = await text({
            message:
              'Please enter a command for the agent to validate with (leave blank to finish)',
            placeholder: getRandomValidatorPlaceholder(),
          });

          if (isCancel(validationCommand) || validationCommand.trim() === '') {
            break;
          }

          validatorCommands.push(validationCommand.trim());
        }
      }

      configInput.validatorCommands = validatorCommands;

      if (backend === 'claude') {
        const skipPermissions = await confirm({
          message:
            "Skip Claude Code permission checks? (⚠ This bypasses Claude Code's safety system)",
          initialValue: true,
        });

        if (!isCancel(skipPermissions)) {
          configInput.skipPermissions = skipPermissions;
        }
      }

      if (args.notify) {
        const val = args.notify.toLowerCase();

        if (val === 'false' || val === 'off' || val === 'none') {
          configInput.notify = false;
        } else if (val === 'all' || val === 'true') {
          configInput.notify = 'all';
        } else if (val === 'individual') {
          configInput.notify = 'individual';
        }
      } else {
        const notifyChoice = await select<false | 'all' | 'individual'>({
          message: 'When should OS notifications be sent?',
          options: [
            {
              value: false as const,
              label: 'Disabled',
              hint: 'No notifications',
            },
            {
              value: 'all' as const,
              label: 'On completion',
              hint: 'Notify when the entire run finishes',
            },
            {
              value: 'individual' as const,
              label: 'Per iteration',
              hint: 'Notify after each loop iteration',
            },
          ],
        });

        if (!isCancel(notifyChoice)) {
          configInput.notify = notifyChoice;
        }
      }

      const parsedConfig = Config.parse(configInput);
      const configToSave = JSON.stringify(
        { $schema: `${DOCS_WEBSITE_URL}/configuration_schema.json`, ...parsedConfig },
        null,
        2,
      );

      if (args['dry-run']) {
        log.info(configToSave);
        outro('Dry run complete');
        process.exit(0);
      }

      log.step('Saving configuration');

      await Bun.write(path.join(outDir, ODY_FILE), configToSave);

      log.success('Configuration saved');

      outro('Ody Initialized');
    } catch (err) {
      if (Error.isError(err)) {
        log.error(err.message);
      } else {
        log.error(String(err));
      }

      process.exit(1);
    }
  },
});
