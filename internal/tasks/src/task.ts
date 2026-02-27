import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { BASE_DIR, Config, TASKS_DIR } from '@internal/config';

const LABELS_REGEX = /\*\*Labels\*\*:\s*(.+)/i;
const TASK_READ_CONCURRENCY = 8;

export type TaskState = {
  taskFile: string;
  status: string;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function parseDescription(content: string): string {
  const match = content.match(/## Description\s*\n([\s\S]*?)(?=\n## |\n---|\n$)/);
  if (!match || !match[1]) return '';

  const full = match[1].trim();
  const sentences = full.match(/[^.!?]*[.!?]+/g);
  if (!sentences) return full.slice(0, 200);
  return sentences.slice(0, 3).join(' ').trim();
}

export function resolveTasksDir(tasksDir?: string) {
  return path.join(BASE_DIR, tasksDir ?? Config.get('tasksDir') ?? TASKS_DIR);
}

export function parseFrontmatter(content: string): Record<string, string> {
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

export function parseTitle(content: string): string {
  const match = content.match(/^#\s+(?:Task:\s*)?(.+)$/m);
  return match && match[1] ? match[1].trim() : 'Untitled';
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = Array.from({ length: items.length }) as R[];
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      const item = items[currentIndex] as T;
      results[currentIndex] = await mapper(item, currentIndex);
    }
  });

  await Promise.all(workers);

  return results;
}

export async function getTaskFilesByLabel(
  label: string,
  tasksDir = resolveTasksDir(),
): Promise<string[]> {
  const taskFiles = await getTaskFilesInDir(tasksDir);

  try {
    const matchedByIndex = await mapWithConcurrency(
      taskFiles,
      TASK_READ_CONCURRENCY,
      async (filename) => {
        try {
          const filePath = path.join(tasksDir, filename);
          const content = await readFile(filePath, 'utf-8');

          const labelsMatch = content.match(LABELS_REGEX);

          if (!labelsMatch?.[1]) {
            return false;
          }

          const labels = labelsMatch[1].split(',').map((value) => value.trim().toLowerCase());

          return labels.includes(label.toLowerCase());
        } catch (err) {
          console.warn(`Failed to read task file ${filename}: ${String(err)}`);
          return false;
        }
      },
    );

    const matchingFiles: string[] = [];

    for (const [index, isMatch] of matchedByIndex.entries()) {
      if (!isMatch) {
        continue;
      }

      const filename = taskFiles[index];

      if (filename) {
        matchingFiles.push(filename);
      }
    }

    return matchingFiles;
  } catch (err) {
    console.error(`Failed to load tasks: ${String(err)}`);
    return [];
  }
}

export async function getTaskFilesInTasksDir(tasksDir = resolveTasksDir()): Promise<string[]> {
  return getTaskFilesInDir(tasksDir);
}

export async function getTaskFilesInDir(tasksDir: string): Promise<string[]> {
  if (!(await exists(tasksDir))) {
    return [];
  }

  try {
    const taskFiles = (await readdir(tasksDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.code-task.md'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    return taskFiles;
  } catch (err) {
    console.error(`Failed to load task files: ${String(err)}`);
    return [];
  }
}

export async function getTaskStatus(taskFilePath: string): Promise<string | null> {
  try {
    const content = await readFile(taskFilePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);
    return frontmatter.status ?? null;
  } catch (err) {
    console.error(`Failed to read task file ${taskFilePath}: ${String(err)}`);
    return null;
  }
}

export async function getTaskStates(
  taskFiles?: string[],
  tasksDir = resolveTasksDir(),
): Promise<TaskState[]> {
  const targetFiles =
    taskFiles && taskFiles.length > 0 ? taskFiles : await getTaskFilesInDir(tasksDir);

  return mapWithConcurrency(targetFiles, TASK_READ_CONCURRENCY, async (taskFile) => {
    const taskPath = path.join(tasksDir, taskFile);
    const status = await getTaskStatus(taskPath);

    return {
      taskFile,
      status: status ?? 'unknown',
    };
  });
}
