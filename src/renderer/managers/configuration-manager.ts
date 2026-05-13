import { ipcService } from '../services/ipc-service';
import { closeDialog } from '../utils/helpers';
import type { AppConfig } from '../../shared/types';

export class ConfigurationManager {
  private projectLocationInput: HTMLInputElement;
  private separateStemsInput: HTMLInputElement;
  private stemOptionsContainer: HTMLElement;
  private loadConfigurationCallback: (config: AppConfig) => void;
  private onConfigSavedCallback: (config: { jsonConfig: string }) => void;

  constructor(
    projectLocationId: string,
    separateStemsId: string,
    stemOptionsId: string,
    loadConfiguration: (config: AppConfig) => void,
    onConfigSaved: (config: { jsonConfig: string }) => void
  ) {
    this.projectLocationInput = document.getElementById(projectLocationId) as HTMLInputElement;
    this.separateStemsInput = document.getElementById(separateStemsId) as HTMLInputElement;
    this.stemOptionsContainer = document.getElementById(stemOptionsId) as HTMLElement;
    this.loadConfigurationCallback = loadConfiguration;
    this.onConfigSavedCallback = onConfigSaved;
  }

  public init(): void {
    ipcService.onConfiguration((config) => this.loadConfigurationCallback(config));
    ipcService.onConfigSaved((config) => this.onConfigSavedCallback(config));

    this.separateStemsInput.addEventListener('change', () => this.updateStemOptionsVisibility());
    ipcService.saveStemsValue(this.separateStemsInput.checked);
  }

  public updateStemOptionsVisibility(): void {
    this.stemOptionsContainer.style.display = this.separateStemsInput.checked ? 'flex' : 'none';
  }

  public loadConfiguration(): void {
    ipcService.getConfiguration();
  }

  public setupParameters(config: AppConfig): void {
    if (!config.project_path) {
      (window.dialog as HTMLDialogElement).showModal();
    } else {
      this.projectLocationInput.value = config.project_path;
    }

    this.separateStemsInput.checked = config.separate_stems ?? false;
    this.updateStemOptionsVisibility();

    if (config.threads) {
      const threadsInput = document.getElementById('threads') as HTMLInputElement;
      if (threadsInput) threadsInput.value = config.threads;
    }
    if (config.audio_extension) {
      const audioSelect = document.getElementById('audio-extension') as HTMLSelectElement;
      if (audioSelect) audioSelect.value = config.audio_extension;
    }
  }

  public onConfigSaved(config: { jsonConfig: string }): void {
    const jsonConfig = JSON.parse(config.jsonConfig);
    this.projectLocationInput.value = jsonConfig.project_path;
  }

  public saveConfiguration(): void {
    const projectPath = (document.getElementById('default-project-path') as HTMLInputElement)?.value;
    const templatesPath = (document.getElementById('dialog-default-templates-path') as HTMLInputElement)?.value;

    ipcService.changeConfig({ project_path: projectPath, templates_path: templatesPath });
    closeDialog();
  }

  public showConfigModal(config: AppConfig): void {
    const projectPathInput = document.getElementById('default-project-path') as HTMLInputElement;
    const templatesPathInput = document.getElementById('dialog-default-templates-path') as HTMLInputElement;

    if (projectPathInput) projectPathInput.value = config.project_path || '';
    if (templatesPathInput) templatesPathInput.value = config.templates_path || '';

    (window.dialog as HTMLDialogElement).showModal();
  }

  public getSeparateStems(): boolean {
    return this.separateStemsInput.checked;
  }

  public saveThreadExtensionValues(): void {
    const threads = (document.getElementById('threads') as HTMLInputElement)?.value;
    const audioExtension = (document.getElementById('audio-extension') as HTMLSelectElement)?.value;
    if (threads && audioExtension) {
      ipcService.saveThreadExtValue(threads, audioExtension);
    }
  }
}