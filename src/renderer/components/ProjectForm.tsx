import React from 'react';
import { getFileNameFromPath } from '../utils/helpers';

interface ProjectFormProps {
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  youtubeWarning: string | null;
  handleYoutubeUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  projectLocation: string;
  setProjectLocation: (loc: string) => void;
  locationError: string | null;
  setLocationError: (err: string | null) => void;
  onBrowseLocation: () => void;
  
  projectName: string;
  setProjectName: (name: string) => void;
  nameError: string | null;
  setNameError: (err: string | null) => void;
  
  selectedTemplate: string;
  setSelectedTemplate: (tpl: string) => void;
  templatesList: string[];
  onBrowseTemplate: () => void;
  
  separateStems: boolean;
  setSeparateStems: (sep: boolean) => void;
  
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (show: boolean) => void;
  audioExtension: string;
  setAudioExtension: (ext: string) => void;
  threads: string;
  setThreads: (threads: string) => void;
  
  onSubmit: (e: React.FormEvent) => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  youtubeUrl,
  youtubeWarning,
  handleYoutubeUrlChange,
  
  projectLocation,
  setProjectLocation,
  locationError,
  setLocationError,
  onBrowseLocation,
  
  projectName,
  setProjectName,
  nameError,
  setNameError,
  
  selectedTemplate,
  setSelectedTemplate,
  templatesList,
  onBrowseTemplate,
  
  separateStems,
  setSeparateStems,
  
  showAdvancedOptions,
  setShowAdvancedOptions,
  audioExtension,
  setAudioExtension,
  threads,
  setThreads,
  
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 max-w-2xl mx-auto w-full">
      
      {/* Song URL field (Youtube / SoundCloud) */}
      <div className="flex flex-col gap-1.5 w-full">
        <label htmlFor="youtube-url" className="text-xs font-semibold text-zinc-400 tracking-wide">
          Song URL <span className="text-zinc-500 font-normal">(Youtube / SoundCloud)</span>:
        </label>
        <input
          type="text"
          id="youtube-url"
          value={youtubeUrl}
          onChange={handleYoutubeUrlChange}
          placeholder="Enter a Youtube or SoundCloud URL"
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
            className="grow bg-zinc-900/60 border border-zinc-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
          />
          <button 
            type="button" 
            onClick={onBrowseLocation}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2.5 rounded-md text-xs font-medium transition-all duration-200 shrink-0"
          >
            Browse
          </button>
        </div>
        {locationError && (
          <p className="text-red-500 text-xs font-medium mt-0.5">
            ❌ The base route <span className="font-bold italic">{locationError}</span> does not exist!
          </p>
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
          <p className="text-red-500 text-xs font-medium mt-0.5">
            ❌ The directory <span className="font-bold italic">{nameError}</span> already exists!
          </p>
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
            className="grow bg-zinc-900/60 border border-zinc-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
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
            onClick={onBrowseTemplate}
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
  );
};
