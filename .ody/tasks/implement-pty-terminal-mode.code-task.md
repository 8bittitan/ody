---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement PTY Terminal Mode (xterm.js + node-pty)

## Description
Implement the interactive terminal mode using `node-pty` in the main process and `xterm.js` in the renderer. This provides the PTY-based terminal experience for `--once` equivalent runs and interactive task editing (`ody task edit`), with bidirectional I/O and resize support.

## Background
For interactive sessions, the desktop app spawns a real PTY (pseudo-terminal) using `node-pty` and renders it with `xterm.js` in the renderer. This is needed for the `--once` equivalent (single interactive agent session) and for "Open in Terminal" in the Task Editor. The PTY uses `backend.buildInteractiveCommand()` which differs per backend (e.g., Claude omits `-p` and `--output-format`). The terminal supports full ANSI escape sequences, cursor movement, and bidirectional input.

## Technical Requirements
1. Create `src/main/pty.ts` with `PtySession` class
2. Create `src/renderer/components/TerminalView.tsx` -- xterm.js wrapper component
3. `PtySession` features:
   - `start(win, cmd, cwd)` -- spawn PTY with `node-pty`
   - `write(data)` -- send input to PTY (keystrokes)
   - `resize(cols, rows)` -- resize the PTY
   - `kill()` -- terminate the PTY process
   - Stream data to renderer via `agent:output` events
   - Send `agent:stopped` on exit
4. Wire `agent:runOnce` IPC handler:
   - Build interactive command using `backend.buildInteractiveCommand()`
   - Start PTY session
5. Add IPC channels for PTY input: `pty:input` (renderer -> main, send keystrokes) and `pty:resize` (renderer -> main, resize terminal)
6. `TerminalView.tsx` features:
   - Initialize xterm.js `Terminal` with Art Deco theme colors
   - Use `FitAddon` for automatic sizing
   - Use `WebLinksAddon` for clickable URLs
   - Forward user input to main process via `pty:input` IPC
   - Forward resize events via `pty:resize` IPC
   - Handle component mount/unmount lifecycle (dispose terminal)
7. Terminal theme matching Art Deco design:
   - Background: base color
   - Foreground: light color
   - Cursor: accent color
   - Selection: accent-bg
   - ANSI colors mapped to design system
8. Toggle in Run View between Log View and Terminal View

## Dependencies
- `implement-agent-runner` task must be completed
- `implement-app-layout-shell` task must be completed
- `scaffold-electron-app` task must be completed (for node-pty dependency)

## Implementation Approach
1. Create `PtySession` class in `src/main/pty.ts`:
   ```typescript
   import * as pty from 'node-pty';
   
   class PtySession {
     private term: pty.IPty | null = null;
     
     start(win: BrowserWindow, cmd: string[], cwd: string) {
       const [bin, ...args] = cmd;
       this.term = pty.spawn(bin, args, {
         name: 'xterm-256color',
         cols: 120,
         rows: 40,
         cwd,
       });
       
       this.term.onData((data) => {
         win.webContents.send('agent:output', data);
       });
       
       this.term.onExit(() => {
         win.webContents.send('agent:stopped');
       });
     }
     
     write(data: string) { this.term?.write(data); }
     resize(cols: number, rows: number) { this.term?.resize(cols, rows); }
     kill() { this.term?.kill(); }
   }
   ```
2. Wire IPC handlers:
   - `agent:runOnce`: build interactive command, start PTY session
   - `pty:input`: forward data to PTY
   - `pty:resize`: resize PTY
   - `agent:stop`: kill PTY session
3. Build `TerminalView.tsx`:
   ```typescript
   import { Terminal } from 'xterm';
   import { FitAddon } from 'xterm-addon-fit';
   import { WebLinksAddon } from 'xterm-addon-web-links';
   
   // Initialize Terminal with Art Deco ITheme
   // Mount to ref div
   // Listen for agent:output events and write to terminal
   // Forward onData (user input) to pty:input IPC
   // Use ResizeObserver + FitAddon for automatic sizing
   ```
4. Art Deco terminal theme:
   ```typescript
   const theme: ITheme = {
     background: '#0d0e14',
     foreground: '#c4c6d6',
     cursor: '#00f5d4',
     cursorAccent: '#0d0e14',
     selectionBackground: 'rgba(0, 245, 212, 0.15)',
     // Map ANSI colors to design system
   };
   ```
5. Add toggle in `AgentOutput.tsx` to switch between log and terminal views
6. Wire "Open in Terminal" action in Task Editor toolbar to launch PTY session

## Acceptance Criteria

1. **PTY Spawns**
   - Given a valid backend configuration
   - When starting a PTY session via `agent:runOnce`
   - Then the terminal displays the backend's interactive interface

2. **Bidirectional I/O**
   - Given a running PTY session
   - When typing in the terminal
   - Then keystrokes are sent to the PTY and responses are displayed

3. **Terminal Resizing**
   - Given a terminal view
   - When the window is resized
   - Then the terminal adapts to the new dimensions via FitAddon

4. **Art Deco Theme**
   - Given the terminal view
   - When displaying output
   - Then colors match the Art Deco design system

5. **Session Cleanup**
   - Given a terminal view is unmounted
   - When the component unmounts
   - Then the PTY session is killed and xterm.js is disposed

6. **Open in Terminal**
   - Given the Task Editor toolbar
   - When clicking "Open in Terminal"
   - Then a PTY session opens with the interactive edit command for the task

## Metadata
- **Complexity**: High
- **Labels**: pty, terminal, xterm, node-pty, desktop
