import path from 'node:path';

import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from './constants';

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
