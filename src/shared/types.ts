import { OUTPUT_STATES } from './constants';

export interface AppConfig {
  project_path: string;
  templates_path: string;
  threads: string;
  audio_extension: string;
  separate_stems: boolean;
}

export interface ValidationResponse {
  success: boolean;
  errorMessage: string;
}

export interface DialogResult {
  directoryPath?: string;
  input_id?: string;
}

export interface PythonScriptInput {
  args: string[];
  UUID: string;
}

export interface PythonOutputMessage {
  text: string;
  UUID: string;
  status: OUTPUT_STATES;
}

export interface TemplatesListResponse {
  filesPaths: string[];
}

export interface ConfigSaveResponse {
  jsonConfig: string;
}

export interface ThreadExtValue {
  threads: string;
  audio_extension: string;
}

export interface HistoryEntry {
  id: string;
  projectName: string;
  projectLocation: string;
  youtubeUrl: string;
  videoName?: string;
  createdAt: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
}

export type Phase = 'download' | 'vocals' | 'bass' | 'drums' | 'others';

export interface ProgressPhaseState {
  percent: number;
  status: 'pending' | 'active' | 'loading' | 'completed' | 'error';
}

export interface IpcChannels {
  'validate-directory': string;
  'validate-project-name': string;
  'get-configuration': string;
  'change-config': string;
  'save-stems-value': string;
  'save-thread-ext-value': string;
  'open-directory-dialog': string;
  'open-file-dialog': string;
  'run-python-script': string;
  'python-script-output': string;
  'get-app-version': string;
  'show-modal': string;
  'config-saved': string;
  'selected-directory': string;
  'selected-file': string;
  'ask-templates-list': string;
  'get-templates-list': string;
  'client-log': string;
  'generic-error': string;
  'block-ui': string;
  'get-history': string;
  'clear-history': string;
  'delete-history-entry': string;
  'open-path': string;
}

export interface ElectronAPI {
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}