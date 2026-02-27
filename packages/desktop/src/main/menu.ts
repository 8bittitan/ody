import { app, dialog, Menu, shell, type BrowserWindow } from 'electron';

type MenuAction =
  | 'project:add'
  | 'view:tasks'
  | 'view:run'
  | 'view:plan'
  | 'view:config'
  | 'editor:save';

const DOCS_URL = 'https://github.com/ody/ody#readme';
const REPO_URL = 'https://github.com/ody/ody';

const sendMenuAction = (win: BrowserWindow, action: MenuAction) => {
  if (win.isDestroyed()) {
    return;
  }

  win.webContents.send('app:menuAction', action);
};

const showAboutDialog = async (win: BrowserWindow) => {
  const message = `Ody ${app.getVersion()}`;
  const detail = 'Desktop task orchestration for coding workflows.';

  await dialog.showMessageBox(win, {
    buttons: ['OK'],
    message,
    detail,
    title: 'About Ody',
    type: 'info',
  });
};

export const buildAppMenu = (win: BrowserWindow) => {
  const template: Electron.MenuItemConstructorOptions[] = [];

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => sendMenuAction(win, 'view:config'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction(win, 'project:add'),
        },
        {
          label: 'New Plan',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction(win, 'view:plan'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction(win, 'editor:save'),
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      role: 'editMenu',
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        {
          label: 'Toggle DevTools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
          click: () => {
            win.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'Tasks',
          click: () => sendMenuAction(win, 'view:tasks'),
        },
        {
          label: 'Run',
          click: () => sendMenuAction(win, 'view:run'),
        },
        {
          label: 'Configuration',
          click: () => sendMenuAction(win, 'view:config'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            void shell.openExternal(DOCS_URL);
          },
        },
        {
          label: 'GitHub Repository',
          click: () => {
            void shell.openExternal(REPO_URL);
          },
        },
        {
          label: 'About',
          click: () => {
            void showAboutDialog(win);
          },
        },
      ],
    },
  );

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
};
