import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { getConfiguration, saveConfiguration } from './config-manager';
import { runPythonScript } from './python-runner';
import { getHistory, clearHistory, deleteHistoryEntry, addHistoryEntry } from './history-manager';
import { ValidationResponse, AppConfig, PythonScriptInput } from '../shared/types';

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  ipcMain.on('validate-directory', (event, pathToValidate: string) => {
    fs.stat(pathToValidate, (err, stats) => {
      const response: ValidationResponse = { success: true, errorMessage: '' };
      if (err || !stats.isDirectory()) {
        response.success = false;
        response.errorMessage = pathToValidate;
      }
      event.reply('validate-directory', response);
    });
  });

  ipcMain.on('validate-project-name', (event, data: { projectPath: string; directory: string }) => {
    const { projectPath, directory } = data;
    const pathToValidate = path.join(projectPath, directory);

    fs.access(pathToValidate, fs.constants.F_OK, (err) => {
      const response: ValidationResponse = { success: true, errorMessage: '' };
      if (!err) {
        response.success = false;
        response.errorMessage = pathToValidate;
      }
      event.reply('validate-project-name', response);
    });
  });

  ipcMain.on('get-configuration', async (event) => {
    try {
      const config = await getConfiguration();
      event.sender.send('get-configuration', config);
    } catch (error) {
      console.error('Error getting configuration:', error);
    }
  });

  ipcMain.on('change-config', (event, JSON_Config: Partial<AppConfig>) => {
    try {
      const currentConfig = getConfiguration().then(async (config) => {
        const newConfig = { ...config, ...JSON_Config };
        await saveConfiguration(newConfig);
        event.sender.send('config-saved', { jsonConfig: JSON.stringify(newConfig, null, 2) });
      });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  });

  ipcMain.on('save-stems-value', (event, separateStems: boolean) => {
    getConfiguration().then(async (config) => {
      const newConfig = { ...config, separate_stems: separateStems };
      await saveConfiguration(newConfig);
    });
  });

  ipcMain.on('save-thread-ext-value', async (event, data: { threads: string; audio_extension: string }) => {
    try {
      const currentConfig = await getConfiguration();
      const newConfig = { ...currentConfig, ...data };
      await saveConfiguration(newConfig);
    } catch (error) {
      console.error('Error saving thread/ext values:', error);
    }
  });

  ipcMain.on('open-directory-dialog', (event, inputId: string) => {
    dialog.showOpenDialog({
      properties: ['openDirectory'],
    }).then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        event.sender.send('selected-directory', {
          directoryPath: result.filePaths[0],
          input_id: inputId,
        });
      }
    }).catch((err) => {
      console.error('Error opening directory dialog:', err);
    });
  });

  ipcMain.on('open-file-dialog', (event, extensionsArray: string[]) => {
    dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Template file', extensions: extensionsArray }],
    }).then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        event.sender.send('selected-file', result.filePaths[0]);
      }
    }).catch((err) => {
      console.error('Error opening file dialog:', err);
    });
  });

  ipcMain.on('run-python-script', (event, input: PythonScriptInput) => {
    const { args, UUID } = input;
    const projectLocation = args[0] || '';
    const youtubeUrl = args[1] || '';
    const projectName = args[2] || '';
    const fullProjectPath = path.join(projectLocation, projectName);

    addHistoryEntry({
      id: UUID,
      projectName,
      projectLocation: fullProjectPath,
      youtubeUrl,
      createdAt: new Date().toISOString(),
      status: 'running',
    }).catch((err) => console.error('Error adding history entry:', err));

    runPythonScript(args, UUID, event, mainWindow);
  });

  ipcMain.on('ask-templates-list', async (event) => {
    try {
      const config = await getConfiguration();
      const templatesPath = config.templates_path;

      if (!templatesPath || !fs.existsSync(templatesPath)) {
        return;
      }

      const files = fs.readdirSync(templatesPath).filter(
        (file) => path.extname(file).toLowerCase() === '.flp'
      );

      const filesPaths = files.map((file) => path.join(templatesPath, file));

      event.sender.send('get-templates-list', { filesPaths });
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  });

  ipcMain.handle('get-history', async () => {
    return await getHistory();
  });

  ipcMain.handle('clear-history', async () => {
    await clearHistory();
    return true;
  });

  ipcMain.handle('delete-history-entry', async (event, id: string) => {
    await deleteHistoryEntry(id);
    return true;
  });

  ipcMain.handle('open-path', async (event, folderPath: string) => {
    try {
      if (fs.existsSync(folderPath)) {
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
          return { success: false, error: 'Path is not a directory' };
        }
        await shell.openPath(folderPath);
        return { success: true };
      } else {
        return { success: false, error: 'Path does not exist' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}