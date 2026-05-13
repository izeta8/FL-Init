import { OUTPUT_STATES } from '../../shared/constants';
import { closeDialog } from '../utils/helpers';
import type { PythonOutputMessage } from '../../shared/types';

type Phase = 'download' | 'vocals' | 'bass' | 'drums' | 'others';

export class ProgressManager {
  private progressContainer: HTMLElement;
  private outputContainer: HTMLElement;
  private stemPhases: Phase[] = ['vocals', 'bass', 'drums', 'others'];
  private separateStemsEnabled: boolean = false;
  private currentPhase: Phase = 'download';
  private currentStemIndex: number = 0;
  private lastStemPercent: number = -1;

  constructor(progressContainerId: string, outputContainerId: string) {
    this.progressContainer = document.getElementById(progressContainerId) as HTMLElement;
    this.outputContainer = document.getElementById(outputContainerId) as HTMLElement;
  }

  public setSeparateStems(enabled: boolean): void {
    this.separateStemsEnabled = enabled;
    this.reset();
  }

  public reset(): void {
    this.currentPhase = 'download';
    this.currentStemIndex = 0;
    this.lastStemPercent = -1;
  }

  public showProgressModal(projectName: string, UUID: string): void {
    this.reset();
    this.separateStemsEnabled = true;

    const progressDiv = document.querySelector('.progress-div');
    progressDiv?.classList.remove('hide');

    const modalButton = document.createElement('p');
    const textNode = document.createTextNode(projectName);
    modalButton.appendChild(textNode);
    modalButton.setAttribute('data-dialog', UUID);
    modalButton.className = 'push-button-3d fade-in';
    this.outputContainer.appendChild(modalButton);

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

    this.initPhaseCards(dialog);
    this.setupAccordion(dialog);

    this.progressContainer.appendChild(dialog);
    this.appendOutput('Loading script...', UUID, '#747474');
    dialog.showModal();
  }

  private initPhaseCards(dialog: HTMLDialogElement): void {
    const phaseCards = dialog.querySelectorAll('.phase-card');
    phaseCards.forEach(card => {
      const phase = card.getAttribute('data-phase') as Phase;
      card.classList.remove('active', 'completed', 'loading');

      if (phase === 'download') {
        card.classList.add('active');
        card.classList.add('loading');
        this.updateGauge(card as HTMLElement, 0);
      } else {
        const stemCard = card as HTMLElement;
        if (this.separateStemsEnabled) {
          stemCard.classList.add('visible');
        } else {
          stemCard.classList.remove('visible');
        }
      }
    });
  }

  private setupAccordion(dialog: HTMLDialogElement): void {
    const accordion = dialog.querySelector('.logs-accordion') as HTMLElement;
    const header = accordion?.querySelector('.accordion-header');

    header?.addEventListener('click', () => {
      accordion.classList.toggle('collapsed');
    });
  }

  private updateGauge(phaseCard: HTMLElement, percent: number): void {
    const gaugeFill = phaseCard.querySelector('.gauge-fill') as SVGCircleElement;
    const gaugePercent = phaseCard.querySelector('.gauge-percent') as HTMLElement;

    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (percent / 100) * circumference;

    if (gaugeFill) {
      gaugeFill.style.strokeDashoffset = offset.toString();
    }
    if (gaugePercent) {
      gaugePercent.textContent = `${Math.round(percent)}%`;
    }
  }

  private parsePhaseFromMessage(message: string): { phase: Phase; percent: number } | null {
    if (message.includes('MoviePy - Done')) {
      if (this.currentPhase === 'download') {
        return { phase: 'download', percent: 100 };
      }
    }

    if (message.includes('chunk') && message.includes('%')) {
      const match = message.match(/(\d+)%/);
      if (match) {
        const percent = parseInt(match[1], 10);
        return { phase: 'download', percent };
      }
    }

    const stemMatch = message.match(/(\d+)%\s*\|.*\/132\.0/);
    if (stemMatch) {
      const percent = parseInt(stemMatch[1], 10);

      if (percent === 0 && this.lastStemPercent === 100 && this.currentStemIndex < this.stemPhases.length - 1) {
        this.currentStemIndex++;
      }

      this.lastStemPercent = percent;

      const phase = this.stemPhases[this.currentStemIndex] || 'vocals';
      return { phase, percent };
    }

    return null;
  }

  private updatePhaseUI(dialog: HTMLDialogElement, phase: Phase, percent: number): void {
    const phaseCards = dialog.querySelectorAll('.phase-card');
    let previousPhase: string | null = null;

    phaseCards.forEach(card => {
      const cardPhase = card.getAttribute('data-phase');

      if (cardPhase === phase) {
        card.classList.add('active');
        card.classList.remove('completed');
        if (percent === 0) {
          card.classList.add('loading');
        } else {
          card.classList.remove('loading');
        }
        this.updateGauge(card as HTMLElement, percent);
      } else if (previousPhase && cardPhase === previousPhase) {
        card.classList.add('completed');
        card.classList.remove('active');
        this.updateGauge(card as HTMLElement, 100);
      }

      if (cardPhase) {
        previousPhase = cardPhase;
      }
    });
  }

  public handlePythonOutput(data: PythonOutputMessage): void {
    const { text, UUID, status } = data;
    const color = this.getStatusColor(status);
    this.appendOutput(text, UUID, color);

    const dialog = document.querySelector(`dialog[data-uuid='${UUID}']`) as HTMLDialogElement;
    if (!dialog) return;

    const phaseData = this.parsePhaseFromMessage(text);
    if (phaseData) {
      this.updatePhaseUI(dialog, phaseData.phase, phaseData.percent);
      this.currentPhase = phaseData.phase;
    }

    if (text.includes('MoviePy - Done')) {
      this.updatePhaseUI(dialog, 'download', 100);
      if (this.separateStemsEnabled && this.currentPhase === 'download') {
        this.currentStemIndex = 0;
        setTimeout(() => {
          const nextPhase = this.stemPhases[0];
          this.updatePhaseUI(dialog, nextPhase, 0);
          this.currentPhase = nextPhase;
        }, 100);
      }
    }

    if (text.includes('The split is complete') || text.includes('Script completed successfully')) {
      const phaseCards = dialog.querySelectorAll('.phase-card');
      phaseCards.forEach(card => {
        const cardPhase = card.getAttribute('data-phase') as Phase;
        if (cardPhase === this.currentPhase) {
          card.classList.add('completed');
          card.classList.remove('active');
          const phase = card as HTMLElement;
          this.updateGauge(phase, 100);
        }
      });
    }
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

    const body = dialog.querySelector('.accordion-content .body') as HTMLElement;
    if (!body) return;

    const p = document.createElement('p');
    p.textContent = message;
    p.style.color = color;
    body.appendChild(p);

    const autoscrollCheckbox = dialog.querySelector('.autoscroll-checkbox') as HTMLInputElement;
    if (autoscrollCheckbox && autoscrollCheckbox.checked) {
      const accordionContent = dialog.querySelector('.accordion-content') as HTMLElement;
      if (accordionContent) {
        accordionContent.scroll(0, 99999999);
      }
    }
  }
}