import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.ody.desktop',
    executableName: 'ody-desktop',
    icon: './assets/icon',
    name: 'Ody',
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerSquirrel({
      name: 'ody-desktop',
      setupIcon: './assets/icon.ico',
    }),
    new MakerDeb({
      options: {
        maintainer: '8bittitan',
        homepage: 'https://github.com/8bittitan/ody',
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        { config: 'vite.main.config.ts', entry: 'src/main.ts', target: 'main' },
        { config: 'vite.preload.config.ts', entry: 'src/preload.ts', target: 'preload' },
      ],
      renderer: [{ config: 'vite.renderer.config.ts', name: 'main_window' }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      config: {
        prerelease: true,
        repository: {
          name: 'ody',
          owner: '8bittitan',
        },
      },
      name: '@electron-forge/publisher-github',
    },
  ],
};

export default config;
