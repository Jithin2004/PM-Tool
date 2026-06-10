export const demoWorkspacesService = {
  async injectDemoData(workspaceId: string, actorId: string, type: string) {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    if (!isSupabaseConfigured) return;

    try {
      // Create Project
      const { data: proj } = await supabase.from('projects').insert({
        workspace_id: workspaceId,
        name: type,
        status: 'active',
        execution_mode: 'HYBRID'
      }).select().single();

      if (!proj) return;

      // Create Milestones
      const { data: ms1 } = await supabase.from('milestones').insert({
        workspace_id: workspaceId,
        project_id: proj.id,
        name: 'Phase 1: Discovery',
        status: 'in_progress',
        start_date: new Date().toISOString(),
        deadline: new Date(Date.now() + 14 * 86400000).toISOString()
      }).select().single();

      // Create Tasks
      if (ms1) {
        await supabase.from('tasks').insert([
          { workspace_id: workspaceId, project_id: proj.id, milestone_id: ms1.id, name: 'Architecture Review', status: 'done', priority: 'high', estimated_hours: 20, actual_hours: 20 },
          { workspace_id: workspaceId, project_id: proj.id, milestone_id: ms1.id, name: 'Security Audit', status: 'in_progress', priority: 'critical', estimated_hours: 40, actual_hours: 15 },
          { workspace_id: workspaceId, project_id: proj.id, milestone_id: ms1.id, name: 'Vendor Integration', status: 'todo', priority: 'medium', estimated_hours: 60, actual_hours: 0 },
          { workspace_id: workspaceId, project_id: proj.id, milestone_id: ms1.id, name: 'Data Migration Pipeline', status: 'todo', priority: 'high', estimated_hours: 120, actual_hours: 0 }
        ]);
      }

      // Record wait states, approvals
      await supabase.from('wait_states').insert({
        workspace_id: workspaceId,
        target_id: proj.id,
        target_type: 'project',
        reason: 'Awaiting Vendor API Keys from Acme Corp',
        category: 'vendor',
        waiting_on: 'vendor',
        status: 'active'
      });

    } catch (err) {
      console.error('Failed to inject demo data', err);
    }
  },

  async removeDemoData(workspaceId: string) {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    if (!isSupabaseConfigured) return;

    try {
      // Due to RLS and cascading deletes, we just need to delete projects 
      // where name is the demo type, or simply delete all projects in the workspace 
      // if it's considered purely a demo. For safety, let's just delete the ones named after demo types.
      const types = ['SaaS Migration Demo', 'Compliance Audit Demo', 'Engineering Delivery Demo', 'Onboarding Demo'];
      
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId)
        .in('name', types);

      if (projects && projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        await supabase.from('projects').delete().in('id', projectIds);
      }
      
      // Also clean up wait states
      await supabase.from('wait_states').delete().eq('workspace_id', workspaceId).eq('reason', 'Awaiting Vendor API Keys');

    } catch (err) {
      console.error('Failed to remove demo data', err);
    }
  }
};
