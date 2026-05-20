import fs from 'fs';
import path from 'path';
import os from 'os';
import { AppConfig } from '../shared/types';
import { APP_CONFIG } from '../shared/constants';

const isDev = process.env.NODE_ENV === 'development';

const APPDATA_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'flinit');
const CONFIG_PATH = path.join(APPDATA_PATH, 'config.json');

const DEFAULT_CONFIG_PATH = isDev
  ? path.join(__dirname, '../../config.json')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'config.json');

function ensureAppDataDir(): void {
  if (!fs.existsSync(APPDATA_PATH)) {
    fs.mkdirSync(APPDATA_PATH, { recursive: true });
  }
}

function ensureConfigExists(): void {
  ensureAppDataDir();
  if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(DEFAULT_CONFIG_PATH)) {
    fs.copyFileSync(DEFAULT_CONFIG_PATH, CONFIG_PATH);
  }
}

export async function getConfiguration(): Promise<AppConfig> {
  ensureConfigExists();

  let config: AppConfig;
  try {
    const data = await fs.promises.readFile(CONFIG_PATH, 'utf8');
    if (!data || data.trim() === '') {
      throw new Error('Config file is empty');
    }
    config = JSON.parse(data);
  } catch (error) {
    console.error('Error reading/parsing config, self-healing with defaults:', error);
    try {
      if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
        const defaultData = await fs.promises.readFile(DEFAULT_CONFIG_PATH, 'utf8');
        config = JSON.parse(defaultData);
        await fs.promises.writeFile(CONFIG_PATH, defaultData, 'utf8');
      } else {
        config = {} as AppConfig;
      }
    } catch (fallbackError) {
      console.error('Failed to restore default config:', fallbackError);
      config = {} as AppConfig;
    }
  }

  let updated = false;
  const numberOfCpus = os.cpus().length.toString();

  if (!config.threads) {
    config.threads = numberOfCpus || APP_CONFIG.DEFAULT_THREADS;
    updated = true;
  }
  if (!config.audio_extension) {
    config.audio_extension = APP_CONFIG.DEFAULT_AUDIO_EXTENSION;
    updated = true;
  }
  if (!config.separate_stems) {
    config.separate_stems = false;
    updated = true;
  }

  if (updated) {
    await saveConfiguration(config);
  }

  return config;
}

export async function saveConfiguration(config: AppConfig): Promise<void> {
  ensureConfigExists();
  const jsonConfig = JSON.stringify(config, null, 2);
  await fs.promises.writeFile(CONFIG_PATH, jsonConfig, 'utf8');
}

export function copyDefaultConfig(sourcePath: string): void {
  ensureAppDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(sourcePath, CONFIG_PATH);
  }
}

export { CONFIG_PATH, APPDATA_PATH };