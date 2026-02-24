---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement App Layout Shell (Title Bar, Sidebar, Status Bar)

## Description
Build the main application layout shell including the custom title bar, sidebar with project list and navigation views, the main content area with page header pattern, and the persistent status bar. This establishes the visual frame for all subsequent feature views.

## Background
The layout follows a specific structure: a custom 44px title bar at top with macOS traffic lights, app branding, and settings/help buttons; a left sidebar split into Projects (top) and Views (bottom) sections; a main content area with consistent page headers; and a 28px status bar footer showing agent state, task counts, and backend info. The sidebar navigation controls which view is displayed in the main content area.

## Technical Requirements
1. Create `src/renderer/components/Layout.tsx` -- root layout component wrapping all views
2. Create `src/renderer/components/Sidebar.tsx` -- sidebar with Projects section and Views navigation
3. Implement the custom title bar (44px height):
   - macOS traffic light placeholders (red/amber/green circles, 10x10px)
   - App branding: "ODY" in accent + "://Desktop" in dim
   - Settings and Help buttons (right-aligned)
   - 1px accent gradient separator line below
4. Implement sidebar layout:
   - Projects section (top): list of projects, active project highlighted, "+ Add" button
   - Views section (bottom): Tasks, Run, Plan, Import, Config, Auth, Archive navigation items
   - Status section: backend name, agent state (idle/running)
5. Implement page header pattern:
   - Breadcrumb with accent line + project name
   - Title (2xl heading)
   - Right-aligned action buttons area
6. Implement status bar (28px height):
   - Left: agent state indicator (pulsing dot when running), iteration counter, project name, task summary
   - Right: backend name, model name (mono font)
7. Main content area with the subtle grid background pattern
8. View routing: clicking a sidebar navigation item shows the corresponding content area (can use simple state-based routing, no need for react-router)

## Dependencies
- `setup-tailwind-shadcn-design-system` task must be completed first

## Implementation Approach
1. Create `Layout.tsx` as the root shell:
   ```tsx
   // Structure:
   // TitleBar (h-11, fixed top)
   // Gradient separator (h-px)
   // Main area (flex, fill remaining height)
   //   Sidebar (w-56, fixed left)
   //   Content (flex-1)
   //     PageHeader
   //     View content
   //     AgentOutputPanel (collapsible, h-40)
   // StatusBar (h-7, fixed bottom)
   ```
2. Create `Sidebar.tsx` with two sections:
   - Projects: map over project list, highlight active, show add button
   - Views: navigation items with icons (Lucide React), active state styling with accent-bg background
3. Title bar: use `-webkit-app-region: drag` for window dragging, exclude buttons from drag region
4. Status bar: use `useAgent` hook (to be created later) for live state; placeholder data for now
5. View routing: use a Zustand slice or local state to track `activeView`, render corresponding component in content area
6. Page header: reusable component accepting `title`, `breadcrumb`, and `actions` props
7. Apply Art Deco styling throughout: panel backgrounds for sidebar, base background for content, edge borders between sections

## Acceptance Criteria

1. **Layout Renders**
   - Given the desktop app
   - When it loads
   - Then the title bar, sidebar, content area, and status bar are all visible and correctly positioned

2. **Sidebar Navigation Works**
   - Given the sidebar Views section
   - When clicking a navigation item (e.g., "Config")
   - Then the main content area updates to show that view's content

3. **Title Bar Styling**
   - Given the title bar
   - When viewing it
   - Then it shows traffic lights, "ODY://Desktop" branding, and settings/help buttons with correct Art Deco styling

4. **Status Bar Displays**
   - Given the status bar
   - When viewing it
   - Then it shows the project name, task counts, backend name, and model name

5. **Grid Background**
   - Given the main content area
   - When viewing it
   - Then the subtle teal grid pattern is visible in the background

## Metadata
- **Complexity**: Medium
- **Labels**: ui, layout, shell, desktop
