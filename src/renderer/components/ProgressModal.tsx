import React, { useState, useEffect, useRef } from 'react';
import { Phase, ProgressPhaseState } from '../../shared/types';

const STEM_PHASES: Phase[] = ['vocals', 'bass', 'drums', 'others'];

interface ProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progressProjectName: string;
  progressData: Record<Phase, ProgressPhaseState>;
  separateStems: boolean;
  logs: { text: string; color: string }[];
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  onClose,
  progressProjectName,
  progressData,
  separateStems,
  logs,
}) => {
  const [autoscroll, setAutoscroll] = useState<boolean>(true);
  const [logsAccordionCollapsed, setLogsAccordionCollapsed] = useState<boolean>(false);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoscroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [autoscroll, logs, logsAccordionCollapsed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-zoomIn flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
          <h2 className="text-md font-bold tracking-wide text-white">{progressProjectName}</h2>
          <button 
            onClick={onClose}
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
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

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
  else if (isCompleted) strokeColor = 'stroke-green-500';

  return (
    <div className={`flex flex-col items-center p-4 rounded-xl border min-w-[115px] transition-all duration-300 relative select-none
      ${isActive ? 'border-primary/50 bg-zinc-900/50 shadow-[0_0_15px_rgba(217,176,99,0.06)] opacity-100' : ''}
      ${isCompleted ? 'border-green-500/20 bg-green-950/5 opacity-90' : ''}
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
