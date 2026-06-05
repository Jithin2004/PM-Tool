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
          { workspace_id: workspaceId, project_id: proj.id, milestone_id: ms1.id, name: 'Requirements Gathering', status: 'in_progress', priority: 'high', estimated_hours: 40 },
          { workspace_id: workspaceId, project_id: proj.id, milestone_id: ms1.id, name: 'Architecture Review', status: 'todo', priority: 'medium', estimated_hours: 20 },
        ]);
      }

      // Record some wait states, approvals
      await supabase.from('wait_states').insert({
        workspace_id: workspaceId,
        target_id: proj.id,
        target_type: 'project',
        reason: 'Awaiting Vendor API Keys',
        category: 'client_dependency',
        status: 'active',
        actor_id: actorId
      });

    } catch (err) {
    }
  }
};
