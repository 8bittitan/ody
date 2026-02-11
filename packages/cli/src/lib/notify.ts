import { $ } from 'bun';

export async function sendNotification(title: string, message: string): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await $`osascript -e ${'display notification "' + message + '" with title "' + title + '"'}`.quiet();
    } else if (process.platform === 'linux') {
      await $`notify-send ${title} ${message}`.quiet();
    }
  } catch {
    // Silently swallow errors — notification is best-effort
  }
}
