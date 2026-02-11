import { isCancel, log, outro, select, text, confirm, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';
import { mkdir, readdir, rm } from 'fs/promises';
import path from 'path';

import { Backend } from '../backends/backend';
import { buildEditPlanPrompt } from '../builders/editPlanPrompt';
import { buildPlanPrompt } from '../builders/planPrompt';
import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { Stream } from '../util/stream';

const spin = spinner();

function resolveTasksDir() {
  return path.join(BASE_DIR, Config.get('tasksDir') ?? TASKS_DIR);
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match || !match[1]) return {};

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    fields[key] = value;
  }
  return fields;
}

function parseTitle(content: string): string {
  const match = content.match(/^#\s+(?:Task:\s*)?(.+)$/m);
  return match && match[1] ? match[1].trim() : 'Untitled';
}

const listCmd = defineCommand({
  meta: {
    name: 'list',
    description: 'List pending tasks',
  },
  async run() {
    const tasksDir = resolveTasksDir();

    let files: string[];
    try {
      files = await readdir(tasksDir);
    } catch {
      log.info('No tasks directory found.');
      outro('Done');
      return;
    }

    const taskFiles = files.filter((f) => f.endsWith('.code-task.md'));

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      outro('Done');
      return;
    }

    const pending: { title: string; filename: string }[] = [];

    for (const filename of taskFiles) {
      const content = await Bun.file(path.join(tasksDir, filename)).text();
      const frontmatter = parseFrontmatter(content);

      if (frontmatter.status === 'pending') {
        const title = parseTitle(content);
        pending.push({ title, filename });
      }
    }

    if (pending.length === 0) {
      log.info('No pending tasks.');
      outro('All tasks are complete');
      return;
    }

    log.info(`Found ${pending.length} pending task(s):\n`);

    for (const task of pending) {
      log.message(`  - ${task.title}  (${task.filename})`);
    }

    outro('Done');
  },
});

function parseDescription(content: string): string {
  const match = content.match(/## Description\s*\n([\s\S]*?)(?=\n## |\n---|\n$)/);
  if (!match || !match[1]) return '';

  const full = match[1].trim();
  // Condense to 2-3 sentences
  const sentences = full.match(/[^.!?]*[.!?]+/g);
  if (!sentences) return full.slice(0, 200);
  return sentences.slice(0, 3).join(' ').trim();
}

type CompletedTask = {
  filename: string;
  title: string;
  description: string;
  completed: string;
};

const compactCmd = defineCommand({
  meta: {
    name: 'compact',
    description: 'Archive completed tasks into a historical record',
  },
  async run() {
    const tasksDir = resolveTasksDir();

    let files: string[];
    try {
      files = await readdir(tasksDir);
    } catch {
      log.info('No tasks directory found.');
      outro('Done');
      return;
    }

    const taskFiles = files.filter((f) => f.endsWith('.code-task.md'));

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      outro('Done');
      return;
    }

    const completed: CompletedTask[] = [];

    for (const filename of taskFiles) {
      const content = await Bun.file(path.join(tasksDir, filename)).text();
      const frontmatter = parseFrontmatter(content);

      if (
        frontmatter.status === 'completed' &&
        frontmatter.completed &&
        frontmatter.completed !== 'null'
      ) {
        const title = parseTitle(content);
        const description = parseDescription(content);
        completed.push({
          filename,
          title,
          description,
          completed: frontmatter.completed,
        });
      }
    }

    if (completed.length === 0) {
      log.info('No completed tasks to archive.');
      outro('Done');
      return;
    }

    // Sort by completion date ascending
    completed.sort((a, b) => a.completed.localeCompare(b.completed));

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString();

    let archive = `# Task Archive\n\nGenerated: ${timestamp}\n\nTotal tasks archived: ${completed.length}\n\n---\n\n`;

    for (const task of completed) {
      archive += `## ${task.title}\n\n`;
      archive += `**Completed:** ${task.completed}\n\n`;
      if (task.description) {
        archive += `${task.description}\n\n`;
      }
      archive += `---\n\n`;
    }

    const historyDir = path.join(BASE_DIR, 'history');
    await mkdir(historyDir, { recursive: true });

    const archivePath = path.join(historyDir, `archive-${dateStamp}.md`);
    await Bun.write(archivePath, archive);

    // Delete original completed task files
    for (const task of completed) {
      await rm(path.join(tasksDir, task.filename));
    }

    log.info(`Archived ${completed.length} completed task(s) to ${archivePath}`);
    outro('Compaction complete');
  },
});

const createCmd = defineCommand({
  meta: {
    name: 'create',
    description: 'Create a new task plan',
  },
  args: {
    ['dry-run']: {
      default: false,
      description: 'Run as dry run, without sending prompt to agent',
      type: 'boolean',
      alias: 'd',
    },
    verbose: {
      default: false,
      description: "Enable verbose logging, streaming the agent's work in progress",
      type: 'boolean',
    },
  },
  async run({ args }) {
    const backend = new Backend(Config.get('backend'));

    while (true) {
      const description = await text({
        message: 'Describe the task you want to plan',
        validate(value) {
          if (!value || value.trim() === '') return 'Please enter a task description.';

          return undefined;
        },
      });

      if (isCancel(description)) {
        outro('Plan cancelled.');
        return;
      }

      const planPrompt = buildPlanPrompt({
        description,
      });

      if (args['dry-run']) {
        log.info(planPrompt);
      } else {
        await mkdir(path.join(BASE_DIR, TASKS_DIR), { recursive: true });
        spin.start('Generating task plan');

        const proc = Bun.spawn({
          cmd: backend.buildCommand(planPrompt),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        await Promise.allSettled([
          Stream.toOutput(proc.stdout, {
            shouldPrint: args.verbose,
            onChunk(accumulated) {
              if (accumulated.includes('<woof>COMPLETE</woof>')) {
                proc.kill();
                return true;
              }
            },
          }),
          Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
        ]);

        await proc.exited;

        spin.stop('Task plan generated');
      }

      const another = await confirm({
        message: 'Would you like to add another plan?',
      });

      if (isCancel(another) || !another) {
        break;
      }
    }

    outro('Task planning complete');
  },
});

const editCmd = defineCommand({
  meta: {
    name: 'edit',
    description: 'Edit an existing task plan',
  },
  args: {
    ['dry-run']: {
      default: false,
      description: 'Run as dry run, without sending prompt to agent',
      type: 'boolean',
      alias: 'd',
    },
    verbose: {
      default: false,
      description: "Enable verbose logging, streaming the agent's work in progress",
      type: 'boolean',
    },
  },
  async run({ args }) {
    const tasksDir = resolveTasksDir();

    let files: string[];
    try {
      files = await readdir(tasksDir);
    } catch {
      log.info('No tasks directory found.');
      outro('Done');
      return;
    }

    const taskFiles = files.filter((f) => f.endsWith('.code-task.md'));

    if (taskFiles.length === 0) {
      log.info('No task files found.');
      outro('Done');
      return;
    }

    const options: { value: string; label: string }[] = [];

    for (const filename of taskFiles) {
      const content = await Bun.file(path.join(tasksDir, filename)).text();
      const title = parseTitle(content);
      options.push({ value: filename, label: `${title}  (${filename})` });
    }

    const selected = await select({
      message: 'Select a task plan to edit',
      options,
    });

    if (isCancel(selected)) {
      outro('Edit cancelled.');
      return;
    }

    const filePath = path.join(tasksDir, selected);
    const fileContent = await Bun.file(filePath).text();

    const editPrompt = buildEditPlanPrompt({ filePath, fileContent });

    if (args['dry-run']) {
      log.info(editPrompt);
      outro('Dry run complete');
      return;
    }

    const backend = new Backend(Config.get('backend'));

    spin.start('Opening editor agent');

    const proc = Bun.spawn({
      cmd: backend.buildCommand(editPrompt),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await Promise.allSettled([
      Stream.toOutput(proc.stdout, {
        shouldPrint: args.verbose,
        onChunk(accumulated) {
          if (accumulated.includes('<woof>COMPLETE</woof>')) {
            proc.kill();
            return true;
          }
        },
      }),
      Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
    ]);

    await proc.exited;

    spin.stop('Edit complete');
    outro('Task plan updated');
  },
});

export const planCmd = defineCommand({
  meta: {
    name: 'plan',
    description: 'Plan upcoming work',
  },
  args: {
    ['dry-run']: {
      default: false,
      description: 'Run as dry run, without sending prompt to agent',
      type: 'boolean',
      alias: 'd',
    },
    verbose: {
      default: false,
      description: "Enable verbose logging, streaming the agent's work in progress",
      type: 'boolean',
    },
  },
  subCommands: {
    compact: compactCmd,
    create: createCmd,
    edit: editCmd,
    list: listCmd,
  },
  async run({ args }) {
    // Default behavior: run the create flow when no subcommand is specified
    await createCmd.run!({ args } as any);
  },
});
