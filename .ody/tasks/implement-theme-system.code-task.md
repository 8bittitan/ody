---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Theme System (Light/Dark Mode + OS Sync)

## Description
Implement the complete theme system supporting light mode, dark mode, and automatic OS preference detection. This includes main process theme detection via `nativeTheme`, IPC handlers for theme get/set, renderer-side class toggling, CSS variable switching for shadcn components, and persistence of user preference.

## Background
The app defaults to the OS theme preference. Users can override to System, Light, or Dark. The implementation uses Tailwind v4's `@custom-variant dark (&:is(.dark *))` for class-based dark mode. Toggling the `dark` class on `<html>` switches all shadcn components and custom styles. The user's preference is persisted in `electron-store` (desktop-only, not in `.ody/ody.json`). CodeMirror and xterm.js themes also need to switch.

## Technical Requirements
1. Implement `theme:get` IPC handler in main process:
   - Return `{ source: 'system' | 'light' | 'dark', resolved: 'light' | 'dark' }`
   - Read user preference from `electron-store`; if 'system', resolve via `nativeTheme.shouldUseDarkColors`
2. Implement `theme:set` IPC handler in main process:
   - Save preference to `electron-store`
   - Send `theme:changed` event to renderer with resolved value
3. Listen for `nativeTheme.on('updated', ...)` to detect OS theme changes
   - Only send `theme:changed` if user preference is 'system'
4. Implement `useTheme` hook in renderer:
   - On mount: call `theme:get` and set initial theme
   - Listen for `theme:changed` events
   - Toggle `dark` class on `document.documentElement`
   - Expose `theme`, `setTheme(pref)`, and `resolvedTheme` values
5. Add `.dark` CSS variable block in `globals.css` with light-mode Art Deco values
6. Add `electron-store` dependency for persisting desktop-only preferences
7. Theme toggle UI: add to Config View as System/Light/Dark radio group

## Dependencies
- `setup-tailwind-shadcn-design-system` task must be completed
- `implement-ipc-layer-and-preload` task must be completed
- `implement-zustand-store` task must be completed

## Implementation Approach
1. Add `electron-store` to `packages/desktop` dependencies
2. In main process, create a theme manager:
   ```typescript
   import Store from 'electron-store';
   import { nativeTheme, BrowserWindow } from 'electron';
   
   const store = new Store();
   
   function getTheme(): { source: string; resolved: string } {
     const pref = store.get('theme', 'system') as string;
     const resolved = pref === 'system'
       ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
       : pref;
     return { source: pref, resolved };
   }
   ```
3. Register IPC handlers for `theme:get` and `theme:set`
4. Listen for `nativeTheme` updates and forward to renderer when preference is 'system'
5. In renderer, implement `useTheme` hook:
   - Initialize theme on mount
   - Subscribe to `theme:changed` events
   - Apply `dark` class: `document.documentElement.classList.toggle('dark', resolved === 'dark')`
6. Add `:root` (dark) and `.dark` (or rather, since `:root` is dark-first, add a light-mode override block) CSS variables to `globals.css`
7. Mount `useTheme` hook at the `App.tsx` level so theme is applied globally

## Acceptance Criteria

1. **OS Theme Detection**
   - Given the user preference is "system"
   - When the OS is in dark mode
   - Then the app renders in dark mode with correct Art Deco colors

2. **Manual Override**
   - Given the user sets theme to "light"
   - When the preference is saved
   - Then the app immediately switches to light mode regardless of OS setting

3. **Persistence**
   - Given the user sets a theme preference
   - When the app is restarted
   - Then the previous preference is restored

4. **OS Change Forwarded**
   - Given the user preference is "system"
   - When the OS theme changes
   - Then the app theme updates automatically

5. **CSS Variables Switch**
   - Given a theme change from dark to light
   - When inspecting CSS variables
   - Then all color tokens update to their light-mode values

## Metadata
- **Complexity**: Medium
- **Labels**: theme, dark-mode, electron, ui
