import { log } from '@clack/prompts';
import { readdir } from 'fs/promises';
import path from 'path';

import { BASE_DIR, TASKS_DIR } from '../util/constants';

const LABELS_REGEX = /\*\*Labels\*\*:\s*(.+)/i;

export async function getTaskFilesByLabel(label: string): Promise<string[]> {
  const tasksDir = path.join(BASE_DIR, TASKS_DIR);
  const matchingFiles: string[] = [];

  try {
    const files = await readdir(tasksDir);
    const taskFiles = files.filter((file) => file.endsWith('.code-task.md'));

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
