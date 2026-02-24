import { join } from 'node:path';

import { Config } from '@internal/config';
import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

import { registerIpcHandlers } from './main/ipc';
import { buildAppMenu } from './main/menu';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    registerIpcHandlers(mainWindow);
    buildAppMenu(mainWindow);
    return;
  }

  void mainWindow.loadFile(join(__dirname, `./index.html`));
  registerIpcHandlers(mainWindow);
  buildAppMenu(mainWindow);
};

void Config;

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    void autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
