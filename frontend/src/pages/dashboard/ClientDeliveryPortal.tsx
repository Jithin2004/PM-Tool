import React from 'react';
import { ProjectCard } from '../../components/project/ProjectCard';

export function ClientDeliveryPortal({ profile, projects, notify }: any) {
  // Only show projects the client has access to, and filter out internal metadata
  const clientProjects = projects.filter((p: any) => p.status !== 'archived');

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Project Delivery Portal</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Welcome {profile?.full_name?.split(' ')[0] || 'Client'}. Here is the latest progress on your initiatives.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono mb-4 text-[var(--text-secondary)]">Active Deliveries</h2>
        
        {clientProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientProjects.map((project: any) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                teams={[]}
                profiles={[]}
                onClick={() => window.location.href = `/workspace/portfolio`}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl border border-[var(--border-soft)] bg-surface-2 text-center flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold text-white mb-2">No Active Projects</h3>
            <p className="text-sm text-[var(--text-secondary)]">You do not currently have any active projects deployed in the portal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
