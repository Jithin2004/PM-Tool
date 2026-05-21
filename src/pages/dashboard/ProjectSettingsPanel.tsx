import React from 'react';

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function ProjectSettingsPanel({ projectId, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/15 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-mono text-white/80">Project Settings</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-[10px] font-mono">Close</button>
        </div>
        <div className="border border-white/10 bg-white/[0.02] p-8 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Integrations</span>
          <span className="text-[8px] font-mono text-white/20 mt-2">GitHub, GitLab, Figma, Google Drive — coming soon</span>
        </div>
      </div>
    </div>
  );
}
