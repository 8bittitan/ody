import { $ } from 'bun';

import pkg from '../../package.json';
import { INSTALL_SCRIPT_PATH, RELEASES_API } from '../util/constants';

function stripLeadingV(version: string): string {
  return version.replace(/^v/, '');
}

export namespace Installation {
  const CURRENT = stripLeadingV(pkg.version);

  export function currentVersion() {
    return CURRENT;
  }

  export async function checkLatest() {
    return fetch(RELEASES_API)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to check for updates');
        return res.json();
      })
      .then((d: any) => stripLeadingV(d.tag_name));
  }

  export function needsUpdate(latest: string): boolean {
    return CURRENT !== latest;
  }

  export async function update() {
    const res = await $`curl -fsSL ${INSTALL_SCRIPT_PATH} | bash`.quiet().throws(false);

    if (res.exitCode !== 0) {
      const stderr = res.stderr.toString('utf8');
      throw new Error(`Failed to install: ${stderr}`);
    }

    await $`${process.execPath} --version`.nothrow().quiet().text();
  }
}
