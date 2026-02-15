import { log, outro } from '@clack/prompts';
import { defineCommand } from 'citty';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { CompletedTask } from '../types/task';

import { BASE_DIR } from '../util/constants';
import { resolveTasksDir, parseFrontmatter, parseTitle, parseDescription } from '../util/task';

const PROGRESS_FILE = path.join(BASE_DIR, 'progress.txt');

export const compactCmd = defineCommand({
  meta: {
    name: 'compact',
    description: 'Archive completed tasks and progress into a historical record',
  },
  async run() {
    const tasksDir = resolveTasksDir();

    // Collect completed tasks
    const completed: CompletedTask[] = [];

    try {
      const glob = new Bun.Glob('*.code-task.md');
      const taskFiles = Array.from(glob.scanSync({ cwd: tasksDir }));

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
    } catch {
      // Tasks directory may not exist — that's fine, we'll still check progress
    }

    // Read progress file
    let progressContent = '';
    try {
      const progressFile = Bun.file(PROGRESS_FILE);
      if (await progressFile.exists()) {
        progressContent = (await progressFile.text()).trim();
      }
    } catch {
      // progress.txt may not exist or be unreadable — skip gracefully
    }

    const hasCompletedTasks = completed.length > 0;
    const hasProgress = progressContent.length > 0;

    if (!hasCompletedTasks && !hasProgress) {
      log.info('Nothing to compact — no completed tasks or progress entries found.');
      return;
    }

    // Sort completed tasks by completion date ascending
    completed.sort((a, b) => a.completed.localeCompare(b.completed));

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString();

    // Create date-stamped history directory
    const historyDir = path.join(BASE_DIR, 'history', dateStamp);
    await mkdir(historyDir, { recursive: true });

    // Archive completed tasks
    if (hasCompletedTasks) {
      let taskArchive = `# Task Archive\n\nGenerated: ${timestamp}\n\nTotal tasks archived: ${completed.length}\n\n---\n\n`;

      for (const task of completed) {
        taskArchive += `## ${task.title}\n\n`;
        taskArchive += `**Completed:** ${task.completed}\n\n`;
        if (task.description) {
          taskArchive += `${task.description}\n\n`;
        }
        taskArchive += `---\n\n`;
      }

      const tasksArchivePath = path.join(historyDir, 'tasks.md');
      await Bun.write(tasksArchivePath, taskArchive);

      // Delete original completed task files
      for (const task of completed) {
        await rm(path.join(tasksDir, task.filename));
      }

      log.info(`Archived ${completed.length} completed task(s) to ${tasksArchivePath}`);
    }

    // Archive progress
    if (hasProgress) {
      const progressArchive = `# Progress Log\n\nGenerated: ${timestamp}\n\n---\n\n${progressContent}\n`;

      const progressArchivePath = path.join(historyDir, 'progress.md');
      await Bun.write(progressArchivePath, progressArchive);

      // Clear the original progress file
      await Bun.write(PROGRESS_FILE, '');

      log.info(`Archived progress log to ${progressArchivePath}`);
    }

    outro('Compaction complete');
  },
});
