---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Native Menu Bar and Keyboard Shortcuts

## Description
Add the native application menu bar (File, Edit, View, Help menus) and global keyboard shortcuts for common actions. This includes platform-appropriate menu items, accelerators, and integration with existing features.

## Background
Electron apps should have a native menu bar for discoverability and platform conventions. Key shortcuts include Cmd/Ctrl+O for adding projects, Cmd/Ctrl+N for new plan, Cmd/Ctrl+K for editor inline edit, Cmd/Ctrl+S for save, and standard Edit menu items (undo, redo, cut, copy, paste, select all). The Help menu links to documentation and the GitHub repo.

## Technical Requirements
1. Create `src/main/menu.ts` with `buildAppMenu(win: BrowserWindow)` function
2. Implement File menu:
   - "Add Project" (Cmd/Ctrl+O) -- opens folder picker
   - "New Plan" (Cmd/Ctrl+N) -- navigates to Plan view
   - "Save" (Cmd/Ctrl+S) -- saves current editor content
   - Separator
   - "Quit" (Cmd/Ctrl+Q on macOS, Alt+F4 on Windows/Linux)
3. Implement Edit menu:
   - Standard items: Undo, Redo, Cut, Copy, Paste, Select All
   - These use Electron's built-in roles for correct behavior
4. Implement View menu:
   - "Toggle DevTools" (Cmd+Alt+I / Ctrl+Shift+I)
   - "Reload" (Cmd/Ctrl+R)
   - "Tasks" -- navigate to Tasks view
   - "Run" -- navigate to Run view
   - "Configuration" -- navigate to Config view
5. Implement Help menu:
   - "Documentation" -- opens docs website in browser
   - "GitHub Repository" -- opens GitHub repo in browser
   - "About" -- shows about dialog with version
6. macOS-specific: Application menu with app name, About, Preferences, Quit
7. Register global shortcuts via `globalShortcut` or in-app `accelerator` on menu items
8. Send navigation commands to renderer via IPC when view shortcuts are used

## Dependencies
- `implement-app-layout-shell` task must be completed
- `implement-project-management` task must be completed
- `implement-task-editor-codemirror` task must be completed

## Implementation Approach
1. Create `menu.ts` using `Menu.buildFromTemplate()`:
   ```typescript
   import { app, Menu, shell, BrowserWindow } from 'electron';
   
   export function buildAppMenu(win: BrowserWindow) {
     const template: Electron.MenuItemConstructorOptions[] = [];
     
     // macOS app menu
     if (process.platform === 'darwin') {
       template.push({
         label: app.name,
         submenu: [
           { role: 'about' },
           { type: 'separator' },
           { label: 'Preferences...', accelerator: 'Cmd+,', click: () => { /* open settings */ } },
           { type: 'separator' },
           { role: 'quit' },
         ],
       });
     }
     
     // File, Edit, View, Help menus...
   }
   ```
2. File menu: connect Add Project to `projects:add` IPC, Save to `editor:save` signal
3. Edit menu: use Electron's built-in roles (`role: 'undo'`, `role: 'copy'`, etc.)
4. View menu: send IPC events to renderer for navigation, use `webContents.toggleDevTools()`
5. Help menu: use `shell.openExternal()` for external links
6. Call `buildAppMenu(win)` in `src/main/index.ts` after window creation
7. For in-renderer shortcuts (like Cmd+K in editor), use CodeMirror's keybinding system (already implemented in editor task)

## Acceptance Criteria

1. **Menu Bar Displays**
   - Given the desktop app
   - When it launches
   - Then the native menu bar shows File, Edit, View, Help menus

2. **Add Project Shortcut**
   - Given the app
   - When pressing Cmd/Ctrl+O
   - Then the folder picker opens to add a project

3. **Save Shortcut**
   - Given the editor with unsaved changes
   - When pressing Cmd/Ctrl+S
   - Then the file is saved

4. **Edit Menu Works**
   - Given text selected in the app
   - When using Edit > Copy
   - Then the text is copied to clipboard

5. **Help Links**
   - Given the Help menu
   - When clicking "Documentation"
   - Then the docs website opens in the system browser

6. **macOS App Menu**
   - Given macOS platform
   - When viewing the menu bar
   - Then the app name menu appears with About, Preferences, and Quit

## Metadata
- **Complexity**: Medium
- **Labels**: menu, shortcuts, electron, desktop
