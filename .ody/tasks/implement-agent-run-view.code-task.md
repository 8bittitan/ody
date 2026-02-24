---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Agent Run View UI

## Description
Build the Run View panel in the renderer that displays agent execution controls, streaming output, iteration progress, and the collapsible progress notes viewer. This is the primary interface for monitoring and controlling agent runs.

## Background
The Run View has three sections: top run controls (start/stop, iteration settings, task filter), middle output display (scrollable log with ANSI support, toggle between log and terminal view), and bottom collapsible progress notes (`.ody/progress.txt` content). It receives agent events from the main process via IPC and displays them in real-time. The view also handles run confirmation modals and stop confirmation modals.

## Technical Requirements
1. Create `src/renderer/components/AgentRunner.tsx` -- run controls panel
2. Create `src/renderer/components/AgentOutput.tsx` -- streaming output display
3. Create `src/renderer/components/ProgressViewer.tsx` -- progress notes viewer
4. Run controls:
   - Backend display (from config, read-only)
   - Iteration limit number input (overrides config)
   - Task filter (label chips or specific file selector)
   - Start button (opens run confirmation modal)
   - Stop button (opens stop confirmation modal when running)
   - Progress indicator: "Iteration 2 of 5 -- Running..."
5. Output display:
   - Scrollable log view with auto-scrolling
   - ANSI color support (convert ANSI escape codes to styled HTML)
   - Toggle between Log View and Terminal View (placeholder for xterm)
   - Clear button
   - Warning banner for ambiguous completion markers
   - Error display for post-run verification failures
6. Run confirmation modal (from plan wireframe):
   - Task name, backend, iterations, auto-commit toggle
   - Cancel and "Start Agent" buttons
7. Stop confirmation modal:
   - Graceful stop vs Force stop radio options
   - "Keep Running" and "Stop Agent" buttons
   - Warning about partial changes for force stop
8. Progress viewer (collapsible):
   - Shows `.ody/progress.txt` content
   - "Clear Progress" button
   - Auto-refreshes after each iteration
9. Wire `progress:read` and `progress:clear` IPC handlers

## Dependencies
- `implement-agent-runner` task must be completed
- `implement-app-layout-shell` task must be completed
- `implement-zustand-store` task must be completed

## Implementation Approach
1. Build `AgentRunner.tsx` (run controls):
   - Use `useAgent` hook for state (isRunning, iteration, maxIterations)
   - Use `useConfig` hook for backend/model display
   - Start button disabled if no config or no backend
   - Stop button only visible when running
   - Label filter uses tag-style chips from task labels
2. Build `AgentOutput.tsx`:
   - Subscribe to `agent:output` events via `useAgent` hook
   - Append chunks to a scrollable div
   - ANSI to HTML conversion (use `ansi-to-html` package or similar lightweight converter)
   - Auto-scroll to bottom on new output (with manual scroll detection to pause auto-scroll)
   - Mono font (JetBrains Mono), 10px, Art Deco log styling
   - Timestamped entries with color-coded sources (ody in accent, agent in light, validator in amber)
   - Warning banner: shown when `agent:ambiguousMarker` event received
   - Verification error: shown when `agent:verifyFailed` event received
3. Build run confirmation modal using shadcn Dialog:
   - Task name card, backend/iterations display, auto-commit Switch
   - Start Agent button (accent), Cancel button (dim)
4. Build stop confirmation modal using shadcn Dialog:
   - Radio group: Graceful stop (default) / Force stop
   - Warning text for force stop
   - Stop Agent button (amber), Keep Running button
5. Build `ProgressViewer.tsx`:
   - Collapsible panel at bottom (h-40)
   - Load content via `progress:read` IPC
   - Display as pre-formatted text
   - Clear button calls `progress:clear` IPC
   - Refresh on `agent:iteration` events
6. Wire `progress:read` handler: read `.ody/progress.txt` from project dir
7. Wire `progress:clear` handler: truncate the file

## Acceptance Criteria

1. **Output Streams in Real-Time**
   - Given a running agent
   - When output is produced
   - Then it appears in the output panel with auto-scrolling

2. **Iteration Progress Displays**
   - Given a running agent
   - When an iteration changes
   - Then the progress indicator updates (e.g., "Iteration 2 of 5 -- Running...")

3. **Run Confirmation Modal**
   - Given clicking Start
   - When the modal appears
   - Then it shows task details, backend info, and Start/Cancel buttons

4. **Stop Modes Work**
   - Given clicking Stop on a running agent
   - When selecting Graceful stop
   - Then the agent finishes its current iteration before stopping

5. **Progress Notes Display**
   - Given `.ody/progress.txt` has content
   - When opening the progress panel
   - Then the notes are displayed and can be cleared

6. **Ambiguous Marker Warning**
   - Given the agent outputs partial woof tags
   - When detected
   - Then a warning banner appears in the output panel

## Metadata
- **Complexity**: High
- **Labels**: agent, run-view, ui, desktop
