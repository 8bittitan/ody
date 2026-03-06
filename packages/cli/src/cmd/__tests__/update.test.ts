import { afterEach, describe, expect, mock, test } from 'bun:test';

import { runUpdate } from '../update';

function createDeps() {
  const messages = {
    intro: [] as string[],
    info: [] as string[],
    success: [] as string[],
    error: [] as string[],
    outro: [] as string[],
    spinnerStarts: [] as string[],
    spinnerStops: [] as string[],
    exitCodes: [] as number[],
    processExitCalls: [] as number[],
  };

  const deps = {
    intro: (message: string) => {
      messages.intro.push(message);
    },
    log: {
      info: (message: string) => {
        messages.info.push(message);
      },
      success: (message: string) => {
        messages.success.push(message);
      },
      error: (message: string) => {
        messages.error.push(message);
      },
    },
    outro: (message: string) => {
      messages.outro.push(message);
    },
    spinner: () => ({
      start(message: string) {
        messages.spinnerStarts.push(message);
      },
      stop(message: string) {
        messages.spinnerStops.push(message);
      },
    }),
    installation: {
      currentVersion: () => '1.2.3',
      checkLatest: mock(async () => '1.2.4'),
      needsUpdate: mock(() => true),
      update: mock(async () => {}),
    },
    exit: (code: number) => {
      messages.processExitCalls.push(code);
      throw new Error(`process.exit(${code})`);
    },
    setExitCode: (code: number) => {
      messages.exitCodes.push(code);
      process.exitCode = code;
    },
  };

  return { deps, messages };
}

describe('runUpdate', () => {
  afterEach(() => {
    mock.restore();
    process.exitCode = 0;
  });

  test('reports failure without success messaging when install fails', async () => {
    const { deps, messages } = createDeps();
    deps.installation.update = mock(async () => {
      throw new Error('install exploded');
    });

    await runUpdate({ check: false }, deps);

    expect(messages.spinnerStops).toContain('Update failed');
    expect(messages.error).toContain('Error: install exploded');
    expect(messages.spinnerStops).not.toContain('Updated to v1.2.4');
    expect(messages.outro).not.toContain('Update complete');
    expect(messages.exitCodes).toEqual([1]);
  });

  test('reports completion after a successful update', async () => {
    const { deps, messages } = createDeps();

    await runUpdate({ check: false }, deps);

    expect(messages.info).toContain('New version available: v1.2.3 → v1.2.4');
    expect(messages.spinnerStops).toContain('Updated to v1.2.4');
    expect(messages.outro).toContain('Update complete');
    expect(messages.exitCodes).toHaveLength(0);
  });

  test('keeps check-only behavior unchanged', async () => {
    const { deps, messages } = createDeps();

    await runUpdate({ check: true }, deps);

    expect(deps.installation.update).not.toHaveBeenCalled();
    expect(messages.outro).toContain('Run `ody update` to install v1.2.4');
    expect(messages.spinnerStarts).not.toContain('Updating...');
  });
});
