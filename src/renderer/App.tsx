import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { ipcService } from './services/ipc-service';
import { validateYoutubeURL, generateUUID } from './utils/helpers';
import { OUTPUT_STATES } from '../shared/constants';
import type { AppConfig, PythonOutputMessage, HistoryEntry, Phase, ProgressPhaseState } from '../shared/types';

// Import extracted modular components
import { LoadingOverlay } from './components/LoadingOverlay';
import { Header } from './components/Header';
import { ProjectForm } from './components/ProjectForm';
import { ConfigModal } from './components/ConfigModal';
import { HistoryModal } from './components/HistoryModal';
import { ProgressModal } from './components/ProgressModal';

const STEM_PHASES: Phase[] = ['vocals', 'bass', 'drums', 'others'];

export default function App() {
  // App version
  const [appVersion, setAppVersion] = useState<string>('');

  // General Loading overlay
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form State
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
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
  const [processStatus, setProcessStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  // Compute reactive progress label for the header button
  const progressLabel = useMemo(() => {
    if (processStatus === 'idle') return 'Progress';
    if (processStatus === 'success') return 'Completed';
    if (processStatus === 'error') return 'Failed';

    const phases: Phase[] = separateStems
      ? ['download', 'vocals', 'bass', 'drums', 'others']
      : ['download'];
    const activePhase = phases.find(p => progressData[p].status === 'active' || progressData[p].status === 'loading');
    if (activePhase) {
      const pct = Math.round(progressData[activePhase].percent);
      const label = activePhase === 'download' ? 'Download' : activePhase.charAt(0).toUpperCase() + activePhase.slice(1);
      return `${label}: ${pct}%`;
    }
    const allCompleted = phases.every(p => progressData[p].status === 'completed');
    if (allCompleted) return 'Completed';
    return 'Processing...';
  }, [processStatus, progressData, separateStems]);

  // Refs for callbacks to access latest states without triggering re-registration
  const separateStemsRef = useRef<boolean>(separateStems);
  const currentPhaseRef = useRef<Phase>('download');
  const currentStemIndexRef = useRef<number>(0);
  const lastStemPercentRef = useRef<number>(-1);

  useEffect(() => {
    separateStemsRef.current = separateStems;
  }, [separateStems]);

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
    if (!projectLocation) return;
    const timer = setTimeout(() => {
      ipcService.validateDirectory(projectLocation);
    }, 300);
    return () => clearTimeout(timer);
  }, [projectLocation]);

  useEffect(() => {
    if (!projectLocation || !projectName) return;
    const timer = setTimeout(() => {
      ipcService.validateProjectName(projectLocation, projectName);
    }, 300);
    return () => clearTimeout(timer);
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
    if (status === OUTPUT_STATES.ERROR) {
      color = '#ff4d4d';
    } else if (status === OUTPUT_STATES.SUCCESS || text.includes('successfully') || text.includes('complete') || text.includes('Done')) {
      color = '#22c55e'; // Green
    } else if (status === OUTPUT_STATES.INFO) {
      color = '#14bef3'; // Cyan
    }

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

    if (text.includes('Script completed successfully')) {
      setProcessStatus('success');
    } else if (text.includes('Script terminated') || text.includes('Error executing script:')) {
      setProcessStatus('error');
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
    setProcessStatus('running');
    
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
      
      <LoadingOverlay isLoading={isLoading} />

      {/* Main Container Card */}
      <div className="w-[92%] max-w-350 form-container-card backdrop-blur-md rounded-xl p-8 relative">
        
        <Header 
          appVersion={appVersion}
          onOpenSettings={handleOpenConfigFromUI}
          onOpenHistory={handleOpenHistoryModal}
          processStatus={processStatus}
          progressLabel={progressLabel}
          onOpenProgress={() => setShowProgressModal(true)}
        />

        <ProjectForm
          youtubeUrl={youtubeUrl}
          setYoutubeUrl={setYoutubeUrl}
          youtubeWarning={youtubeWarning}
          handleYoutubeUrlChange={handleYoutubeUrlChange}
          projectLocation={projectLocation}
          setProjectLocation={setProjectLocation}
          locationError={locationError}
          setLocationError={setLocationError}
          onBrowseLocation={() => ipcService.openDirectoryDialog('project-location')}
          projectName={projectName}
          setProjectName={setProjectName}
          nameError={nameError}
          setNameError={setNameError}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          templatesList={templatesList}
          onBrowseTemplate={() => ipcService.openFileDialog(['flp'])}
          separateStems={separateStems}
          setSeparateStems={setSeparateStems}
          showAdvancedOptions={showAdvancedOptions}
          setShowAdvancedOptions={setShowAdvancedOptions}
          audioExtension={audioExtension}
          setAudioExtension={setAudioExtension}
          threads={threads}
          setThreads={setThreads}
          onSubmit={handleDownloadSubmit}
        />

      </div>

      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        configProjectPath={configProjectPath}
        setConfigProjectPath={setConfigProjectPath}
        configTemplatesPath={configTemplatesPath}
        setConfigTemplatesPath={setConfigTemplatesPath}
        onBrowse={(inputId) => ipcService.openDirectoryDialog(inputId)}
        onSave={handleSaveConfig}
      />

      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyList={historyList}
        onOpenFolder={handleOpenFolder}
        onDeleteEntry={handleDeleteHistoryEntry}
        onClearHistory={handleClearHistory}
      />

      <ProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progressProjectName={progressProjectName}
        progressData={progressData}
        separateStems={separateStems}
        logs={logs}
      />

    </div>
  );
}
