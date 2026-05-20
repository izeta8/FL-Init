import { AppConfig, ValidationResponse, PythonScriptInput, TemplatesListResponse, ConfigSaveResponse, HistoryEntry } from '../../shared/types';

type IpcCallback = (...args: unknown[]) => void;

class IpcService {
  private api = window.electronAPI;

  async getAppVersion(): Promise<string> {
    return await this.api.invoke<string>('get-app-version');
  }

  async getHistory(): Promise<HistoryEntry[]> {
    return await this.api.invoke<HistoryEntry[]>('get-history');
  }

  async clearHistory(): Promise<boolean> {
    return await this.api.invoke<boolean>('clear-history');
  }

  async deleteHistoryEntry(id: string): Promise<boolean> {
    return await this.api.invoke<boolean>('delete-history-entry', id);
  }

  async openPath(path: string): Promise<{ success: boolean; error?: string }> {
    return await this.api.invoke<{ success: boolean; error?: string }>('open-path', path);
  }

  async getConfiguration(): Promise<void> {
    this.api.send('get-configuration');
  }

  validateDirectory(pathToValidate: string): void {
    this.api.send('validate-directory', pathToValidate);
  }

  validateProjectName(projectPath: string, directory: string): void {
    this.api.send('validate-project-name', { projectPath, directory });
  }

  changeConfig(config: Partial<AppConfig>): void {
    this.api.send('change-config', config);
  }

  saveStemsValue(separateStems: boolean): void {
    this.api.send('save-stems-value', separateStems);
  }

  saveThreadExtValue(threads: string, audioExtension: string): void {
    this.api.send('save-thread-ext-value', { threads, audio_extension: audioExtension });
  }

  openDirectoryDialog(inputId: string): void {
    this.api.send('open-directory-dialog', inputId);
  }

  openFileDialog(extensions: string[]): void {
    this.api.send('open-file-dialog', extensions);
  }

  runPythonScript(args: string[], UUID: string): void {
    const input: PythonScriptInput = { args, UUID };
    this.api.send('run-python-script', input);
  }

  askTemplatesList(): void {
    this.api.send('ask-templates-list');
  }

  onConfiguration(callback: (config: AppConfig) => void): void {
    this.api.on('get-configuration', callback as IpcCallback);
  }

  onConfigSaved(callback: (config: ConfigSaveResponse) => void): void {
    this.api.on('config-saved', callback as IpcCallback);
  }

  onSelectedDirectory(callback: (data: { directoryPath: string; input_id: string }) => void): void {
    this.api.on('selected-directory', callback as IpcCallback);
  }

  onSelectedFile(callback: (filePath: string) => void): void {
    this.api.on('selected-file', callback as IpcCallback);
  }

  onTemplatesList(callback: (data: TemplatesListResponse) => void): void {
    this.api.on('get-templates-list', callback as IpcCallback);
  }

  onValidationDirectory(callback: (response: ValidationResponse) => void): void {
    this.api.on('validate-directory', callback as IpcCallback);
  }

  onValidationProjectName(callback: (response: ValidationResponse) => void): void {
    this.api.on('validate-project-name', callback as IpcCallback);
  }

  onShowModal(callback: (currentConfig: AppConfig) => void): void {
    this.api.on('show-modal', callback as IpcCallback);
  }

  onPythonOutput(callback: (data: unknown) => void): void {
    this.api.on('python-script-output', callback as IpcCallback);
  }

  onBlockUi(callback: (shouldBlock: boolean) => void): void {
    this.api.on('block-ui', callback as IpcCallback);
  }

  onGenericError(callback: (err: string) => void): void {
    this.api.on('generic-error', callback as IpcCallback);
  }

  onClientLog(callback: (message: string) => void): void {
    this.api.on('client-log', callback as IpcCallback);
  }
}

export const ipcService = new IpcService();