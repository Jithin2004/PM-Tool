import { supabase } from '../../lib/supabase';
import { financeLedgerService } from '../../services/financeLedgerService';

export const sandboxSeedEngine = {
  async seedSandboxEnvironment(workspaceId: string, actorId: string, templateType: string) {
    // Logging removed for production
    
    // 1. Mark as Sandbox
    await supabase.from('workspaces').update({ 
      status: 'sandbox',
      business_type: templateType,
      metadata: { environment: 'sandbox', created_by: 'seed_engine' }
    }).eq('id', workspaceId);

    // 2. Generate Mock Personas
    const personas = [
      { email: 'pm@sandbox.local', role: 'pm', name: 'Sarah Jenkins', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' },
      { email: 'dev@sandbox.local', role: 'developer', name: 'Alex Rivera', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex' },
      { email: 'hr@sandbox.local', role: 'hr', name: 'Maria Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria' },
      { email: 'finance@sandbox.local', role: 'finance', name: 'David Okafor', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David' },
      { email: 'client@sandbox.local', role: 'client', name: 'Acme Corp', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Acme' },
    ];

    const personaIds: Record<string, string> = {};

    for (const p of personas) {
      // Create user auth identity equivalent
      const { data: user } = await supabase.from('users').insert({
        email: p.email,
        full_name: p.name,
        avatar_url: p.avatar,
        role: p.role,
        workspace_id: workspaceId
      }).select('id').single();
      
      if (user) {
        personaIds[p.role] = user.id;
      }
    }

    const pmId = personaIds['pm'] || actorId;
    const devId = personaIds['developer'] || actorId;
    const hrId = personaIds['hr'] || actorId;
    const finId = personaIds['finance'] || actorId;

    // 3. Setup Finance Accounts & Ledger
    // Sandbox uses new double-entry engine
    await financeLedgerService.createInvoice({
      workspaceId, userId: finId, invoiceId: 'inv-sandbox-1', subtotal: 50000, taxAmount: 9000, description: 'Client Retainer - Q3'
    });
    await financeLedgerService.recordPayment({
      workspaceId, userId: finId, paymentId: 'pay-sandbox-1', invoiceId: 'inv-sandbox-1', amount: 59000, description: 'Payment for Retainer'
    });
    await financeLedgerService.recordExpense({
      workspaceId, userId: finId, expenseId: 'exp-sandbox-1', amount: 4500, description: 'AWS Infrastructure', expenseCategory: 'Software'
    });
    await financeLedgerService.recordExpense({
      workspaceId, userId: finId, expenseId: 'exp-sandbox-2', amount: 12500, description: 'Payroll - Software Engineering', expenseCategory: 'Salary'
    });

    // 4. Setup HR (Leave Balances & Policies)
    const { data: policy } = await supabase.from('attendance_policies').insert({
      workspace_id: workspaceId,
      name: 'Standard Enterprise Policy',
      working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      daily_hours: 8
    }).select().single();

    await supabase.from('leave_balances').insert([
      { workspace_id: workspaceId, user_id: devId, leave_type: 'vacation', total_allowance: 20, used_days: 5, year: new Date().getFullYear() },
      { workspace_id: workspaceId, user_id: hrId, leave_type: 'sick', total_allowance: 10, used_days: 2, year: new Date().getFullYear() }
    ]);

    // 5. Execution (Projects, Epics, Sprints, Timeline)
    const { data: proj } = await supabase.from('projects').insert({
      workspace_id: workspaceId,
      name: 'Project Phoenix (Sandbox)',
      status: 'active',
      owner_id: pmId,
      execution_mode: 'HYBRID'
    }).select().single();

    if (proj) {
      // Epic
      const { data: epic } = await supabase.from('epics').insert({
        workspace_id: workspaceId,
        project_id: proj.id,
        name: 'V2 Platform Migration',
        status: 'in_progress',
        owner_id: pmId,
        target_start: new Date(Date.now() - 7 * 86400000).toISOString(),
        target_end: new Date(Date.now() + 30 * 86400000).toISOString()
      }).select().single();

      // Sprint
      const { data: sprint } = await supabase.from('sprints').insert({
        workspace_id: workspaceId,
        project_id: proj.id,
        name: 'Sprint 24',
        status: 'active',
        start_date: new Date(Date.now() - 3 * 86400000).toISOString(),
        end_date: new Date(Date.now() + 11 * 86400000).toISOString(),
        capacity_hours: 120
      }).select().single();

      // Stories & Tasks
      if (epic && sprint) {
        const { data: story1 } = await supabase.from('stories').insert({
          workspace_id: workspaceId,
          epic_id: epic.id,
          project_id: proj.id,
          sprint_id: sprint.id,
          title: 'Setup Database Replication',
          status: 'in_progress',
          points: 5,
          assignee_id: devId
        }).select().single();

        if (story1) {
          await supabase.from('tasks').insert([
            { workspace_id: workspaceId, project_id: proj.id, story_id: story1.id, name: 'Configure logical replication slots', status: 'done', priority: 'high', assignee_id: devId },
            { workspace_id: workspaceId, project_id: proj.id, story_id: story1.id, name: 'Migrate active dataset', status: 'in_progress', priority: 'critical', assignee_id: devId }
          ]);

          // Collaboration (Comments)
          await supabase.from('comments').insert({
            workspace_id: workspaceId,
            entity_id: story1.id,
            entity_type: 'story',
            content: 'We need to make sure the SSL certificates are rotated before we trigger the cutover.',
            author_id: devId
          });
        }
      }

      // Timeline Baseline
      await supabase.from('timeline_baselines').insert({
        workspace_id: workspaceId,
        project_id: proj.id,
        name: 'Initial Project Approval',
        snapshot_data: { "tasks": 45, "critical_path": true, "variance": "0%" }
      });
    }

    // 6. Integrations (Mock)
    await supabase.from('integration_connections').insert([
      { workspace_id: workspaceId, provider: 'github', status: 'connected', created_by: actorId, config: { "sandbox": true } },
      { workspace_id: workspaceId, provider: 'slack', status: 'connected', created_by: actorId, config: { "sandbox": true } }
    ]);

    // 7. Activity History (To make dashboards look alive)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
    await supabase.from('activity_events').insert([
      { workspace_id: workspaceId, actor_id: devId, entity_type: 'task', action_type: 'status_changed', metadata: { from: 'todo', to: 'in_progress' }, created_at: thirtyMinsAgo },
      { workspace_id: workspaceId, actor_id: hrId, entity_type: 'leave', action_type: 'approved', metadata: {}, created_at: thirtyMinsAgo },
      { workspace_id: workspaceId, actor_id: finId, entity_type: 'invoice', action_type: 'paid', metadata: { amount: 15000 }, created_at: thirtyMinsAgo }
    ]);

    // Logging removed for production
  }
};

