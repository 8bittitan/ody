import { join } from 'node:path';

import { Config } from '@internal/config';
import { app, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';

import { registerIpcHandlers } from './main/ipc';
import { buildAppMenu } from './main/menu';

type AppStore = {
  window: {
    height: number;
    width: number;
  };
};

const appStore = new Store<AppStore>({
  name: 'ody-app',
  defaults: {
    window: {
      height: 600,
      width: 800,
    },
  },
});

const createWindow = () => {
  const windowDims = appStore.get('window');

  const mainWindow = new BrowserWindow({
    height: windowDims.height,
    width: windowDims.width,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 14 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.js'),
    },
  });

  mainWindow.on('resized', () => {
    const newDims = mainWindow.getBounds();

    appStore.set('window', { height: newDims.height, width: newDims.width });
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
