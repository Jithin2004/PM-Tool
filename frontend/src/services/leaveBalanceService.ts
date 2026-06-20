import { supabase } from '../lib/supabase';
import { activityEventService } from './activityEventService';

export const leaveBalanceService = {
  async getBalance(workspaceId: string, userId: string, leaveType: string) {
    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('leave_type', leaveType)
      .single();
    
    return data;
  },

  async requestLeave(workspaceId: string, userId: string, leaveType: string, startDate: Date, endDate: Date, reason: string) {
    // 1. Create personal_leave row (pending)
    const { data: leaveRow, error } = await supabase
      .from('personal_leave')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        reason: reason,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Create Universal Approval
    await supabase.from('universal_approvals').insert({
      workspace_id: workspaceId,
      entity_type: 'personal_leave',
      entity_id: leaveRow.id,
      type: 'leave_request',
      status: 'pending',
      requested_by: userId,
      metadata: { leaveType, startDate, endDate, reason }
    });

    try {
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: userId,
        entity_type: 'personal_leave',
        entity_id: leaveRow.id,
        action: 'leave_requested',
        metadata: { leaveType, startDate, endDate, reason }
      });
    } catch (e) {
      console.error('Failed to log leave request event', e);
    }

    return leaveRow;
  },

  async consumeLeave(workspaceId: string, userId: string, leaveType: string, days: number) {
    // Requires RPC or select-then-update logic. Simplified update here.
    const balance = await this.getBalance(workspaceId, userId, leaveType);
    if (!balance) throw new Error("Balance record not found");

    if (balance.remaining < days) throw new Error("Insufficient leave balance");

    await supabase
      .from('leave_balances')
      .update({
        used: balance.used + days,
        remaining: balance.remaining - days
      })
      .eq('id', balance.id);

    try {
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: userId,
        entity_type: 'leave_balances',
        entity_id: balance.id,
        action: 'leave_balance_changed',
        metadata: { type: 'consume', leaveType, days_used: days }
      });
    } catch (e) {
      console.error('Failed to log leave consume event', e);
    }
  },

  async restoreLeave(workspaceId: string, userId: string, leaveType: string, days: number) {
    const balance = await this.getBalance(workspaceId, userId, leaveType);
    if (!balance) return;

    await supabase
      .from('leave_balances')
      .update({
        used: balance.used - days,
        remaining: balance.remaining + days
      })
      .eq('id', balance.id);

    try {
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: userId,
        entity_type: 'leave_balances',
        entity_id: balance.id,
        action: 'leave_balance_changed',
        metadata: { type: 'restore', leaveType, days_restored: days }
      });
    } catch (e) {
      console.error('Failed to log leave restore event', e);
    }
  }
};
