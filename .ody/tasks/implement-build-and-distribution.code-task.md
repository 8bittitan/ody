---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Build and Distribution Pipeline

## Description
Configure Electron Forge for production builds targeting macOS (DMG), Windows (Squirrel), and Linux (Deb). Add app icon and branding, set up the auto-updater with GitHub Releases, and verify the app can be packaged and distributed on all target platforms.

## Background
The desktop app uses Electron Forge with the Vite plugin for building. The production pipeline involves packaging (creating an unsigned app bundle), making (creating distributable installers), and optionally signing/notarizing for macOS. Auto-updates use `electron-updater` with GitHub Releases. The app branding includes the "Ody" name, custom icon, and bundle ID `com.ody.desktop`.

## Technical Requirements
1. Create app icons in required formats:
   - macOS: `.icns` file (multiple resolutions)
   - Windows: `.ico` file
   - Linux: `.png` file (512x512 recommended)
   - Place in `packages/desktop/assets/`
2. Update `forge.config.ts` with production-ready configuration:
   - `packagerConfig.icon` pointing to assets
   - `packagerConfig.appBundleId`: `com.ody.desktop`
   - `packagerConfig.name`: `Ody`
   - DMG maker configuration for macOS
   - Squirrel maker for Windows
   - Deb maker for Linux
3. Add package scripts:
   - `start`: `electron-forge start` (dev mode)
   - `package`: `electron-forge package` (create app bundle)
   - `make`: `electron-forge make` (create installers)
   - `publish`: `electron-forge publish` (publish to GitHub Releases, deferred)
4. Set up `electron-updater` for auto-updates:
   - Install `electron-updater` dependency
   - Call `autoUpdater.checkForUpdatesAndNotify()` on app ready
   - Configure for GitHub Releases
   - Can be deferred to post-launch
5. Verify builds:
   - Run `bun run package` and verify app bundle is created
   - Run `bun run make` and verify installers are created
   - Test the packaged app launches and functions correctly
6. Handle native module rebuilding (node-pty needs to be rebuilt for the Electron version)
7. Configure `asar` packaging for app resources

## Dependencies
- `scaffold-electron-app` task must be completed
- All feature implementation tasks should be completed (this is the final build step)

## Implementation Approach
1. Create icon assets:
   - Design or source an Ody icon
   - Generate `.icns` (macOS), `.ico` (Windows), `.png` (Linux) variants
   - Place in `packages/desktop/assets/` directory
2. Update `forge.config.ts`:
   ```typescript
   export default {
     packagerConfig: {
       name: 'Ody',
       executableName: 'ody-desktop',
       icon: './assets/icon',
       appBundleId: 'com.ody.desktop',
       asar: true,
     },
     makers: [
       new MakerDMG({
         format: 'ULFO',
       }),
       new MakerSquirrel({
         name: 'ody-desktop',
       }),
       new MakerDeb({
         options: {
           maintainer: 'Ody Team',
           homepage: 'https://github.com/ody/desktop',
         },
       }),
     ],
     plugins: [
       new VitePlugin({
         build: [
           { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
           { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
         ],
         renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
       }),
     ],
   };
   ```
3. Handle native modules:
   - `node-pty` requires native compilation
   - Ensure `electron-rebuild` runs during packaging
   - Add `@electron-forge/plugin-auto-unpack-natives` if needed
4. Set up auto-updater (can be deferred):
   ```typescript
   import { autoUpdater } from 'electron-updater';
   
   app.on('ready', () => {
     autoUpdater.checkForUpdatesAndNotify();
   });
   ```
5. Add build verification scripts:
   - Test `package` creates output in `out/` directory
   - Test `make` creates platform-appropriate installers
   - Smoke test the packaged app (launches, loads UI, basic IPC works)
6. Document build process in README or contributing guide

## Acceptance Criteria

1. **Package Creates Bundle**
   - Given the desktop package
   - When running `bun run package`
   - Then an app bundle is created in the output directory

2. **Make Creates Installers**
   - Given the desktop package
   - When running `bun run make`
   - Then platform-appropriate installers are created (DMG, Squirrel, or Deb)

3. **Packaged App Launches**
   - Given the packaged app
   - When launching it
   - Then it opens, displays the UI, and IPC works correctly

4. **App Icon Displays**
   - Given the packaged app
   - When viewing it in the OS (Dock, Taskbar, etc.)
   - Then the custom Ody icon is displayed

5. **Native Modules Work**
   - Given the packaged app using node-pty
   - When launching a PTY session
   - Then the terminal works correctly (native module rebuilt for Electron)

## Metadata
- **Complexity**: High
- **Labels**: build, distribution, electron-forge, packaging
