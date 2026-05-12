import { dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

const updater = autoUpdater as unknown as {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  downloadUpdate: () => void;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: () => void;
  on: (event: string, callback: (info?: unknown) => void) => void;
};

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;

  updater.on('update-available', () => {
    mainWindow.webContents.send('block-ui', true);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version of the application is available and is currently being downloaded. Please wait until the download is complete.',
    });
    updater.downloadUpdate();
  });

  updater.on('update-downloaded', () => {
    mainWindow.webContents.send('block-ui', false);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'A new version has been downloaded. The app will restart to apply the update.',
    }).then(() => {
      updater.quitAndInstall();
    });
  });

  updater.on('error', (error) => {
    log.error('Error in the auto-updater:', error);
    console.error('Error details:', error);
  });
}

export function checkForUpdates(): void {
  updater.checkForUpdates();
}