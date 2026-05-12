import { AutoUpdater } from 'electron-updater';

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }

    interface BrowserWindow {
      toggleDevTools(): void;
    }
  }
}

declare module 'electron-updater' {
  interface AutoUpdater {
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;
    downloadUpdate(): void;
  }
}

export {};