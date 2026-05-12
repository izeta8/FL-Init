import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import { BrowserWindow } from 'electron';
import { OUTPUT_STATES } from '../shared/constants';
import { PythonOutputMessage } from '../shared/types';

const isDev = process.env.NODE_ENV === 'development';

const PYTHON_SCRIPT_PATH = isDev
  ? path.join(__dirname, '../../src/scripts/script_python.py')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'src/scripts/script_python.py');

const pythonVenvPath = isDev
  ? path.join(__dirname, '../../venv/Scripts/python.exe')
  : path.join(process.resourcesPath, 'app.asar.unpacked', 'venv/Scripts/python.exe');

function getDefaultTemplatePath(): string {
  return isDev
    ? path.join(__dirname, '../../src/templates/empty-template.flp')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'src/templates/empty-template.flp');
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
    const text = data.toString().toLowerCase();
    let status: OUTPUT_STATES;

    if (text.includes('error')) {
      status = OUTPUT_STATES.ERROR;
    } else if (text.includes('%')) {
      status = OUTPUT_STATES.INFO;
    } else {
      status = OUTPUT_STATES.SUCCESS;
    }

    const message: PythonOutputMessage = {
      text: data.toString(),
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

    const message: PythonOutputMessage = {
      text: code === 0 ? 'Script completed successfully' : `Script terminated with error code: ${code}`,
      UUID,
      status: code === 0 ? OUTPUT_STATES.SUCCESS : OUTPUT_STATES.ERROR,
    };

    safeSend(message);
  });

  pythonProcess.process.on('error', (error: Error) => {
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

export { PYTHON_SCRIPT_PATH, pythonVenvPath };