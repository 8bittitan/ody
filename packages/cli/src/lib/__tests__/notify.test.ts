import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { sendNotification } from '../notify';

describe('sendNotification', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  test('resolves without throwing on current platform', async () => {
    // sendNotification is fire-and-forget — it should never reject
    await expect(sendNotification('Test Title', 'Test Body')).resolves.toBeUndefined();
  });

  test('resolves without throwing on unsupported platform (win32)', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    // On win32, no shell command is invoked at all; should resolve cleanly
    await expect(sendNotification('Test Title', 'Test Body')).resolves.toBeUndefined();
  });

  test('resolves without throwing on darwin', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    // On darwin, osascript is called but errors are swallowed
    await expect(sendNotification('Test Title', 'Test Body')).resolves.toBeUndefined();
  });

  test('resolves without throwing on linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    // On linux, notify-send is called but errors are swallowed
    await expect(sendNotification('Test Title', 'Test Body')).resolves.toBeUndefined();
  });

  test('handles empty title and message gracefully', async () => {
    await expect(sendNotification('', '')).resolves.toBeUndefined();
  });

  test('handles special characters in title and message', async () => {
    await expect(
      sendNotification('Title "with" quotes', 'Body with $pecial & chars'),
    ).resolves.toBeUndefined();
  });

  test('sendNotification is a function', () => {
    expect(typeof sendNotification).toBe('function');
  });

  test('sendNotification returns a Promise', () => {
    const result = sendNotification('Title', 'Body');
    expect(result).toBeInstanceOf(Promise);
  });
});
