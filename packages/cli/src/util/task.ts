import { log } from '@clack/prompts';
import path from 'node:path';

import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from './constants';

const LABELS_REGEX = /\*\*Labels\*\*:\s*(.+)/i;

export type TaskState = {
  taskFile: string;
  status: string;
};

export function parseDescription(content: string): string {
  const match = content.match(/## Description\s*\n([\s\S]*?)(?=\n## |\n---|\n$)/);
  if (!match || !match[1]) return '';

  const full = match[1].trim();
  // Condense to 2-3 sentences
  const sentences = full.match(/[^.!?]*[.!?]+/g);
  if (!sentences) return full.slice(0, 200);
  return sentences.slice(0, 3).join(' ').trim();
}

export function resolveTasksDir() {
  return path.join(BASE_DIR, Config.get('tasksDir') ?? TASKS_DIR);
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

export async function getTaskFilesByLabel(label: string): Promise<string[]> {
  const tasksDir = resolveTasksDir();
  const matchingFiles: string[] = [];

  try {
    const glob = new Bun.Glob('*.code-task.md');
    const taskFiles = Array.from(glob.scanSync({ cwd: tasksDir }));

    for (const filename of taskFiles) {
      try {
        const filePath = path.join(tasksDir, filename);
        const content = await Bun.file(filePath).text();

        const labelsMatch = content.match(LABELS_REGEX);

        if (labelsMatch?.[1]) {
          const labels = labelsMatch[1].split(',').map((l) => l.trim().toLowerCase());

          if (labels.includes(label.toLowerCase())) {
            matchingFiles.push(filename);
          }
        }
      } catch (err) {
        log.warn(`Failed to read task file ${filename}: ${String(err)}`);
      }
    }
  } catch (err) {
    log.error(`Failed to load tasks: ${String(err)}`);
    return [];
  }

  return matchingFiles;
}

export async function getTaskFilesInTasksDir(): Promise<string[]> {
  const tasksDir = resolveTasksDir();

  try {
    const glob = new Bun.Glob('*.code-task.md');
    return Array.from(glob.scanSync({ cwd: tasksDir }));
  } catch (err) {
    log.error(`Failed to load task files: ${String(err)}`);
    return [];
  }
}

export async function getTaskStatus(taskFilePath: string): Promise<string | null> {
  try {
    const content = await Bun.file(taskFilePath).text();
    const frontmatter = parseFrontmatter(content);
    return frontmatter.status ?? null;
  } catch (err) {
    log.error(`Failed to read task file ${taskFilePath}: ${String(err)}`);
    return null;
  }
}

export async function getTaskStates(taskFiles?: string[]): Promise<TaskState[]> {
  const tasksDir = resolveTasksDir();
  const targetFiles =
    taskFiles && taskFiles.length > 0 ? taskFiles : await getTaskFilesInTasksDir();
  const states: TaskState[] = [];

  for (const taskFile of targetFiles) {
    const taskPath = path.join(tasksDir, taskFile);
    const status = await getTaskStatus(taskPath);

    states.push({
      taskFile,
      status: status ?? 'unknown',
    });
  }

  return states;
}
