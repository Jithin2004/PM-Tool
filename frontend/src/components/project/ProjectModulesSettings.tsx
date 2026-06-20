import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { moduleService } from '../../../services/moduleService';
import { ProjectModule } from '../../../core/types/project';
import { Layers, Plus, Save } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export const ProjectModulesSettings: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleCode, setNewModuleCode] = useState('');
  
  // Hardcoded workspace for this view
  const workspaceId = user?.app_metadata?.workspace_id || '';

  useEffect(() => {
    if (projectId) loadModules();
  }, [projectId]);

  const loadModules = async () => {
    setLoading(true);
    const result = await moduleService.getProjectModules(projectId!);
    setModules(result);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newModuleName || !newModuleCode) return;
    
    const created = await moduleService.createModule(
      workspaceId,
      projectId!,
      newModuleName,
      newModuleCode,
      '',
      user?.id
    );
    
    if (created) {
      setModules([...modules, created]);
      setIsCreating(false);
      setNewModuleName('');
      setNewModuleCode('');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-slate-200 flex items-center gap-2">
            <Layers className="text-indigo-400" size={20} /> Project Modules
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Define architectural or functional boundaries (e.g. Frontend, Backend).
          </p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition flex items-center gap-2"
        >
          <Plus size={16} /> Add Module
        </button>
      </div>

      <div className="space-y-3">
        {modules.map(mod => (
          <div key={mod.id} className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-mono rounded">
                {mod.code}
              </div>
              <span className="text-sm text-slate-300 font-medium">{mod.name}</span>
            </div>
          </div>
        ))}
        {modules.length === 0 && !isCreating && !loading && (
          <div className="text-center p-6 text-sm text-slate-500 italic">
            No modules defined for this project.
          </div>
        )}
      </div>

      {isCreating && (
        <div className="mt-4 p-4 bg-slate-800/30 border border-indigo-500/30 rounded-lg space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Module Name</label>
              <input 
                type="text" 
                placeholder="e.g. Frontend"
                value={newModuleName}
                onChange={e => setNewModuleName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-slate-400 mb-1">Code</label>
              <input 
                type="text" 
                placeholder="e.g. FE"
                value={newModuleCode}
                onChange={e => setNewModuleCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              disabled={!newModuleName || !newModuleCode}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded flex items-center gap-1.5"
            >
              <Save size={14} /> Save Module
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
