import React from 'react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  configProjectPath: string;
  setConfigProjectPath: (path: string) => void;
  configTemplatesPath: string;
  setConfigTemplatesPath: (path: string) => void;
  onBrowse: (inputId: string) => void;
  onSave: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  configProjectPath,
  setConfigProjectPath,
  configTemplatesPath,
  setConfigTemplatesPath,
  onBrowse,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-9999 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-zoomIn">
        <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
          <h2 className="text-md font-bold tracking-wide text-white">Configuration</h2>
          <button 
            onClick={onClose}
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
                className="grow bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button 
                type="button" 
                onClick={() => onBrowse('default-project-path')}
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
                className="grow bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button 
                type="button" 
                onClick={() => onBrowse('dialog-default-templates-path')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-2 rounded text-xs font-medium transition-colors shrink-0"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-900 px-6 py-4 flex justify-end gap-2 bg-zinc-900/20">
          <button 
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onSave}
            className="bg-primary hover:bg-[#e6bb6d] text-primary-foreground font-semibold px-4 py-2 rounded text-xs transition-colors shadow-[0_0_10px_rgba(217,176,99,0.15)]"
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
};
