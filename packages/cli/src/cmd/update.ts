import { confirm, intro, log, outro, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';
import { chmod } from 'node:fs/promises';

import pkg from '../../package.json';

const GITHUB_REPO = '8bittitan/ody';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type GithubRelease = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

function resolveArtifactName(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  const supported: Record<string, Record<string, string>> = {
    darwin: {
      arm64: 'ody-darwin-arm64',
      x64: 'ody-darwin-x64',
    },
    linux: {
      x64: 'ody-linux-x64',
      arm64: 'ody-linux-arm64',
    },
  };

  return supported[platform]?.[arch] ?? null;
}

function stripLeadingV(version: string): string {
  return version.startsWith('v') ? version.slice(1) : version;
}

function compareVersions(current: string, latest: string): number {
  const a = current.split('.').map(Number);
  const b = latest.split('.').map(Number);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;

    if (av < bv) return -1;
    if (av > bv) return 1;
  }

  return 0;
}

export const updateCmd = defineCommand({
  meta: {
    name: 'update',
    description: 'Check for and install CLI updates from GitHub Releases',
  },
  args: {
    check: {
      type: 'boolean',
      alias: 'c',
      default: false,
      description: 'Only check whether an update is available without downloading',
    },
  },
  async run({ args }) {
    intro('ody update');

    const currentVersion = stripLeadingV(pkg.version);
    const s = spinner();

    // Fetch latest release
    let release: GithubRelease;

    try {
      s.start('Checking for updates');
      const res = await fetch(RELEASES_API, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!res.ok) {
        s.stop('Failed to check for updates');
        log.error(`GitHub API responded with status ${res.status}`);
        return;
      }

      release = (await res.json()) as GithubRelease;
      s.stop('Checked for updates');
    } catch (err) {
      s.stop('Failed to check for updates');
      const message = Error.isError(err) ? err.message : String(err);
      log.error(`Network error: ${message}`);
      log.info('Check your internet connection and try again.');
      return;
    }

    const latestVersion = stripLeadingV(release.tag_name);

    if (compareVersions(currentVersion, latestVersion) >= 0) {
      log.success(`Already up to date (v${currentVersion})`);
      outro('No update needed');
      return;
    }

    log.info(`New version available: v${currentVersion} → v${latestVersion}`);

    if (args.check) {
      outro(`Run \`ody update\` to install v${latestVersion}`);
      return;
    }

    // Resolve platform artifact
    const artifactName = resolveArtifactName();

    if (!artifactName) {
      log.error(`Unsupported platform: ${process.platform} ${process.arch}`);
      log.info('Pre-built binaries are available for macOS (arm64, x64) and Linux (arm64, x64).');
      return;
    }

    // Find the download URL for the artifact
    const asset = release.assets.find((a) => a.name === artifactName);

    if (!asset) {
      log.error(`Binary "${artifactName}" not found in release v${latestVersion}`);
      log.info('The release may not include a binary for your platform yet.');
      return;
    }

    // Confirm with user
    const shouldUpdate = await confirm({
      message: `Update from v${currentVersion} to v${latestVersion}?`,
    });

    if (typeof shouldUpdate === 'symbol' || !shouldUpdate) {
      outro('Update cancelled');
      return;
    }

    // Download and install
    try {
      s.start(`Downloading v${latestVersion}`);
      const downloadRes = await fetch(asset.browser_download_url);

      if (!downloadRes.ok) {
        s.stop('Download failed');
        log.error(`Failed to download binary: HTTP ${downloadRes.status}`);
        return;
      }

      const binary = await downloadRes.arrayBuffer();
      s.stop(`Downloaded v${latestVersion}`);

      s.start('Installing update');
      const binaryPath = process.execPath;
      await Bun.write(binaryPath, binary);
      await chmod(binaryPath, 0o755);
      s.stop('Installed update');

      log.success(`Updated to v${latestVersion}`);
      outro('Update complete');
    } catch (err) {
      s.stop('Update failed');
      const message = Error.isError(err) ? err.message : String(err);

      if (message.includes('EACCES') || message.includes('permission')) {
        log.error(`Permission denied writing to ${process.execPath}`);
        log.info('Try running with elevated permissions or check file ownership.');
      } else {
        log.error(`Update failed: ${message}`);
        log.info('The existing binary has not been modified.');
      }
    }
  },
});
