import React from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 bg-zinc-950/80 border border-zinc-800 p-8 rounded-lg shadow-2xl">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-zinc-300 tracking-wider uppercase animate-pulse">Loading...</p>
      </div>
    </div>
  );
};
