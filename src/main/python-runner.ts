import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { OUTPUT_STATES } from '../shared/constants';
import { PythonOutputMessage } from '../shared/types';
import { updateHistoryEntryStatus, updateHistoryEntryVideoName } from './history-manager';

const isDev = process.env.NODE_ENV === 'development';

const PYTHON_SCRIPT_PATH = isDev
  ? path.join(__dirname, '../../scripts/script_python.py')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts/script_python.py');

const isWin = process.platform === 'win32';
const pythonBin = isWin ? 'Scripts/python.exe' : 'bin/python';

function getPythonPath(): string {
  if (isDev) {
    // 1. Try local portable python
    const localPortablePath = path.join(__dirname, '../../dist/python/python.exe');
    if (fs.existsSync(localPortablePath)) {
      return localPortablePath;
    }
    // 2. Try standard local venv
    const localVenvPath = path.join(__dirname, '../../venv', pythonBin);
    if (fs.existsSync(localVenvPath)) {
      return localVenvPath;
    }
    // 3. Fallback to system python
    return isWin ? 'python.exe' : 'python3';
  } else {
    // Production portable python
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'python', 'python.exe');
  }
}

const pythonVenvPath = getPythonPath();

function getDefaultTemplatePath(): string {
  return isDev
    ? path.join(__dirname, '../../templates/empty-template.flp')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'templates', 'empty-template.flp');
}

interface PythonProcess {
  process: ReturnType<typeof spawn> | null;
  isRunning: boolean;
}

const pythonProcess: PythonProcess = {
  process: null,
  isRunning: false,
};

export function isPythonRunning(): boolean {
  return pythonProcess.isRunning;
}

export function setPythonRunning(running: boolean): void {
  pythonProcess.isRunning = running;
}

export function runPythonScript(
  args: string[],
  UUID: string,
  event: { sender: { send: (channel: string, data: PythonOutputMessage) => void } },
  mainWindow: BrowserWindow | null
): void {
  pythonProcess.isRunning = true;

  const finalArgs = args.some((arg) => arg.includes('--template-path'))
    ? args
    : [...args, `--template-path=${getDefaultTemplatePath()}`];

  const spawnOptions: SpawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  };

  pythonProcess.process = spawn(pythonVenvPath, [PYTHON_SCRIPT_PATH, ...finalArgs], spawnOptions);

  const safeSend = (message: PythonOutputMessage): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      event.sender.send('python-script-output', message);
    }
  };

  const cleanup = (): void => {
    pythonProcess.isRunning = false;
    if (pythonProcess.process) {
      pythonProcess.process.removeAllListeners();
      pythonProcess.process = null;
    }
  };

  pythonProcess.process.stdout?.on('data', (data: Buffer) => {
    const rawText = data.toString();
    const text = rawText.toLowerCase();
    let status: OUTPUT_STATES;

    const titleMatch = rawText.match(/Youtube Title:\s*(.*)/i);
    if (titleMatch && titleMatch[1]) {
      const youtubeTitle = titleMatch[1].trim();
      updateHistoryEntryVideoName(UUID, youtubeTitle).catch((err) => 
        console.error('Error updating history entry videoName:', err)
      );
    }

    if (text.includes('error')) {
      status = OUTPUT_STATES.ERROR;
    } else if (text.includes('%')) {
      status = OUTPUT_STATES.INFO;
    } else {
      status = OUTPUT_STATES.SUCCESS;
    }

    const message: PythonOutputMessage = {
      text: rawText,
      UUID,
      status,
    };

    safeSend(message);
  });

  pythonProcess.process.stderr?.on('data', (data: Buffer) => {
    const message: PythonOutputMessage = {
      text: data.toString(),
      UUID,
      status: OUTPUT_STATES.ERROR,
    };
    safeSend(message);
  });

  pythonProcess.process.on('close', (code: number | null) => {
    console.log(`Process finished with code ${code}`);
    cleanup();

    const status = code === 0 ? 'success' : 'error';
    updateHistoryEntryStatus(UUID, status).catch((err) => console.error('Error updating history entry status:', err));

    const message: PythonOutputMessage = {
      text: code === 0 ? 'Script completed successfully' : `Script terminated with error code: ${code}`,
      UUID,
      status: code === 0 ? OUTPUT_STATES.SUCCESS : OUTPUT_STATES.ERROR,
    };

    safeSend(message);
  });

  pythonProcess.process.on('error', (error: Error) => {
    updateHistoryEntryStatus(UUID, 'error').catch((err) => console.error('Error updating history entry status:', err));
    const message: PythonOutputMessage = {
      text: `Error executing script: ${error.message}`,
      UUID,
      status: OUTPUT_STATES.ERROR,
    };
    safeSend(message);
  });
}

export function killPythonProcess(): void {
  if (pythonProcess.process) {
    pythonProcess.process.kill('SIGTERM');
    pythonProcess.process = null;
    pythonProcess.isRunning = false;
  }
}

export function preWarmPython(): void {
  console.log('Pre-warming Python environment in the background...');
  
  // We want to run a quick background check/import of all heavy modules
  // so Windows Defender scans them and the OS caches the DLLs in RAM.
  const prewarmScript = 'import pyflp, numpy, librosa, torch, demucs, pytubefix, moviepy';
  
  const spawnOptions: SpawnOptions = {
    stdio: 'ignore',
    shell: false,
    detached: true,
  };

  try {
    const child = spawn(pythonVenvPath, ['-c', prewarmScript], spawnOptions);
    child.unref();
    
    child.on('error', (err) => {
      console.error('Failed to pre-warm Python:', err);
    });

    child.on('close', (code) => {
      console.log(`Python pre-warming process finished with code ${code}`);
    });
  } catch (error) {
    console.error('Error initiating Python pre-warming:', error);
  }
}

export { PYTHON_SCRIPT_PATH, pythonVenvPath };