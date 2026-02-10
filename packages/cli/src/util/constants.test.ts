import { describe, expect, test } from 'bun:test';

import { ALLOWED_BACKENDS, BASE_DIR, ODY_FILE, PRD_FILE, TASKS_DIR } from './constants';

describe('constants', () => {
  test('BASE_DIR has expected value', () => {
    expect(BASE_DIR).toBe('.ody');
    expect(typeof BASE_DIR).toBe('string');
  });

  test('ODY_FILE has expected value', () => {
    expect(ODY_FILE).toBe('ody.json');
    expect(typeof ODY_FILE).toBe('string');
  });

  test('PRD_FILE has expected value', () => {
    expect(PRD_FILE).toBe('prd.json');
    expect(typeof PRD_FILE).toBe('string');
  });

  test('TASKS_DIR has expected value', () => {
    expect(TASKS_DIR).toBe('tasks');
    expect(typeof TASKS_DIR).toBe('string');
  });

  test('ALLOWED_BACKENDS contains exactly three expected backends', () => {
    expect(ALLOWED_BACKENDS).toEqual(['opencode', 'claude', 'codex']);
    expect(ALLOWED_BACKENDS).toHaveLength(3);
  });

  test('constants are not undefined or empty', () => {
    expect(BASE_DIR).not.toBeUndefined();
    expect(BASE_DIR).not.toBe('');
    expect(ODY_FILE).not.toBeUndefined();
    expect(ODY_FILE).not.toBe('');
    expect(PRD_FILE).not.toBeUndefined();
    expect(PRD_FILE).not.toBe('');
    expect(TASKS_DIR).not.toBeUndefined();
    expect(TASKS_DIR).not.toBe('');
    expect(ALLOWED_BACKENDS).not.toBeUndefined();
    expect(ALLOWED_BACKENDS.length).toBeGreaterThan(0);
  });
});
