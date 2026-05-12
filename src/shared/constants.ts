export enum OUTPUT_STATES {
  SUCCESS = 0,
  INFO = 1,
  ERROR = 2,
}

export const APP_CONFIG = {
  DEFAULT_THREADS: '4',
  DEFAULT_AUDIO_EXTENSION: 'mp3',
  SUPPORTED_PYTHON_VERSIONS: { min: 8, max: 11 },
} as const;

export const FILE_EXTENSIONS = {
  AUDIO: ['wav', 'mp3'] as const,
  TEMPLATE: ['flp'] as const,
} as const;