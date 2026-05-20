import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { ipcService } from './services/ipc-service';
import { validateYoutubeURL, generateUUID, getFileNameFromPath } from './utils/helpers';
import { OUTPUT_STATES } from '../shared/constants';
import type { AppConfig, PythonOutputMessage, HistoryEntry } from '../shared/types';

type Phase = 'download' | 'vocals' | 'bass' | 'drums' | 'others';

interface ProgressPhaseState {
  percent: number;
  status: 'pending' | 'loading' | 'active' | 'completed';
}

const STEM_PHASES: Phase[] = ['vocals', 'bass', 'drums', 'others'];

export default function App() {
  // App version
  const [appVersion, setAppVersion] = useState<string>('');

  // General Loading overlay
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form State
  const [youtubeUrl, setYoutubeUrl] = useState<string>('https://www.youtube.com/watch?v=A11IW6cLqjA&list=RDA11IW6cLqjA&start_radio=1');
  const [projectLocation, setProjectLocation] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [separateStems, setSeparateStems] = useState<boolean>(false);
  const [audioExtension, setAudioExtension] = useState<string>('wav');
  const [threads, setThreads] = useState<string>('4');

  // Lists populated via IPC
  const [templatesList, setTemplatesList] = useState<string[]>([]);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);

  // Validation Warnings/Errors
  const [youtubeWarning, setYoutubeWarning] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Dialog / Modal Visibility states
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // Config Modal Temp Values
  const [configProjectPath, setConfigProjectPath] = useState<string>('');
  const [configTemplatesPath, setConfigTemplatesPath] = useState<string>('');

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const shouldShowModalRef = useRef(false);

  // Active progress modal state
  const [progressProjectName, setProgressProjectName] = useState<string>('');
  const [progressUUID, setProgressUUID] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<Record<Phase, ProgressPhaseState>>({
    download: { percent: 0, status: 'pending' },
    vocals: { percent: 0, status: 'pending' },
    bass: { percent: 0, status: 'pending' },
    drums: { percent: 0, status: 'pending' },
    others: { percent: 0, status: 'pending' },
  });
  const [logs, setLogs] = useState<{ text: string; color: string }[]>([]);
  const [autoscroll, setAutoscroll] = useState<boolean>(true);
  const [logsAccordionCollapsed, setLogsAccordionCollapsed] = useState<boolean>(false);

  // Refs for callbacks to access latest states without triggering re-registration
  const separateStemsRef = useRef<boolean>(separateStems);
  const currentPhaseRef = useRef<Phase>('download');
  const currentStemIndexRef = useRef<number>(0);
  const lastStemPercentRef = useRef<number>(-1);
  const autoscrollRef = useRef<boolean>(autoscroll);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    separateStemsRef.current = separateStems;
  }, [separateStems]);

  useEffect(() => {
    autoscrollRef.current = autoscroll;
    if (autoscroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [autoscroll, logs]);

  // IPC Event Bindings on Mount
  useEffect(() => {
    // 1. Fetch initial version
    ipcService.getAppVersion().then((version) => setAppVersion(`v${version}`));

    // 2. Initial Config Loader
    ipcService.getConfiguration();

    // 3. Initial Templates List Loader
    ipcService.askTemplatesList();

    // 4. Register IPC Callbacks
    ipcService.onConfiguration((config: AppConfig) => {
      setAppConfig(config);
      if (!config.project_path || shouldShowModalRef.current) {
        setConfigProjectPath(config.project_path || '');
        setConfigTemplatesPath(config.templates_path || '');
        setShowConfigModal(true);
        shouldShowModalRef.current = false;
      } else {
        setProjectLocation(config.project_path);
      }
      setSeparateStems(config.separate_stems ?? false);
      if (config.threads) setThreads(config.threads);
      if (config.audio_extension) setAudioExtension(config.audio_extension);
    });

    ipcService.onConfigSaved((config) => {
      const jsonConfig = JSON.parse(config.jsonConfig) as AppConfig;
      setAppConfig(jsonConfig);
      setProjectLocation(jsonConfig.project_path || '');
    });

    ipcService.onSelectedDirectory((data) => {
      const { directoryPath, input_id } = data;
      if (input_id === 'project-location') {
        setProjectLocation(directoryPath);
        ipcService.validateDirectory(directoryPath);
      } else if (input_id === 'default-project-path') {
        setConfigProjectPath(directoryPath);
      } else if (input_id === 'dialog-default-templates-path') {
        setConfigTemplatesPath(directoryPath);
      }
    });

    ipcService.onSelectedFile((filePath) => {
      if (filePath) {
        // Add to template options if not present and select it
        setTemplatesList((prev) => {
          if (!prev.includes(filePath)) {
            return [...prev, filePath];
          }
          return prev;
        });
        setSelectedTemplate(filePath);
      }
    });

    ipcService.onTemplatesList((data) => {
      setTemplatesList(data.filesPaths || []);
    });

    ipcService.onValidationDirectory((response) => {
      if (!response.success) {
        setLocationError(response.errorMessage);
      } else {
        setLocationError(null);
      }
    });

    ipcService.onValidationProjectName((response) => {
      if (!response.success) {
        setNameError(response.errorMessage);
      } else {
        setNameError(null);
      }
    });

    ipcService.onShowModal((currentConfig: AppConfig) => {
      setConfigProjectPath(currentConfig.project_path || '');
      setConfigTemplatesPath(currentConfig.templates_path || '');
      setShowConfigModal(true);
    });

    ipcService.onPythonOutput((data) => {
      const output = data as PythonOutputMessage;
      handlePythonScriptOutput(output);
    });

    ipcService.onBlockUi((shouldBlock) => {
      setIsLoading(shouldBlock);
    });

    ipcService.onGenericError((err) => {
      Swal.fire({
        title: 'Error',
        html: `<p>${err}</p>`,
        icon: 'error',
        background: '#1e1e1e',
        color: '#ffffff',
        confirmButtonColor: '#d9b063',
      });
    });

    // Cleanup all listeners on unmount
    return () => {
      const api = window.electronAPI;
      api.removeAllListeners('get-configuration');
      api.removeAllListeners('config-saved');
      api.removeAllListeners('selected-directory');
      api.removeAllListeners('selected-file');
      api.removeAllListeners('get-templates-list');
      api.removeAllListeners('validate-directory');
      api.removeAllListeners('validate-project-name');
      api.removeAllListeners('show-modal');
      api.removeAllListeners('python-script-output');
      api.removeAllListeners('block-ui');
      api.removeAllListeners('generic-error');
      api.removeAllListeners('client-log');
    };
  }, []);

  // Validate fields dynamically
  useEffect(() => {
    if (projectLocation) {
      ipcService.validateDirectory(projectLocation);
    }
  }, [projectLocation]);

  useEffect(() => {
    if (projectLocation && projectName) {
      ipcService.validateProjectName(projectLocation, projectName);
    }
  }, [projectLocation, projectName]);

  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setYoutubeUrl(val);
    if (!val) {
      setYoutubeWarning(null);
    } else {
      const isValid = validateYoutubeURL(val);
      if (!isValid) {
        setYoutubeWarning("⚠️ The URL doesn't seem to be from Youtube!");
      } else {
        setYoutubeWarning(null);
      }
    }
  };

  // Python Output Parsing logic
  const parsePhaseFromMessage = (message: string): { phase: Phase; percent: number } | null => {
    if (message.includes('MoviePy - Done')) {
      if (currentPhaseRef.current === 'download') {
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

      if (percent === 0 && lastStemPercentRef.current === 100 && currentStemIndexRef.current < STEM_PHASES.length - 1) {
        currentStemIndexRef.current++;
      }

      lastStemPercentRef.current = percent;
      const phase = STEM_PHASES[currentStemIndexRef.current] || 'vocals';
      return { phase, percent };
    }

    return null;
  };

  const handlePythonScriptOutput = (data: PythonOutputMessage) => {
    const { text, UUID, status } = data;
    
    // Status colors
    let color = '#ffffff';
    if (status === OUTPUT_STATES.ERROR) color = '#ff4d4d';
    else if (status === OUTPUT_STATES.INFO) color = '#14bef3';
    else if (status === OUTPUT_STATES.SUCCESS) color = '#5dc52a';

    setLogs((prev) => [...prev, { text, color }]);

    const parsed = parsePhaseFromMessage(text);
    if (parsed) {
      updatePhaseUI(parsed.phase, parsed.percent);
      currentPhaseRef.current = parsed.phase;
    }

    if (text.includes('MoviePy - Done')) {
      updatePhaseUI('download', 100);
      if (separateStemsRef.current && currentPhaseRef.current === 'download') {
        currentStemIndexRef.current = 0;
        lastStemPercentRef.current = -1;
        setTimeout(() => {
          updatePhaseUI('vocals', 0);
          currentPhaseRef.current = 'vocals';
        }, 100);
      }
    }

    if (text.includes('The split is complete') || text.includes('Script completed successfully')) {
      const phases: Phase[] = separateStemsRef.current
        ? ['download', 'vocals', 'bass', 'drums', 'others']
        : ['download'];

      setProgressData((prev) => {
        const nextProgress = { ...prev };
        phases.forEach((p) => {
          nextProgress[p] = { percent: 100, status: 'completed' };
        });
        return nextProgress;
      });
    }
  };

  const updatePhaseUI = (phase: Phase, percent: number) => {
    const phases: Phase[] = separateStemsRef.current
      ? ['download', 'vocals', 'bass', 'drums', 'others']
      : ['download'];

    const currentIdx = phases.indexOf(phase);
    if (currentIdx === -1) return;

    setProgressData((prev) => {
      const nextProgress = { ...prev };
      phases.forEach((p, idx) => {
        if (idx < currentIdx) {
          nextProgress[p] = { percent: 100, status: 'completed' };
        } else if (idx === currentIdx) {
          nextProgress[p] = { 
            percent, 
            status: percent === 0 ? 'loading' : 'active' 
          };
        } else {
          nextProgress[p] = { percent: 0, status: 'pending' };
        }
      });
      return nextProgress;
    });
  };

  const resetProgress = () => {
    currentPhaseRef.current = 'download';
    currentStemIndexRef.current = 0;
    lastStemPercentRef.current = -1;
    setProgressData({
      download: { percent: 0, status: 'pending' },
      vocals: { percent: 0, status: 'pending' },
      bass: { percent: 0, status: 'pending' },
      drums: { percent: 0, status: 'pending' },
      others: { percent: 0, status: 'pending' },
    });
    setLogs([]);
  };

  // Submit trigger
  const handleDownloadSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!youtubeUrl.trim() || !projectLocation.trim() || !projectName.trim()) {
      const errors = [];
      if (!youtubeUrl.trim()) errors.push('Youtube URL');
      if (!projectLocation.trim()) errors.push('Project Location');
      if (!projectName.trim()) errors.push('Project Name');
      
      Swal.fire({
        title: 'Validation Error',
        html: `<p>The following fields are required:<br/>${errors.map(e => `<br/> - ${e}`).join('')}</p>`,
        icon: 'error',
        background: '#1e1e1e',
        color: '#ffffff',
        confirmButtonColor: '#d9b063',
      });
      return;
    }

    if (nameError) {
      Swal.fire({
        title: 'Validation Error',
        html: `<p>Project name validation failed. Please check the project directory.</p>`,
        icon: 'error',
        background: '#1e1e1e',
        color: '#ffffff',
        confirmButtonColor: '#d9b063',
      });
      return;
    }

    const args: string[] = [projectLocation, youtubeUrl, projectName];
    if (separateStems) args.push('--separate-stems');
    if (selectedTemplate) args.push(`--template-path=${selectedTemplate}`);

    if (separateStems) {
      args.push(`--audio-extension=${audioExtension}`);
      args.push(`--threads=${threads}`);
    }

    const UUID = generateUUID();
    
    // Save switch and inputs preferences
    ipcService.saveStemsValue(separateStems);
    if (separateStems) {
      ipcService.saveThreadExtValue(threads, audioExtension);
    }

    // Trigger run
    ipcService.runPythonScript(args, UUID);

    // Reset progress details and open modal
    resetProgress();
    setProgressProjectName(projectName);
    setProgressUUID(UUID);
    
    // Initialize Download progress display card
    setProgressData((prev) => ({
      ...prev,
      download: { percent: 0, status: 'loading' }
    }));
    setLogs([{ text: 'Loading script...', color: '#747474' }]);
    setShowProgressModal(true);

    // Reset inputs
    setYoutubeUrl('');
    setProjectName('');
  };

  // Save Settings Modal Config
  const handleSaveConfig = () => {
    ipcService.changeConfig({
      project_path: configProjectPath,
      templates_path: configTemplatesPath,
    });
    setShowConfigModal(false);
  };

  // Open History List Modal
  const handleOpenHistoryModal = () => {
    ipcService.getHistory().then((data) => {
      setHistoryList(data || []);
      setShowHistoryModal(true);
    }).catch(() => {
      Swal.fire({
        title: 'Error',
        text: 'Could not load download history.',
        icon: 'error',
        background: '#1e1e1e',
        color: '#ffffff',
        confirmButtonColor: '#d9b063',
      });
    });
  };

  // Open Configuration Modal from UI
  const handleOpenConfigFromUI = () => {
    if (appConfig) {
      setConfigProjectPath(appConfig.project_path || '');
      setConfigTemplatesPath(appConfig.templates_path || '');
      setShowConfigModal(true);
    } else {
      shouldShowModalRef.current = true;
      ipcService.getConfiguration();
    }
  };

  // Clear entire history entries
  const handleClearHistory = () => {
    ipcService.clearHistory().then(() => {
      setHistoryList([]);
    });
  };

  // Delete a specific history entry
  const handleDeleteHistoryEntry = (id: string) => {
    ipcService.deleteHistoryEntry(id).then(() => {
      setHistoryList((prev) => prev.filter((item) => item.id !== id));
    });
  };

  // Open directory inside default file manager
  const handleOpenFolder = (folderPath: string) => {
    ipcService.openPath(folderPath).then((res) => {
      if (!res.success) {
        Swal.fire({
          title: 'Error',
          html: `<p>Could not open folder:<br/>${res.error || 'Path not found'}</p>`,
          icon: 'error',
          background: '#1e1e1e',
          color: '#ffffff',
          confirmButtonColor: '#d9b063',
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative">
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-zinc-800 border-t-primary rounded-full animate-spin"></div>
            <span className="text-zinc-200 text-sm font-medium tracking-wide">Loading, please wait...</span>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="w-[92%] max-w-[1400px] form-container-card backdrop-blur-md rounded-xl p-8 relative">
        
        {/* Social and Info header icons */}
        <div className="absolute left-6 top-6 flex items-center gap-4">
          <a href="https://github.com/spewite/FL-Init" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-primary transition-colors text-xl">
            <i className="fa-brands fa-github"></i>
          </a>
          <a href="https://x.com/iizetaa" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-primary transition-colors text-xl">
            <i className="fa-brands fa-x-twitter"></i>
          </a>
        </div>

        <div className="absolute right-6 top-6 flex items-center gap-3">
          <button 
            type="button" 
            onClick={handleOpenConfigFromUI}
            className="border border-zinc-700 hover:border-primary text-zinc-300 hover:text-primary px-3 py-1 rounded transition-all duration-300 font-semibold text-xs flex items-center gap-1.5"
            title="Settings"
          >
            <i className="fa-solid fa-gear text-[10px]"></i>
            Settings
          </button>
          <button 
            type="button" 
            onClick={handleOpenHistoryModal}
            className="border border-primary/40 text-primary hover:bg-primary hover:text-zinc-950 px-4 py-1 rounded transition-all duration-300 font-semibold text-xs text-shadow"
          >
            History
          </button>
          <span className="text-[11px] font-bold italic text-primary/70 tracking-wide select-none drop-shadow-[0_0_8px_rgba(217,176,99,0.3)]">
            {appVersion}
          </span>
        </div>

        {/* Brand Logo Header */}
        <header className="flex justify-center mb-8 mt-4">
          <img 
            src="../../icons/icon.png" 
            alt="FL Init Logo" 
            className="w-48 logo-shadow select-none pointer-events-none"
            draggable="false"
          />
        </header>

        {/* Input parameters form */}
        <form onSubmit={handleDownloadSubmit} className="flex flex-col gap-5 max-w-2xl mx-auto w-full">
          
          {/* Youtube URL field */}
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="youtube-url" className="text-xs font-semibold text-zinc-400 tracking-wide">
              Youtube URL:
            </label>
            <input 
              type="text" 
              id="youtube-url" 
              value={youtubeUrl}
              onChange={handleYoutubeUrlChange}
              placeholder="Enter the URL of the song"
              className="bg-zinc-900/60 border border-zinc-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
            />
            {youtubeWarning && (
              <p className="text-orange-500 text-xs font-medium animate-pulse mt-0.5">{youtubeWarning}</p>
            )}
          </div>

          {/* Project Location Directory field */}
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="project-location" className="text-xs font-semibold text-zinc-400 tracking-wide">
              Project Location:
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                id="project-location" 
                value={projectLocation}
                onChange={(e) => {
                  setProjectLocation(e.target.value);
                  setLocationError(null);
                }}
                placeholder="Select the project location"
                className="flex-grow bg-zinc-900/60 border border-zinc-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
              />
              <button 
                type="button" 
                onClick={() => ipcService.openDirectoryDialog('project-location')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2.5 rounded-md text-xs font-medium transition-all duration-200 shrink-0"
              >
                Browse
              </button>
            </div>
            {locationError && (
              <p 
                className="text-red-500 text-xs font-medium mt-0.5"
                dangerouslySetInnerHTML={{ __html: locationError }}
              />
            )}
          </div>

          {/* Project Name Folder field */}
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="project-name" className="text-xs font-semibold text-zinc-400 tracking-wide">
              Project Name:
            </label>
            <input 
              type="text" 
              id="project-name" 
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setNameError(null);
              }}
              placeholder="Project Name"
              className="bg-zinc-900/60 border border-zinc-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
            />
            {nameError && (
              <p 
                className="text-red-500 text-xs font-medium mt-0.5"
                dangerouslySetInnerHTML={{ __html: nameError }}
              />
            )}
          </div>

          {/* FLP Project Template file picker */}
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="template-flp" className="text-xs font-semibold text-zinc-400 tracking-wide">
              FLP Template:
            </label>
            <div className="flex gap-2">
              <select 
                id="template-flp" 
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="flex-grow bg-zinc-900/60 border border-zinc-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
              >
                <option value="">(empty template)</option>
                {templatesList.map((path) => (
                  <option key={path} value={path}>
                    {getFileNameFromPath(path)}
                  </option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={() => ipcService.openFileDialog(['flp'])}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2.5 rounded-md text-xs font-medium transition-all duration-200 shrink-0"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Stems separator toggle */}
          <div className="flex items-center gap-3 py-2 border-t border-b border-zinc-900/50 mt-1">
            <button
              type="button"
              id="separate-stems"
              onClick={() => setSeparateStems(!separateStems)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                ${separateStems ? 'bg-zinc-800' : 'bg-zinc-950'}
              `}
            >
              <span
                className={`pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform duration-200 ease-in-out
                  ${separateStems ? 'translate-x-5 bg-primary' : 'translate-x-0.5 bg-zinc-600'}
                `}
              />
            </button>
            <label 
              htmlFor="separate-stems" 
              onClick={() => setSeparateStems(!separateStems)}
              className="text-xs font-semibold text-zinc-300 tracking-wide select-none cursor-pointer"
            >
              Separate stems
            </label>
          </div>

          {/* Collapsible Advanced stems options */}
          {separateStems && (
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-4 flex flex-col gap-3 transition-all duration-300 animate-accordion-down">
              <div 
                className="flex items-center justify-between cursor-pointer py-1"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                <span className="text-xs font-bold text-zinc-400 tracking-wider">ADVANCED OPTIONS</span>
                <i className={`fa-solid fa-chevron-down text-zinc-500 text-xs transition-transform duration-300 ${showAdvancedOptions ? 'rotate-180' : ''}`}></i>
              </div>

              {showAdvancedOptions && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-900">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="audio-extension" className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                      Audio Extension:
                    </label>
                    <select
                      id="audio-extension"
                      value={audioExtension}
                      onChange={(e) => setAudioExtension(e.target.value)}
                      className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="wav">.wav</option>
                      <option value="mp3">.mp3</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="threads" className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                      Threads:
                    </label>
                    <input
                      type="number"
                      id="threads"
                      value={threads}
                      onChange={(e) => setThreads(e.target.value)}
                      min="1"
                      className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submission action */}
          <div className="mt-4">
            <button 
              type="submit"
              className="w-full bg-primary hover:bg-[#e6bb6d] active:scale-[0.99] text-primary-foreground font-bold tracking-wider py-3 px-6 rounded-md text-sm transition-all duration-300 shadow-[0_0_15px_rgba(217,176,99,0.2)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              DOWNLOAD
            </button>
          </div>

        </form>

      </div>

      {/* Configuration Dialog Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-zoomIn">
            <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
              <h2 className="text-md font-bold tracking-wide">Configuration</h2>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Each time you open the application, the following parameters will be taken into account when filling in the fields.
              </p>

              {/* Projects path selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Projects Location</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    id="default-project-path" 
                    value={configProjectPath}
                    onChange={(e) => setConfigProjectPath(e.target.value)}
                    placeholder="Default project location path"
                    className="flex-grow bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button 
                    type="button" 
                    onClick={() => ipcService.openDirectoryDialog('default-project-path')}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-2 rounded text-xs font-medium transition-colors shrink-0"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* Templates folder path selector */}
              <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-4">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">.FLP templates directory</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    id="dialog-default-templates-path" 
                    value={configTemplatesPath}
                    onChange={(e) => setConfigTemplatesPath(e.target.value)}
                    placeholder="Default .flp templates location path"
                    className="flex-grow bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button 
                    type="button" 
                    onClick={() => ipcService.openDirectoryDialog('dialog-default-templates-path')}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-2 rounded text-xs font-medium transition-colors shrink-0"
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-900 px-6 py-4 flex justify-end gap-2 bg-zinc-900/20">
              <button 
                onClick={() => setShowConfigModal(false)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveConfig}
                className="bg-primary hover:bg-[#e6bb6d] text-primary-foreground font-semibold px-4 py-2 rounded text-xs transition-colors shadow-[0_0_10px_rgba(217,176,99,0.15)]"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Dialog Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-zoomIn flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
              <div>
                <h2 className="text-md font-bold tracking-wide">Download History</h2>
                <p className="text-xs text-zinc-500 mt-0.5">List of created projects and completed downloads.</p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
              {historyList.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-xs font-medium">
                  No downloads in history.
                </div>
              ) : (
                <div className="border border-zinc-900 rounded-md overflow-hidden bg-zinc-950">
                  <table className="w-full border-collapse text-left text-xs text-zinc-200">
                    <thead className="bg-zinc-900/60 border-b border-zinc-900 text-primary">
                      <tr>
                        <th className="px-4 py-3 font-semibold tracking-wide">Project</th>
                        <th className="px-4 py-3 font-semibold tracking-wide">Song Name</th>
                        <th className="px-4 py-3 font-semibold tracking-wide">Save Path</th>
                        <th className="px-4 py-3 font-semibold tracking-wide">Date</th>
                        <th className="px-4 py-3 font-semibold tracking-wide">Status</th>
                        <th className="px-4 py-3 font-semibold tracking-wide text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {historyList.map((entry) => {
                        const dateFormatted = new Date(entry.createdAt).toLocaleString(undefined, {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        });

                        return (
                          <tr key={entry.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-white max-w-[150px] truncate">{entry.projectName}</td>
                            <td className="px-4 py-3 max-w-[200px] truncate font-medium" title={entry.videoName || ''}>
                              {entry.videoName ? (
                                <span>{entry.videoName}</span>
                              ) : (
                                <span className="text-zinc-600 italic">
                                  {entry.status === 'running' ? 'Retrieving title...' : 'Not available'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-[200px] truncate text-zinc-400" title={entry.projectLocation}>
                              {entry.projectLocation}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{dateFormatted}</td>
                            <td className="px-4 py-3">
                              {entry.status === 'running' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-sky-950/20 text-sky-400 border-sky-500/20 animate-pulse">Running</span>
                              ) : entry.status === 'success' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-emerald-950/20 text-emerald-400 border-emerald-500/20">Success</span>
                              ) : entry.status === 'cancelled' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-amber-950/20 text-amber-400 border-amber-500/20">Cancelled</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-red-950/20 text-red-400 border-red-500/20">Error</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-2">
                                <button 
                                  onClick={() => handleOpenFolder(entry.projectLocation)}
                                  title="Open Folder"
                                  className="bg-zinc-900 border border-zinc-800 hover:bg-primary hover:border-primary hover:text-zinc-950 w-7 h-7 flex items-center justify-center rounded text-zinc-400 transition-all duration-200"
                                >
                                  <i className="fa-solid fa-folder-open text-xs"></i>
                                </button>
                                <button 
                                  onClick={() => handleDeleteHistoryEntry(entry.id)}
                                  title="Delete"
                                  className="bg-zinc-900 border border-zinc-800 hover:bg-red-500 hover:border-red-500 hover:text-white w-7 h-7 flex items-center justify-center rounded text-zinc-400 transition-all duration-200"
                                >
                                  <i className="fa-solid fa-trash text-[10px]"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-900 px-6 py-4 flex justify-between items-center bg-zinc-900/20">
              <button 
                onClick={handleClearHistory}
                disabled={historyList.length === 0}
                className="bg-red-950/40 text-red-400 border border-red-900 hover:bg-red-500 hover:text-white px-4 py-2 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                Clear History
              </button>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Dialog Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-zoomIn flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
              <h2 className="text-md font-bold tracking-wide">{progressProjectName}</h2>
              <button 
                onClick={() => setShowProgressModal(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-grow custom-scrollbar">
              
              {/* Horizontal cards wrapper */}
              <div className="flex flex-wrap justify-center gap-4 py-2">
                
                {/* Download phase circular gauge */}
                <CircularGauge 
                  percent={progressData.download.percent}
                  label="Download"
                  isActive={progressData.download.status === 'active' || progressData.download.status === 'loading'}
                  isCompleted={progressData.download.status === 'completed'}
                  isLoading={progressData.download.status === 'loading'}
                />

                {/* Stems circular gauges (conditionally visible) */}
                {separateStems && STEM_PHASES.map((p) => (
                  <CircularGauge 
                    key={p}
                    percent={progressData[p].percent}
                    label={p}
                    isActive={progressData[p].status === 'active' || progressData[p].status === 'loading'}
                    isCompleted={progressData[p].status === 'completed'}
                    isLoading={progressData[p].status === 'loading'}
                  />
                ))}

              </div>

              {/* Logs Accordion */}
              <div className="border border-zinc-900 rounded-lg overflow-hidden flex flex-col bg-zinc-950">
                
                <div 
                  className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 cursor-pointer select-none"
                  onClick={() => setLogsAccordionCollapsed(!logsAccordionCollapsed)}
                >
                  <span className="text-xs font-semibold text-zinc-300">Terminal logs</span>
                  
                  <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[10px] font-medium text-zinc-400 select-none">
                      <input 
                        type="checkbox" 
                        checked={autoscroll}
                        onChange={(e) => setAutoscroll(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-900 text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                      <span>Autoscroll</span>
                    </label>
                    <button 
                      onClick={() => setLogsAccordionCollapsed(!logsAccordionCollapsed)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-300 ${logsAccordionCollapsed ? '-rotate-90' : ''}`}></i>
                    </button>
                  </div>
                </div>

                {!logsAccordionCollapsed && (
                  <div 
                    ref={logsContainerRef}
                    className="bg-black/90 p-4 h-60 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1 custom-scrollbar select-text selection:bg-primary/20 selection:text-white"
                  >
                    {logs.map((log, index) => (
                      <p key={index} style={{ color: log.color }} className="whitespace-pre-wrap breakdown-all">
                        {log.text}
                      </p>
                    ))}
                  </div>
                )}

              </div>

            </div>

            <div className="border-t border-zinc-900 px-6 py-4 flex justify-end bg-zinc-900/20">
              <button 
                onClick={() => setShowProgressModal(false)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded text-xs font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Circular Gauge internal component
interface CircularGaugeProps {
  percent: number;
  label: string;
  isActive: boolean;
  isCompleted: boolean;
  isLoading: boolean;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({ percent, label, isActive, isCompleted, isLoading }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  let strokeColor = 'stroke-zinc-800';
  if (isActive) strokeColor = 'stroke-primary';
  else if (isCompleted) strokeColor = 'stroke-emerald-500';

  return (
    <div className={`flex flex-col items-center p-4 rounded-xl border min-w-[115px] transition-all duration-300 relative select-none
      ${isActive ? 'border-primary/50 bg-zinc-900/50 shadow-[0_0_15px_rgba(217,176,99,0.06)] opacity-100' : ''}
      ${isCompleted ? 'border-emerald-500/20 bg-emerald-950/5 opacity-90' : ''}
      ${!isActive && !isCompleted ? 'border-zinc-900 bg-zinc-950/20 opacity-40' : ''}
    `}>
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle className="stroke-zinc-900/80 fill-none stroke-[8]" cx="50" cy="50" r="45" />
          <circle
            className={`fill-none stroke-[8] stroke-linecap-round transition-all duration-500 ${strokeColor}`}
            cx="50"
            cy="50"
            r="45"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          {isLoading && !percent ? (
            <div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
          ) : (
            <span className="text-xs font-bold text-white">{Math.round(percent)}%</span>
          )}
          <span className="text-[9px] font-bold text-zinc-500 capitalize tracking-wider mt-0.5 select-none">{label}</span>
        </div>
      </div>
    </div>
  );
};
