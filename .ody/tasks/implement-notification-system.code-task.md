---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Notification System (OS + Toast)

## Description
Implement both the OS-level notification system using Electron's `Notification` API and the in-app toast notification system using `sonner` (via shadcn's `<Sonner>` component). The OS notifications fire on agent completion based on config, while toasts provide immediate UI feedback for user actions.

## Background
Two notification systems work independently: OS notifications (native system notifications for agent completion) follow the `notify` config value (false, 'individual', 'all'), and in-app toasts (lightweight, auto-dismissing feedback) use `sonner`. Toasts are styled with Art Deco colors (accent, green, red, amber variants). Additionally, a "sound notifications" toggle in Settings plays an audible alert on completion (stored in `electron-store`, desktop-only).

## Technical Requirements
1. Implement OS notifications in `src/main/agent.ts`:
   - Use Electron's `Notification` API
   - `notify: false` -- no notifications
   - `notify: 'individual'` -- notification after each iteration
   - `notify: 'all'` -- notification after the entire run loop
   - Cross-platform (macOS, Windows, Linux)
2. Set up `<Sonner>` provider in `App.tsx`:
   - Mount once at the root
   - Configure position (top-right, top: 56px, right: 20px)
   - Configure auto-dismiss (2.5s default)
   - Apply Art Deco styling via `toastOptions` overrides
3. Create toast helper functions:
   - `toast.accent(message)` -- general feedback (accent border/dot)
   - `toast.success(message)` -- success actions (green)
   - `toast.error(message)` -- destructive actions (red)
   - `toast.warning(message)` -- warnings (amber)
4. Add toast calls throughout the app:
   - Plan created, task updated, project added, validator added (green)
   - Output cleared, settings opened, draft saved (accent)
   - Task deleted, force stopped (red)
   - Agent stopping gracefully (amber)
5. Sound notification toggle:
   - Setting in Settings modal (stored in `electron-store`)
   - When enabled, play an audio file on agent run completion
   - Independent of OS notification setting

## Dependencies
- `setup-tailwind-shadcn-design-system` task must be completed (sonner component)
- `implement-agent-runner` task must be completed (for OS notifications)

## Implementation Approach
1. OS notifications in `AgentRunner`:
   ```typescript
   import { Notification } from 'electron';
   
   function sendNotification(title: string, body: string) {
     if (Notification.isSupported()) {
       new Notification({ title, body }).show();
     }
   }
   
   // In runLoop:
   // If notify === 'individual': send after each iteration
   // If notify === 'all': send after loop completes
   ```
2. Set up Sonner in `App.tsx`:
   ```tsx
   import { Toaster } from '@/components/ui/sonner';
   
   function App() {
     return (
       <>
         <Layout />
         <Toaster
           position="top-right"
           offset={56}
           toastOptions={{
             className: 'bg-panel border-edge text-light',
             duration: 2500,
           }}
         />
       </>
     );
   }
   ```
3. Create Art Deco toast variants by passing `className` per toast:
   ```typescript
   import { toast } from 'sonner';
   
   // Wrapper functions with Art Deco styling
   export const notify = {
     accent: (msg: string) => toast(msg, { className: 'border-primary/20 text-primary' }),
     success: (msg: string) => toast.success(msg, { className: 'border-green/20 text-green' }),
     error: (msg: string) => toast.error(msg, { className: 'border-red/20 text-red' }),
     warning: (msg: string) => toast.warning(msg, { className: 'border-amber/20 text-amber' }),
   };
   ```
4. Add toast calls to existing components:
   - `TaskBoard`: delete task -> `notify.error('Task deleted')`
   - `PlanCreator`: plan created -> `notify.success('Plan created')`
   - `AgentRunner`: agent stopped -> `notify.warning('Agent stopping...')`
   - `ConfigPanel`: config saved -> `notify.success('Configuration saved')`
5. Sound notification:
   - Add a small audio file to assets
   - In main process, check `electron-store` for sound preference
   - On agent completion, play audio if enabled

## Acceptance Criteria

1. **OS Notification on Completion**
   - Given `notify: 'all'` in config
   - When the agent run loop completes
   - Then a native OS notification appears

2. **Per-Iteration Notifications**
   - Given `notify: 'individual'` in config
   - When an iteration completes
   - Then a native OS notification appears after each iteration

3. **Toast Appears on Action**
   - Given a user action (e.g., deleting a task)
   - When the action completes
   - Then an appropriately styled toast appears and auto-dismisses

4. **Toast Styling**
   - Given a success toast
   - When it appears
   - Then it uses green border/dot and Art Deco panel background

5. **Notifications Disabled**
   - Given `notify: false` in config
   - When the agent completes
   - Then no OS notification is sent

## Metadata
- **Complexity**: Medium
- **Labels**: notifications, toast, electron, ui
