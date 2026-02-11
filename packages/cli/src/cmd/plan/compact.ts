import { log, outro } from '@clack/prompts';
import { defineCommand } from 'citty';
import { readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { CompletedTask } from '../../types/task';

import { BASE_DIR } from '../../util/constants';
import { resolveTasksDir, parseFrontmatter, parseTitle, parseDescription } from '../../util/task';

export const compactCmd = defineCommand({
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
      return;
    }

    const taskFiles = files.filter((f) => f.endsWith('.code-task.md'));

    if (taskFiles.length === 0) {
      log.info('No task files found.');
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
