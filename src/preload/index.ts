import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, AppConfig, ValidationResponse, PythonScriptInput, TemplatesListResponse, ConfigSaveResponse } from '../shared/types';

const electronAPI: ElectronAPI = {
  invoke: async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    return await ipcRenderer.invoke(channel, ...args);
  },

  send: (channel: string, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args);
  },

  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type {
  ElectronAPI,
  AppConfig,
  ValidationResponse,
  PythonScriptInput,
  TemplatesListResponse,
  ConfigSaveResponse,
};