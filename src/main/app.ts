import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

import { createMainWindow, getMainWindow, setAppQuitting } from './window-manager.js';
import { setupIpcHandlers } from './ipc-handlers.js';
import { setupAutoUpdater, checkForUpdates } from './updater.js';
import { killPythonProcess, preWarmPython } from './python-runner.js';
import { cleanRunningHistorySync } from './history-manager.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      setAppQuitting(true);
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on('before-quit', () => {
  killPythonProcess();
  cleanRunningHistorySync();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners();
  }
  setAppQuitting(true);
});

app.on('ready', async () => {
  cleanRunningHistorySync();
  mainWindow = createMainWindow();
  setupIpcHandlers(mainWindow);
  setupAutoUpdater(mainWindow);
  preWarmPython();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      setupIpcHandlers(mainWindow);
    } else if (mainWindow) {
      mainWindow.show();
    }
  });

  checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('FL Init starting...');