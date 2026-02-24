---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Loading States, Error Boundaries, and Empty States

## Description
Add comprehensive loading states, React error boundaries, and empty state screens throughout the application. This polishing pass ensures a professional user experience when data is loading, when errors occur, or when sections have no content.

## Background
A production-quality desktop app needs graceful handling of loading, error, and empty states. Loading states appear during IPC calls and agent operations. Error boundaries catch React rendering errors and show recovery options. Empty states guide users when sections have no content (no tasks, no projects, no archives, no auth profiles). These are essential for preventing confusing blank screens and unhandled errors.

## Technical Requirements
1. Create a reusable `LoadingSpinner` component with Art Deco styling
2. Create a reusable `ErrorBoundary` component wrapping major view sections
3. Create reusable `EmptyState` component with icon, title, description, and optional CTA button
4. Add loading states to:
   - Task Board (loading task files)
   - Config Panel (loading config)
   - Auth Panel (loading profiles)
   - Import Panel (fetching ticket/issue data)
   - Archive Viewer (loading archives)
   - Agent output (waiting for first output)
5. Add error boundaries to:
   - Each major view (Tasks, Run, Plan, Import, Config, Auth, Archive, Editor)
   - The root App component
   - Error boundary should show error message + "Retry" button
6. Add empty states to:
   - Task Board: "No tasks yet. Create your first plan to get started." with "New Plan" CTA
   - Auth Panel: "No credentials configured." with "Add Profile" CTA
   - Archive Viewer: "No archives yet. Archive completed tasks to see them here."
   - Progress Viewer: "No progress notes recorded yet."
   - Agent Output: "No agent output. Start a run to see output here."
   - Project list (sidebar): handled by welcome screen
7. Add error handling for IPC failures:
   - Wrap IPC calls in try/catch
   - Display error toasts for recoverable errors
   - Display error states for unrecoverable errors

## Dependencies
- All major UI component tasks should be completed first
- `implement-notification-system` task must be completed (for error toasts)

## Implementation Approach
1. Create `LoadingSpinner.tsx`:
   - Accent-colored spinning animation
   - Optional size prop (sm, md, lg)
   - Optional label text below spinner
2. Create `ErrorBoundary.tsx`:
   ```tsx
   class ErrorBoundary extends React.Component {
     state = { hasError: false, error: null };
     
     static getDerivedStateFromError(error) {
       return { hasError: true, error };
     }
     
     render() {
       if (this.state.hasError) {
         return (
           <div className="flex flex-col items-center p-8 text-mid">
             <AlertTriangle className="text-red" />
             <p>Something went wrong</p>
             <Button onClick={() => this.setState({ hasError: false })}>Retry</Button>
           </div>
         );
       }
       return this.props.children;
     }
   }
   ```
3. Create `EmptyState.tsx`:
   ```tsx
   function EmptyState({ icon, title, description, action, actionLabel }) {
     return (
       <div className="flex flex-col items-center py-16 text-center">
         {icon && <div className="text-dim mb-4">{icon}</div>}
         <h3 className="text-bright font-medium mb-2">{title}</h3>
         <p className="text-dim text-sm mb-6">{description}</p>
         {action && <Button onClick={action}>{actionLabel}</Button>}
       </div>
     );
   }
   ```
4. Add loading states to each view: show spinner while IPC data loads, then render content
5. Wrap each view route in `ErrorBoundary`:
   ```tsx
   <ErrorBoundary>
     <TaskBoard />
   </ErrorBoundary>
   ```
6. Add IPC error handling in hooks:
   ```typescript
   try {
     const data = await window.ody.tasks.list();
     setTasks(data);
   } catch (err) {
     notify.error('Failed to load tasks');
     setError(err.message);
   }
   ```
7. Add empty state checks: render `EmptyState` when data arrays are empty

## Acceptance Criteria

1. **Loading States**
   - Given data is being fetched
   - When the view is loading
   - Then a spinner or loading indicator is displayed

2. **Error Recovery**
   - Given a React rendering error in a view
   - When the error boundary catches it
   - Then an error message and "Retry" button are shown

3. **Empty States**
   - Given a Task Board with no tasks
   - When viewing the board
   - Then an empty state message with "New Plan" CTA is shown

4. **IPC Error Handling**
   - Given an IPC call that fails
   - When the error is caught
   - Then an appropriate error toast or error state is displayed

5. **Root Error Boundary**
   - Given a catastrophic error
   - When it occurs
   - Then the root error boundary catches it and shows a recovery UI

## Metadata
- **Complexity**: Medium
- **Labels**: polish, error-handling, loading, empty-states, ui
