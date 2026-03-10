import { INSTALL_SCRIPT_PATH, RELEASES_API } from '@internal/config';
import { Http } from '@internal/integrations';
import { $ } from 'bun';

import pkg from '../../package.json';

function stripLeadingV(version: string): string {
  return version.replace(/^v/, '');
}

type Semver = {
  core: [number, number, number];
  prerelease: string[];
};

function parseSemver(version: string): Semver | null {
  const normalized = stripLeadingV(version).split('+', 1)[0];
  if (normalized === undefined) {
    return null;
  }

  const [corePart, prereleasePart] = normalized.split('-', 2);
  if (corePart === undefined) {
    return null;
  }

  const core = corePart.split('.');

  if (core.length !== 3 || core.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  return {
    core: core.map((part) => Number(part)) as Semver['core'],
    prerelease: prereleasePart ? prereleasePart.split('.') : [],
  };
}

function compareIdentifiers(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }

  if (leftNumeric) {
    return -1;
  }

  if (rightNumeric) {
    return 1;
  }

  return left.localeCompare(right);
}

function compareVersions(current: string, latest: string): number {
  const currentSemver = parseSemver(current);
  const latestSemver = parseSemver(latest);

  if (!currentSemver || !latestSemver) {
    return stripLeadingV(current).localeCompare(stripLeadingV(latest));
  }

  for (const [currentPart, latestPart] of [
    [currentSemver.core[0], latestSemver.core[0]],
    [currentSemver.core[1], latestSemver.core[1]],
    [currentSemver.core[2], latestSemver.core[2]],
  ] as const) {
    const diff = currentPart - latestPart;
    if (diff !== 0) {
      return diff;
    }
  }

  if (currentSemver.prerelease.length === 0 && latestSemver.prerelease.length === 0) {
    return 0;
  }

  if (currentSemver.prerelease.length === 0) {
    return 1;
  }

  if (latestSemver.prerelease.length === 0) {
    return -1;
  }

  const length = Math.max(currentSemver.prerelease.length, latestSemver.prerelease.length);

  for (let index = 0; index < length; index++) {
    const currentIdentifier = currentSemver.prerelease[index];
    const latestIdentifier = latestSemver.prerelease[index];

    if (currentIdentifier === undefined) {
      return -1;
    }

    if (latestIdentifier === undefined) {
      return 1;
    }

    const diff = compareIdentifiers(currentIdentifier, latestIdentifier);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export namespace Installation {
  const CURRENT = stripLeadingV(pkg.version);

  export function currentVersion() {
    return CURRENT;
  }

  export async function checkLatest() {
    const res = await Http.fetchWithRetry(RELEASES_API, undefined, {
      timeoutMs: 4_000,
      retries: 2,
    });

    if (!res.ok) {
      throw new Error('Failed to check for updates');
    }

    const data = (await res.json()) as any;

    return stripLeadingV(data.tag_name);
  }

  export function needsUpdate(latest: string, current = CURRENT): boolean {
    return compareVersions(current, stripLeadingV(latest)) < 0;
  }

  export async function update() {
    const res = await $`curl -fsSL ${INSTALL_SCRIPT_PATH} | bash`.quiet().throws(false);

    if (res.exitCode !== 0) {
      const stderr = res.stderr.toString('utf8');
      throw new Error(`Failed to install: ${stderr}`);
    }
  }
}
