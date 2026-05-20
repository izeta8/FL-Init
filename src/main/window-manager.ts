import { BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { getConfiguration } from './config-manager';

let mainWindow: BrowserWindow | null = null;
let isRestoringWindow = false;
let appIsQuitting = false;

export function setAppQuitting(value: boolean): void {
  appIsQuitting = value;
}

export function isAppQuitting(): boolean {
  return appIsQuitting;
}

const isDev = process.env.NODE_ENV === 'development';

const ICON_PATH = isDev
  ? path.join(__dirname, '../../icons/icon.png')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'icons/icon.png');

const PRELOAD_PATH = isDev
  ? path.join(__dirname, '../preload/index.js')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'dist/preload/index.js');

const RENDERER_HTML_PATH = isDev
  ? path.join(__dirname, '../renderer/index.html')
  : path.join(process.resourcesPath, 'app.asar', 'dist/renderer/index.html');

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    icon: ICON_PATH,
    width: 1100,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
    },
  });

  mainWindow.loadFile(RENDERER_HTML_PATH);
  mainWindow.maximize();

  // Open external HTTP/HTTPS links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  setupWindowEvents(mainWindow);
  setupApplicationMenu(mainWindow);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] (${level}) ${message} at ${sourceId}:${line}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page fully loaded');
  });

  return mainWindow;
}

function setupWindowEvents(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (isRestoringWindow) {
      event.preventDefault();
      isRestoringWindow = false;
      return;
    }

    if (!appIsQuitting) {
      appIsQuitting = true;
    }
  });
}

function setupApplicationMenu(win: BrowserWindow): void {
  if (!isDev) {
    Menu.setApplicationMenu(null);
    win.setMenuBarVisibility(false);
    return;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: process.platform === 'darwin' ? 'Command+Alt+I' : 'Ctrl+Shift+I',
          click(_item, focusedWindow) {
            if (focusedWindow) {
              (focusedWindow as BrowserWindow & { webContents: { openDevTools: () => void } }).webContents.openDevTools();
            }
          },
        },
        { role: 'reload' },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setRestoringWindow(value: boolean): void {
  isRestoringWindow = value;
}

export function isWindowRestoring(): boolean {
  return isRestoringWindow;
}