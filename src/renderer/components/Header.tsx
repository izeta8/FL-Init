import React from 'react';

interface HeaderProps {
  appVersion: string;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  processStatus: 'idle' | 'running' | 'success' | 'error';
  progressLabel: string;
  onOpenProgress: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  appVersion,
  onOpenSettings,
  onOpenHistory,
  processStatus,
  progressLabel,
  onOpenProgress,
}) => {
  return (
    <>
      {/* Social and Info header icons */}
      <div className="absolute left-6 top-6 flex items-center gap-4">
        <a 
          href="https://github.com/spewite/FL-Init" 
          target="_blank" 
          rel="noreferrer" 
          className="text-zinc-400 hover:text-primary transition-colors text-xl"
        >
          <i className="fa-brands fa-github"></i>
        </a>
        <a 
          href="https://x.com/iizetaa" 
          target="_blank" 
          rel="noreferrer" 
          className="text-zinc-400 hover:text-primary transition-colors text-xl"
        >
          <i className="fa-brands fa-x-twitter"></i>
        </a>
      </div>

      <div className="absolute right-6 top-6 flex items-center gap-3">
        {processStatus !== 'idle' && (
          <button 
            type="button" 
            onClick={onOpenProgress}
            className={`px-3 py-1 rounded transition-all duration-300 font-semibold text-xs flex items-center gap-1.5 border
              ${processStatus === 'running' 
                ? 'border-green-500/40 text-green-400 bg-green-950/10 hover:bg-green-500 hover:text-zinc-950 shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-pulse' 
                : processStatus === 'success'
                ? 'border-green-500/60 text-green-400 bg-green-950/20 hover:bg-green-500 hover:text-zinc-950 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                : 'border-red-500/60 text-red-400 bg-red-950/20 hover:bg-red-500 hover:text-zinc-950 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
              }
            `}
            title="Open process details and logs"
          >
            {processStatus === 'running' ? (
              <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
            ) : processStatus === 'success' ? (
              <i className="fa-solid fa-circle-check text-[10px]"></i>
            ) : (
              <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
            )}
            {progressLabel}
          </button>
        )}
        <button 
          type="button" 
          onClick={onOpenSettings}
          className="border border-zinc-700 hover:border-primary text-zinc-300 hover:text-primary px-3 py-1 rounded transition-all duration-300 font-semibold text-xs flex items-center gap-1.5"
          title="Settings"
        >
          <i className="fa-solid fa-gear text-[10px]"></i>
          Settings
        </button>
        <button 
          type="button" 
          onClick={onOpenHistory}
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
    </>
  );
};
