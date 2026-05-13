import { ipcService } from '../services/ipc-service';
import { getFileNameFromPath } from '../utils/helpers';

export class TemplateManager {
  private templateSelect: HTMLSelectElement;
  private loadTemplatesCallback: (filesPaths: string[]) => void;

  constructor(templateSelectId: string, loadTemplatesCallback: (filesPaths: string[]) => void) {
    this.templateSelect = document.getElementById(templateSelectId) as HTMLSelectElement;
    this.loadTemplatesCallback = loadTemplatesCallback;
  }

  public init(): void {
    ipcService.onTemplatesList((data) => this.loadTemplates(data.filesPaths));
  }

  public loadTemplatesList(): void {
    ipcService.askTemplatesList();
  }

  public loadTemplates(filesPaths: string[]): void {
    this.clearTemplates();
    filesPaths.forEach((filePath) => this.addTemplateOption(filePath));
    this.templateSelect.selectedIndex = 0;
  }

  public addTemplateOption(filePath: string): void {
    const option = document.createElement('option');
    option.text = filePath ? getFileNameFromPath(filePath) : '';
    option.value = filePath;
    this.templateSelect.appendChild(option);
    if (filePath) this.templateSelect.selectedIndex = this.templateSelect.options.length - 1;
  }

  public clearTemplates(): void {
    while (this.templateSelect.options.length > 0) {
      this.templateSelect.remove(0);
    }
    const option = document.createElement('option');
    option.text = '(empty template)';
    option.value = '';
    this.templateSelect.appendChild(option);
  }

  public getSelectedTemplate(): string {
    return this.templateSelect.value;
  }

  public getTemplatesPath(): string {
    return this.templateSelect.value;
  }
}