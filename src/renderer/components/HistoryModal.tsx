import React from 'react';
import { HistoryEntry } from '../../shared/types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyList: HistoryEntry[];
  onOpenFolder: (path: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  historyList,
  onOpenFolder,
  onDeleteEntry,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-zoomIn flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
          <div>
            <h2 className="text-md font-bold tracking-wide text-white">Download History</h2>
            <p className="text-xs text-zinc-500 mt-0.5">List of created projects and completed downloads.</p>
          </div>
          <button 
            onClick={onClose}
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
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-green-950/20 text-green-400 border-green-500/20">Success</span>
                          ) : entry.status === 'cancelled' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-amber-950/20 text-amber-400 border-amber-500/20">Cancelled</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-red-950/20 text-red-400 border-red-500/20">Error</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button 
                              onClick={() => onOpenFolder(entry.projectLocation)}
                              title="Open Folder"
                              className="bg-zinc-900 border border-zinc-800 hover:bg-primary hover:border-primary hover:text-zinc-950 w-7 h-7 flex items-center justify-center rounded text-zinc-400 transition-all duration-200"
                            >
                              <i className="fa-solid fa-folder-open text-xs"></i>
                            </button>
                            <button 
                              onClick={() => onDeleteEntry(entry.id)}
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
            onClick={onClearHistory}
            disabled={historyList.length === 0}
            className="bg-red-950/40 text-red-400 border border-red-900 hover:bg-red-500 hover:text-white px-4 py-2 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            Clear History
          </button>
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
