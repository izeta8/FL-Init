const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const PYTHON_VERSION = '3.10.11';
const PYTHON_ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const ROOT_DIR = path.resolve(__dirname, '..');
const PORTABLE_PYTHON_DIR = path.join(ROOT_DIR, 'python');
const TEMP_ZIP_PATH = path.join(ROOT_DIR, 'python-portable.zip');
const GET_PIP_PATH = path.join(PORTABLE_PYTHON_DIR, 'get-pip.py');
const REQUIREMENTS_PATH = path.join(ROOT_DIR, 'requirements.txt');

// Helper to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Helper to extract zip natively on Windows (tar.exe or PowerShell)
function extractZip(zipPath, destDir) {
  console.log(`Extracting ${zipPath} to ${destDir}...`);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    // Try native Windows tar (available on Win 10/11)
    execSync(`tar -xf "${zipPath}" -C "${destDir}"`, { stdio: 'inherit' });
  } catch (err) {
    console.log('tar extraction failed, falling back to PowerShell...');
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
  }
}

async function setup() {
  try {
    // 1. Clean previous installation
    if (fs.existsSync(PORTABLE_PYTHON_DIR)) {
      console.log('Cleaning existing python folder...');
      fs.rmSync(PORTABLE_PYTHON_DIR, { recursive: true, force: true });
    }

    // 2. Download Python Zip
    await downloadFile(PYTHON_ZIP_URL, TEMP_ZIP_PATH);

    // 3. Extract Python Zip
    extractZip(TEMP_ZIP_PATH, PORTABLE_PYTHON_DIR);
    fs.unlinkSync(TEMP_ZIP_PATH);

    // 4. Find and configure the ._pth file
    const files = fs.readdirSync(PORTABLE_PYTHON_DIR);
    const pthFile = files.find(f => f.endsWith('._pth'));
    if (!pthFile) {
      throw new Error('Could not find ._pth file in extracted Python directory');
    }
    const pthPath = path.join(PORTABLE_PYTHON_DIR, pthFile);
    console.log(`Configuring ${pthFile}...`);
    
    let pthContent = fs.readFileSync(pthPath, 'utf8');
    
    // Uncomment 'import site'
    pthContent = pthContent.replace(/#\s*import site/, 'import site');
    
    // Ensure '.' and 'Lib/site-packages' paths are registered
    const lines = pthContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (!lines.includes('.')) {
      lines.unshift('.');
    }
    if (!lines.includes('Lib/site-packages')) {
      lines.push('Lib/site-packages');
    }
    
    fs.writeFileSync(pthPath, lines.join('\n') + '\n', 'utf8');

    // 5. Download get-pip.py
    await downloadFile(GET_PIP_URL, GET_PIP_PATH);

    // 6. Bootstrap pip
    console.log('Bootstrapping pip...');
    const pythonExePath = path.join(PORTABLE_PYTHON_DIR, 'python.exe');
    execSync(`"${pythonExePath}" "${GET_PIP_PATH}" --no-warn-script-location`, {
      cwd: PORTABLE_PYTHON_DIR,
      stdio: 'inherit'
    });
    
    // Clean get-pip.py
    fs.unlinkSync(GET_PIP_PATH);

    // 7. Install requirements.txt
    if (fs.existsSync(REQUIREMENTS_PATH)) {
      console.log('Installing requirements.txt...');
      execSync(`"${pythonExePath}" -m pip install -r "${REQUIREMENTS_PATH}" --no-warn-script-location`, {
        cwd: PORTABLE_PYTHON_DIR,
        stdio: 'inherit'
      });
    } else {
      console.log('No requirements.txt found, skipping dependency installation.');
    }

    console.log('Standalone Portable Python environment setup successfully!');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup();
