---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Auth Management Panel

## Description
Build the Auth Management panel with tabs for Jira and GitHub credential management, including profile CRUD operations, masked token display, and active profile indicators. Wire the auth IPC handlers to delegate to `@internal/auth`.

## Background
The Auth panel provides a table listing all configured credential profiles with add/edit/delete actions. Tokens are masked in the UI (last 6 chars visible). Each tab (Jira/GitHub) shows profiles with an "(active)" badge for the profile referenced in the project config. The panel is accessible from the sidebar under Settings/Integrations. The full token is only sent from main to renderer for editing, never stored in renderer state after the form closes.

## Technical Requirements
1. Create `src/renderer/components/AuthPanel.tsx` -- main auth management view
2. Wire IPC handlers using `@internal/auth`:
   - `auth:list` -- call `Auth.load()` and return the full auth store
   - `auth:setJira` -- call `Auth.setJira(profile, credentials)`
   - `auth:setGitHub` -- call `Auth.setGitHub(profile, credentials)`
   - `auth:removeJira` -- load store, delete profile, save
   - `auth:removeGitHub` -- load store, delete profile, save
3. Auth panel features:
   - Two tabs: Jira and GitHub (using shadcn Tabs)
   - Profile table with columns: Profile name, Email (Jira) or Token preview, Status
   - Masked tokens: show `******` + last 6 characters
   - "(active)" badge on the profile matching config's `jira.profile` / `github.profile`
   - Edit button opens form pre-filled with current values (token shown in full temporarily)
   - Delete button with confirmation dialog
   - "+ Add Profile" button opens empty form
4. Add/Edit form:
   - Jira: profile name input, email input, API token password input
   - GitHub: profile name input, PAT password input
   - Cancel and "Save Credentials" buttons
5. Token security: full token only loaded into form state during editing, cleared on form close

## Dependencies
- `implement-app-layout-shell` task must be completed
- `implement-ipc-layer-and-preload` task must be completed
- `extract-internal-auth` task must be completed

## Implementation Approach
1. Implement auth IPC handlers in `src/main/ipc.ts`:
   ```typescript
   ipcMain.handle('auth:list', async () => {
     return Auth.load();
   });
   
   ipcMain.handle('auth:setJira', async (_, profile, credentials) => {
     await Auth.setJira(profile, credentials);
   });
   
   // Similarly for other handlers
   ```
2. Build `AuthPanel.tsx` with shadcn Tabs:
   - Jira tab and GitHub tab
   - Each tab renders a table and action buttons
3. Profile table:
   - Use a simple table layout (or shadcn Card list)
   - Each row shows profile name, masked token/email, and active status
   - Edit and Delete buttons per row
   - Mask function: `(token) => '******' + token.slice(-6)`
4. Add/Edit form:
   - Render inside a shadcn Dialog
   - Jira form: Input for profile name, Input for email, Input with `type="password"` for API token
   - GitHub form: Input for profile name, Input with `type="password"` for PAT
   - On save, call respective `auth:set*` IPC handler
   - On close, clear form state (especially token values)
5. Active profile detection:
   - Compare each profile name against `config.jira?.profile` or `config.github?.profile`
   - Display accent Badge with "(active)" text
6. Delete with confirmation:
   - shadcn Dialog confirming profile deletion
   - On confirm, call `auth:remove*` IPC handler
   - Refresh profile list

## Acceptance Criteria

1. **Profiles Listed**
   - Given configured auth profiles
   - When opening the Auth panel
   - Then all profiles are listed with masked tokens

2. **Add Profile**
   - Given the Auth panel
   - When clicking "+ Add Profile" and filling the form
   - Then the new profile is saved and appears in the table

3. **Edit Profile**
   - Given an existing profile
   - When clicking "Edit" and modifying values
   - Then changes are saved and the table updates

4. **Delete Profile**
   - Given an existing profile
   - When clicking "Delete" and confirming
   - Then the profile is removed from auth.json

5. **Active Badge**
   - Given a profile matching the config's active profile
   - When viewing the table
   - Then it shows an "(active)" badge

6. **Token Security**
   - Given a profile with a stored token
   - When viewing the table
   - Then the token is masked with only the last 6 characters visible

## Metadata
- **Complexity**: Medium
- **Labels**: auth, credentials, ui, desktop
