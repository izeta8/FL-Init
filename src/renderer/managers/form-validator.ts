import { validateYoutubeURL } from '../utils/helpers';
import { showError } from '../utils/helpers';

export class FormValidator {
  private youtubeUrlInput: HTMLInputElement;
  private projectLocationInput: HTMLInputElement;
  private projectNameInput: HTMLInputElement;
  private validateDirectoryCallback: (path: string) => void;
  private validateProjectNameCallback: (path: string, name: string) => void;

  constructor(
    youtubeUrlId: string,
    projectLocationId: string,
    projectNameId: string,
    validateDirectory: (path: string) => void,
    validateProjectName: (path: string, name: string) => void
  ) {
    this.youtubeUrlInput = document.getElementById(youtubeUrlId) as HTMLInputElement;
    this.projectLocationInput = document.getElementById(projectLocationId) as HTMLInputElement;
    this.projectNameInput = document.getElementById(projectNameId) as HTMLInputElement;
    this.validateDirectoryCallback = validateDirectory;
    this.validateProjectNameCallback = validateProjectName;
  }

  public init(): void {
    this.youtubeUrlInput.addEventListener('change', () => this.validateUrl());
    this.projectLocationInput.addEventListener('change', () => this.validateInputs());
    this.projectNameInput.addEventListener('change', () => this.validateInputs());
  }

  public validateUrl(): void {
    const url = this.youtubeUrlInput.value;
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

  public validateInputs(): void {
    const projectPath = this.projectLocationInput.value;
    const projectName = this.projectNameInput.value;

    if (projectPath) this.validateDirectoryCallback(projectPath);
    if (projectPath && projectName) this.validateProjectNameCallback(projectPath, projectName);
  }

  public handleValidationResponse(response: { success: boolean; errorMessage: string }, parentId: string): void {
    const parent = document.getElementById(parentId);
    if (!parent) return;

    if (!response.success) {
      this.displayError(response.errorMessage, parent);
    } else {
      this.removeError(parent);
    }
  }

  public validateForm(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const youtubeUrl = this.youtubeUrlInput.value.trim();
    const projectLocation = this.projectLocationInput.value.trim();
    const projectName = this.projectNameInput.value.trim();

    if (!youtubeUrl) errors.push('Youtube URL');
    if (!projectLocation) errors.push('Project Location');
    if (!projectName) errors.push('Project Name');

    const projectNameGroup = document.getElementById('project-name-input-group');
    const errorElement = projectNameGroup?.querySelector('.error');
    if (errorElement) {
      return {
        valid: false,
        errors: ['Project name validation failed']
      };
    }

    return { valid: errors.length === 0, errors };
  }

  public getFormData(): { youtubeUrl: string; projectLocation: string; projectName: string } {
    return {
      youtubeUrl: this.youtubeUrlInput.value.trim(),
      projectLocation: this.projectLocationInput.value.trim(),
      projectName: this.projectNameInput.value.trim()
    };
  }

  public clearInputs(): void {
    this.youtubeUrlInput.value = '';
    this.projectNameInput.value = '';
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
}