import './styles.css';
import { ipcService } from './services/ipc-service';
import { showError, generateUUID } from './utils/helpers';
import { FormValidator } from './managers/form-validator';
import { ProgressManager } from './managers/progress-manager';
import { TemplateManager } from './managers/template-manager';
import { ConfigurationManager } from './managers/configuration-manager';
import type { AppConfig, PythonOutputMessage } from '../shared/types';

class App {
  private formValidator: FormValidator;
  private progressManager: ProgressManager;
  private templateManager: TemplateManager;
  private configurationManager: ConfigurationManager;

  constructor() {
    this.formValidator = new FormValidator(
      'youtube-url',
      'project-location',
      'project-name',
      (path) => ipcService.validateDirectory(path),
      (path, name) => ipcService.validateProjectName(path, name)
    );

    this.progressManager = new ProgressManager('progress-dialog-container', 'python-output-container');

    this.templateManager = new TemplateManager('template-flp', (files) => this.templateManager.loadTemplates(files));

    this.configurationManager = new ConfigurationManager(
      'project-location',
      'separate-stems',
      'stems-options',
      (config) => this.configurationManager.setupParameters(config),
      (config) => this.configurationManager.onConfigSaved(config)
    );

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
    this.formValidator.init();
    this.configurationManager.init();
    this.templateManager.init();

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

    document.getElementById('modal-save')?.addEventListener('click', () => this.configurationManager.saveConfiguration());
    document.getElementById('close-modal')?.addEventListener('click', () => {
      const dialog = document.querySelector('dialog');
      if (dialog) dialog.close();
    });

    const browseConfigButtons = document.querySelectorAll('button[data-browse-config]');
    browseConfigButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        const parentDiv = (e.target as HTMLElement).closest('div');
        const input = parentDiv?.querySelector('input');
        if (input) {
          ipcService.openDirectoryDialog(input.id);
        }
      });
    });

    document.getElementById('threads')?.addEventListener('change', () => this.configurationManager.saveThreadExtensionValues());
    document.getElementById('audio-extension')?.addEventListener('change', () => this.configurationManager.saveThreadExtensionValues());

    this.setupAdvancedToggle();
  }

  private setupIpcListeners(): void {
    ipcService.onValidationDirectory((response) => this.formValidator.handleValidationResponse(response, 'directory-input-group'));
    ipcService.onValidationProjectName((response) => this.formValidator.handleValidationResponse(response, 'project-name-input-group'));
    ipcService.onShowModal((config) => this.configurationManager.showConfigModal(config));
    ipcService.onPythonOutput((data) => this.progressManager.handlePythonOutput(data as PythonOutputMessage));
    ipcService.onBlockUi((shouldBlock) => this.toggleLoadingScreen(shouldBlock));
    ipcService.onGenericError((err) => showError('Error', err));
  }

  private initializeUI(): void {
    this.configurationManager.loadConfiguration();
    this.templateManager.loadTemplatesList();
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

  private handleFormSubmit(): void {
    const validation = this.formValidator.validateForm();
    if (!validation.valid) {
      showError('Validation Error', `The following fields are required:<br/>${validation.errors.map(e => `<br/> - ${e}`).join('')}`);
      return;
    }

    const formData = this.formValidator.getFormData();
    const separateStems = this.configurationManager.getSeparateStems();
    const templatePath = this.templateManager.getSelectedTemplate();

    const args: string[] = [formData.projectLocation, formData.youtubeUrl, formData.projectName];

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

    this.formValidator.clearInputs();
    this.progressManager.setSeparateStems(separateStems);
    this.progressManager.showProgressModal(formData.projectName, UUID);
  }

  private toggleLoadingScreen(show: boolean): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = show ? 'block' : 'none';
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