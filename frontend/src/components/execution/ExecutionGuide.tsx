import React, { useState } from 'react';
import { X, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

export const ExecutionGuide: React.FC = () => {
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem('resolve_pm_hide_execution_guide') !== 'true';
  });
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isVisible) return null;

  const hidePermanently = () => {
    localStorage.setItem('resolve_pm_hide_execution_guide', 'true');
    setIsVisible(false);
  };

  return (
    <div className="mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <BookOpen size={18} />
          </div>
          <h3 className="font-medium text-slate-200">Execution Hierarchy Guide</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); hidePermanently(); }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
            title="Hide permanently"
          >
            <X size={16} />
          </button>
          <div className="text-slate-400">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-slate-700/50 mt-2">
          <p className="text-sm text-slate-400 mb-4 px-2">
            Resolve PM organizes work into a clear, traceable hierarchy to ensure delivery alignment.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 px-2">
            <div className="flex-1 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <div className="font-medium text-indigo-400 mb-1">Epic</div>
              <div className="text-xs text-slate-500 mb-3">Large capability or goal</div>
              <p className="text-sm text-slate-300">
                Epics represent major features or business objectives (e.g., "Authentication System"). They lock a unique UID prefix for all child work.
              </p>
            </div>
            
            <div className="flex items-center justify-center text-slate-600 hidden md:flex">
              <ChevronRight size={24} />
            </div>
            
            <div className="flex-1 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <div className="font-medium text-emerald-400 mb-1">Story</div>
              <div className="text-xs text-slate-500 mb-3">User or business need</div>
              <p className="text-sm text-slate-300">
                Stories capture specific user value (e.g., "As a user I can reset my password"). They group related execution tasks together.
              </p>
            </div>
            
            <div className="flex items-center justify-center text-slate-600 hidden md:flex">
              <ChevronRight size={24} />
            </div>

            <div className="flex-1 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <div className="font-medium text-blue-400 mb-1">Task</div>
              <div className="text-xs text-slate-500 mb-3">Execution item</div>
              <p className="text-sm text-slate-300">
                Tasks are the actual units of work (e.g., "Create reset API"). These flow across the Kanban board and consume capacity.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
