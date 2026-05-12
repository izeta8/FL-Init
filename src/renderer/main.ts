import './styles.css';
import { ipcService } from './services/ipc-service';
import { showError, validateYoutubeURL, generateUUID, closeDialog, getFileNameFromPath } from './utils/helpers';
import { OUTPUT_STATES } from '../shared/constants';
import type { AppConfig, PythonOutputMessage } from '../shared/types';

class App {
  private inputYoutubeUrl: HTMLInputElement;
  private inputProjectLocation: HTMLInputElement;
  private inputProjectName: HTMLInputElement;
  private inputSeparateStems: HTMLInputElement;
  private inputTemplatePath: HTMLSelectElement;
  private stemOptions: HTMLElement;
  private pythonOutputContainer: HTMLElement;
  private progressDialogContainer: HTMLElement;

  constructor() {
    this.inputYoutubeUrl = document.getElementById('youtube-url') as HTMLInputElement;
    this.inputProjectLocation = document.getElementById('project-location') as HTMLInputElement;
    this.inputProjectName = document.getElementById('project-name') as HTMLInputElement;
    this.inputSeparateStems = document.getElementById('separate-stems') as HTMLInputElement;
    this.inputTemplatePath = document.getElementById('template-flp') as HTMLSelectElement;
    this.stemOptions = document.getElementById('stems-options') as HTMLElement;
    this.pythonOutputContainer = document.getElementById('python-output-container') as HTMLElement;
    this.progressDialogContainer = document.getElementById('progress-dialog-container') as HTMLElement;

    this.init();
  }

  private init(): void {
    this.setupVersionDisplay();
    this.setupEventListeners();
    this.setupIpcListeners();
    this.initializeUI();
  }

  private setupVersionDisplay(): void {
    ipcService.getAppVersion().then((version) => {
      const versionElement = document.getElementById('app-version');
      if (versionElement) versionElement.innerText = `v${version}`;
    });
  }

  private setupEventListeners(): void {
    this.inputSeparateStems.addEventListener('change', () => this.updateStemOptionsVisibility());

    document.getElementById('browse-location')?.addEventListener('click', () => {
      ipcService.openDirectoryDialog('project-location');
    });

    document.getElementById('browse-flp-template')?.addEventListener('click', () => {
      ipcService.openFileDialog(['flp']);
    });

    document.getElementById('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    document.getElementById('modal-save')?.addEventListener('click', () => this.saveConfiguration());
    document.getElementById('close-modal')?.addEventListener('click', closeDialog);

    this.inputYoutubeUrl.addEventListener('change', () => this.validateUrl());
    this.inputProjectLocation.addEventListener('change', () => this.validateInputs());
    this.inputProjectName.addEventListener('change', () => this.validateInputs());

    this.inputSeparateStems.addEventListener('change', () => ipcService.saveStemsValue(this.inputSeparateStems.checked));

    document.getElementById('threads')?.addEventListener('change', () => this.saveThreadExtensionValues());
    document.getElementById('audio-extension')?.addEventListener('change', () => this.saveThreadExtensionValues());

    this.setupAdvancedToggle();
  }

  private setupIpcListeners(): void {
    ipcService.onConfiguration((config) => this.setupParameters(config));
    ipcService.onConfigSaved((config) => this.onConfigSaved(config));
    ipcService.onSelectedDirectory((data) => this.onSelectedDirectory(data));
    ipcService.onSelectedFile((filePath) => this.addTemplateOption(filePath));
    ipcService.onTemplatesList((data) => this.loadTemplates(data.filesPaths));
    ipcService.onValidationDirectory((response) => this.handleValidationResponse(response, 'directory-input-group'));
    ipcService.onValidationProjectName((response) => this.handleValidationResponse(response, 'project-name-input-group'));
    ipcService.onShowModal((config) => this.showConfigModal(config));
    ipcService.onPythonOutput((data) => this.handlePythonOutput(data as PythonOutputMessage));
    ipcService.onBlockUi((shouldBlock) => this.toggleLoadingScreen(shouldBlock));
    ipcService.onGenericError((err) => showError('Error', err));
  }

  private initializeUI(): void {
    ipcService.getConfiguration();
    this.updateStemOptionsVisibility();
  }

  private setupAdvancedToggle(): void {
    const advancedToggle = document.getElementById('advanced-toggle');
    const advancedOptionsContent = document.getElementById('advanced-options-content');

    if (advancedToggle && advancedOptionsContent) {
      advancedOptionsContent.style.display = 'none';
      const icon = advancedToggle.querySelector('i');
      if (icon) {
        (icon as HTMLElement).style.transition = 'transform 0.3s ease';
      }
      advancedToggle.addEventListener('click', () => {
        if (advancedOptionsContent.style.display === 'none' || advancedOptionsContent.style.display === '') {
          advancedOptionsContent.style.display = 'block';
          if (icon) (icon as HTMLElement).style.transform = 'rotate(180deg)';
        } else {
          advancedOptionsContent.style.display = 'none';
          if (icon) (icon as HTMLElement).style.transform = 'rotate(0deg)';
        }
      });
    }
  }

  private updateStemOptionsVisibility(): void {
    this.stemOptions.style.display = this.inputSeparateStems.checked ? 'flex' : 'none';
  }

  private setupParameters(config: AppConfig): void {
    if (!config.project_path) {
      (window.dialog as HTMLDialogElement).showModal();
    } else {
      this.inputProjectLocation.value = config.project_path;
    }

    this.addTemplateOption('');
    const firstOption = this.inputTemplatePath.querySelector('option');
    if (firstOption) firstOption.textContent = '(empty template)';

    this.loadTemplatesList();

    this.inputSeparateStems.checked = config.separate_stems ?? false;
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

  private loadTemplatesList(): void {
    ipcService.askTemplatesList();
  }

  private loadTemplates(filesPaths: string[]): void {
    filesPaths.forEach((filePath) => this.addTemplateOption(filePath));
    this.inputTemplatePath.selectedIndex = 0;
  }

  private addTemplateOption(filePath: string): void {
    const option = document.createElement('option');
    option.text = filePath ? getFileNameFromPath(filePath) : '';
    option.value = filePath;
    this.inputTemplatePath.appendChild(option);
    if (filePath) this.inputTemplatePath.selectedIndex = this.inputTemplatePath.options.length - 1;
  }

  private validateUrl(): void {
    const url = this.inputYoutubeUrl.value;
    const isValid = validateYoutubeURL(url);
    const inputGroup = document.getElementById('youtube-input-group');
    if (!inputGroup) return;

    const existingWarning = inputGroup.querySelector('.warning');

    if (!isValid && !existingWarning && url) {
      const warning = document.createElement('p');
      warning.textContent = '⚠️ The URL doesn\'t seem to be from Youtube!';
      warning.className = 'warning slide-fade-in';
      inputGroup.appendChild(warning);
    } else if (isValid && existingWarning) {
      this.removeElementWithAnimation(existingWarning);
    }
  }

  private validateInputs(): void {
    const projectPath = this.inputProjectLocation.value;
    const directory = this.inputProjectName.value;

    if (projectPath) ipcService.validateDirectory(projectPath);
    if (projectPath && directory) ipcService.validateProjectName(projectPath, directory);
  }

  private handleValidationResponse(response: { success: boolean; errorMessage: string }, parentId: string): void {
    const parent = document.getElementById(parentId);
    if (!parent) return;

    if (!response.success) {
      this.displayError(response.errorMessage, parent);
    } else {
      this.removeError(parent);
    }
  }

  private displayError(message: string, parent: Element): void {
    this.removeError(parent);
    const error = document.createElement('p');
    error.innerHTML = message;
    error.className = 'error slide-fade-in';
    parent.appendChild(error);
  }

  private removeError(parent: Element): void {
    const error = parent.querySelector('.error');
    if (error) this.removeElementWithAnimation(error);
  }

  private removeElementWithAnimation(element: Element): void {
    element.classList.add('fade-out');
    element.addEventListener('animationend', () => element.remove(), { once: true });
  }

  private handleFormSubmit(): void {
    const youtubeUrl = this.inputYoutubeUrl.value.trim();
    const projectLocation = this.inputProjectLocation.value.trim();
    const projectName = this.inputProjectName.value.trim();

    if (!youtubeUrl || !projectLocation || !projectName) {
      let emptyFields = 'The following fields are required: ';
      emptyFields += !youtubeUrl ? '<br /> - Youtube URL ' : '';
      emptyFields += !projectLocation ? '<br /> - Project Location ' : '';
      emptyFields += !projectName ? '<br /> - Project Name ' : '';
      showError('Validation Error', emptyFields);
      return;
    }

    const errorElement = document.getElementById('project-name-input-group')?.querySelector('.error');
    if (errorElement) {
      showError('Validation error', `${(errorElement as HTMLElement).innerHTML} <br/> Change the project location or choose a unique project name.`);
      return;
    }

    const separateStems = this.inputSeparateStems.checked;
    const templatePath = this.inputTemplatePath.value;

    const args: string[] = [projectLocation, youtubeUrl, projectName];

    if (separateStems) args.push('--separate-stems');
    if (templatePath) args.push(`--template-path=${templatePath}`);

    if (separateStems) {
      const audioExtension = (document.getElementById('audio-extension') as HTMLSelectElement)?.value || 'wav';
      const threads = (document.getElementById('threads') as HTMLInputElement)?.value || '4';
      args.push(`--audio-extension=${audioExtension}`);
      args.push(`--threads=${threads}`);
    }

    const UUID = generateUUID();
    ipcService.runPythonScript(args, UUID);

    this.inputYoutubeUrl.value = '';
    this.inputProjectName.value = '';

    this.showProgressModal(projectName, UUID);
  }

  private showProgressModal(projectName: string, UUID: string): void {
    const progressDiv = document.querySelector('.progress-div');
    progressDiv?.classList.remove('hide');

    const modalButton = document.createElement('p');
    const textNode = document.createTextNode(projectName);
    modalButton.appendChild(textNode);
    modalButton.setAttribute('data-dialog', UUID);
    modalButton.className = 'push-button-3d fade-in';
    this.pythonOutputContainer.appendChild(modalButton);

    modalButton.addEventListener('click', () => {
      const dataDialog = modalButton.getAttribute('data-dialog');
      const dialog = document.querySelector(`dialog[data-uuid='${dataDialog}']`) as HTMLDialogElement;
      dialog?.showModal();
    });

    const templateDialog = document.querySelector('dialog[data-template-dialog]') as HTMLDialogElement;
    if (!templateDialog) return;

    const dialog = templateDialog.cloneNode(true) as HTMLDialogElement;
    dialog.setAttribute('data-uuid', UUID);

    const title = dialog.querySelector('.progress-title');
    if (title) title.textContent = projectName;

    const closeBtn = dialog.querySelector('.x');
    closeBtn?.addEventListener('click', closeDialog);

    this.progressDialogContainer.appendChild(dialog);
    this.appendOutput('Loading script...', UUID, '#747474');
    dialog.showModal();
  }

  private handlePythonOutput(data: PythonOutputMessage): void {
    const { text, UUID, status } = data;
    const color = this.getStatusColor(status);
    this.appendOutput(text, UUID, color);
  }

  private getStatusColor(status: OUTPUT_STATES): string {
    switch (status) {
      case OUTPUT_STATES.ERROR: return '#c52828';
      case OUTPUT_STATES.INFO: return '#14bef3';
      case OUTPUT_STATES.SUCCESS: return '#5dc52a';
      default: return 'white';
    }
  }

  private appendOutput(message: string, UUID: string, color: string): void {
    const dialog = document.querySelector(`dialog[data-uuid='${UUID}']`) as HTMLDialogElement;
    if (!dialog) return;

    const body = dialog.querySelector('.body');
    if (!body) return;

    const p = document.createElement('p');
    p.textContent = message;
    p.style.color = color;
    body.appendChild(p);
    (body as HTMLElement).scrollTop = (body as HTMLElement).scrollHeight;
  }

  private saveConfiguration(): void {
    const projectPath = (document.getElementById('default-project-path') as HTMLInputElement)?.value;
    const templatesPath = (document.getElementById('dialog-default-templates-path') as HTMLInputElement)?.value;

    ipcService.changeConfig({ project_path: projectPath, templates_path: templatesPath });
    closeDialog();
  }

  private onConfigSaved(config: { jsonConfig: string }): void {
    const jsonConfig = JSON.parse(config.jsonConfig);
    this.inputProjectLocation.value = jsonConfig.project_path;
    this.inputTemplatePath.value = jsonConfig.templates_path;
    this.loadTemplatesList();
  }

  private onSelectedDirectory(data: { directoryPath: string; input_id: string }): void {
    const input = document.getElementById(data.input_id) as HTMLInputElement;
    if (input) {
      input.value = data.directoryPath;
      input.dispatchEvent(new Event('change'));
    }
  }

  private showConfigModal(config: AppConfig): void {
    const projectPathInput = document.getElementById('default-project-path') as HTMLInputElement;
    const templatesPathInput = document.getElementById('dialog-default-templates-path') as HTMLInputElement;

    if (projectPathInput) projectPathInput.value = config.project_path || '';
    if (templatesPathInput) templatesPathInput.value = config.templates_path || '';

    (window.dialog as HTMLDialogElement).showModal();
  }

  private toggleLoadingScreen(show: boolean): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = show ? 'block' : 'none';
  }

  private saveThreadExtensionValues(): void {
    const threads = (document.getElementById('threads') as HTMLInputElement)?.value;
    const audioExtension = (document.getElementById('audio-extension') as HTMLSelectElement)?.value;
    if (threads && audioExtension) ipcService.saveThreadExtValue(threads, audioExtension);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});

declare global {
  interface Window {
    dialog: HTMLDialogElement;
  }
}