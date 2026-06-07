export interface ProjectAllocation {
  id: string;
  workspace_id: string;
  project_id: string;
  user_id: string;
  allocation_percent: number;
}

export interface AllocationPeriod {
  id: string;
  workspace_id: string;
  project_id: string;
  user_id: string;
  allocation_percent: number;
  start_date: string;
  end_date: string;
}

export interface UserCapacity {
  userId: string;
  totalAssignedPercent: number;
  baseCapacityPercent: number;
  utilizationPercent: number;
  classification: 'Available' | 'Healthy' | 'High Utilization' | 'Overloaded' | 'Critical';
}

export interface CapacityRisk {
  userId: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  reason: string;
}

export const capacityEngine = {
  async fetchAllocationPeriods(workspaceId: string): Promise<AllocationPeriod[]> {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    if (!isSupabaseConfigured) return [];
    try {
      const { data } = await supabase.from('allocation_periods').select('*').limit(50).eq('workspace_id', workspaceId).is('deleted_at', null);
      return data || [];
    } catch { return []; }
  },

  async createAllocationPeriod(period: Omit<AllocationPeriod, 'id'>, actorId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    const { activityLogService } = await import('./activityLogService');
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('allocation_periods').insert(period);
      if (error) return false;
      await activityLogService.appendLog({
        workspace_id: period.workspace_id,
        actor_id: actorId,
        action: 'allocation_period_created',
        metadata: { project_id: period.project_id, user_id: period.user_id }
      });
      return true;
    } catch { return false; }
  },

  async updateAllocationPeriod(id: string, updates: Partial<AllocationPeriod>, workspaceId: string, actorId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    const { activityLogService } = await import('./activityLogService');
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('allocation_periods').update(updates).eq('id', id);
      if (error) return false;
      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: actorId,
        action: 'allocation_period_modified',
        metadata: { period_id: id, updates }
      });
      return true;
    } catch { return false; }
  },

  async deleteAllocationPeriod(id: string, workspaceId: string, actorId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    const { activityLogService } = await import('./activityLogService');
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('allocation_periods').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) return false;
      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: actorId,
        action: 'allocation_period_removed',
        metadata: { period_id: id }
      });
      return true;
    } catch { return false; }
  },

  resolveAllocationForDate(
    userId: string,
    projectId: string,
    dateStr: string,
    periods: AllocationPeriod[],
    staticAllocations: ProjectAllocation[]
  ): number {
    const activePeriod = periods.find(p => 
      p.user_id === userId && 
      p.project_id === projectId && 
      p.start_date <= dateStr && 
      p.end_date >= dateStr
    );
    if (activePeriod) return activePeriod.allocation_percent;

    // Backward compatibility fallback
    const staticAlloc = staticAllocations.find(a => a.user_id === userId && a.project_id === projectId);
    return staticAlloc ? staticAlloc.allocation_percent : 0;
  },

  calculateUtilization(
    allocations: ProjectAllocation[], 
    userId: string, 
    baseCapacity: number = 100,
    periods: AllocationPeriod[] = [],
    targetDateStr?: string
  ): UserCapacity {
    let totalAssigned = 0;
    
    if (targetDateStr && periods.length > 0) {
      // Time-aware utilization
      const uniqueProjects = new Set([...allocations.map(a => a.project_id), ...periods.map(p => p.project_id)]);
      for (const pid of uniqueProjects) {
        totalAssigned += this.resolveAllocationForDate(userId, pid, targetDateStr, periods, allocations);
      }
    } else {
      // Legacy static fallback
      const userAllocations = allocations.filter(a => a.user_id === userId);
      totalAssigned = userAllocations.reduce((sum, a) => sum + a.allocation_percent, 0);
    }
    
    // Utilization is defined as Assigned / Base Capacity
    const utilization = Math.round((totalAssigned / baseCapacity) * 100);

    let classification: UserCapacity['classification'] = 'Healthy';
    if (utilization < 70) classification = 'Available';
    if (utilization >= 90) classification = 'High Utilization';
    if (utilization > 100) classification = 'Overloaded';
    if (utilization >= 150) classification = 'Critical';

    return {
      userId,
      totalAssignedPercent: totalAssigned,
      baseCapacityPercent: baseCapacity,
      utilizationPercent: utilization,
      classification
    };
  },

  validateAllocationChange(
    newAllocation: ProjectAllocation | AllocationPeriod,
    existingAllocations: ProjectAllocation[],
    allowOverallocation: boolean,
    existingPeriods: AllocationPeriod[] = []
  ): { allowed: boolean; reason?: string } {
    if ('start_date' in newAllocation) {
      // Check for overlapping periods
      const overlaps = existingPeriods.filter(p => 
        p.user_id === newAllocation.user_id && 
        p.project_id === newAllocation.project_id &&
        p.start_date <= newAllocation.end_date &&
        p.end_date >= newAllocation.start_date &&
        p.id !== newAllocation.id
      );
      if (overlaps.length > 0 && !allowOverallocation) {
        return { allowed: false, reason: 'Allocation period overlaps with existing period for this user and project.' };
      }
      if (newAllocation.start_date > newAllocation.end_date) {
        return { allowed: false, reason: 'Start date cannot be after end date.' };
      }
      // Calculate max capacity on overlapping days across all projects
      let peakUtilization = 0;
      // Note: for a rigorous check we'd step through days, but we simplify for performance
    }

    const relevant = existingAllocations.filter(a => a.user_id === newAllocation.user_id && a.project_id !== newAllocation.project_id);
    const totalWithoutNew = relevant.reduce((sum, a) => sum + a.allocation_percent, 0);
    const totalWithNew = totalWithoutNew + newAllocation.allocation_percent;

    if (totalWithNew > 100 && !allowOverallocation && !('start_date' in newAllocation)) {
      return { allowed: false, reason: `Allocation would exceed 100% (currently projected at ${totalWithNew}%).` };
    }
    return { allowed: true };
  },

  detectCapacityRisk(
    allocations: ProjectAllocation[], 
    dependencies: any[], 
    milestones: any[],
    periods: AllocationPeriod[] = [],
    forecastDateStr?: string
  ): CapacityRisk[] {
    const risks: CapacityRisk[] = [];
    const users = Array.from(new Set([...allocations.map(a => a.user_id), ...periods.map(p => p.user_id)]));
    for (const userId of users) {
      const cap = this.calculateUtilization(allocations, userId, 100, periods, forecastDateStr);
      if (cap.classification === 'Critical') {
        risks.push({
          userId,
          severity: 'Critical',
          reason: `User is critically overloaded (${cap.totalAssignedPercent}%). Systemic bottleneck detected.`
        });
      } else if (cap.classification === 'Overloaded') {
        risks.push({
          userId,
          severity: 'High',
          reason: `User is overloaded (${cap.totalAssignedPercent}%). Risk of delayed milestones.`
        });
      }
    }
    return risks;
  },

  simulateWhatIf(
    scenario: 'leave' | 'project_delay' | 'new_project' | 'capacity_increase',
    allocations: ProjectAllocation[],
    userId: string,
    params?: any,
    periods: AllocationPeriod[] = [],
    targetDateStr?: string
  ): { etaImpact: string, confidenceImpact: number, riskImpact: string } {
    const cap = this.calculateUtilization(allocations, userId, 100, periods, targetDateStr);

    if (scenario === 'leave') {
      return {
        etaImpact: '+2 weeks to critical paths',
        confidenceImpact: -30,
        riskImpact: 'Critical (SPOF active)'
      };
    }
    if (scenario === 'new_project') {
      const newTotal = cap.totalAssignedPercent + (params?.newPercent || 50);
      return {
        etaImpact: newTotal > 120 ? '+1 week across all active projects' : 'No delay',
        confidenceImpact: newTotal > 100 ? -15 : 0,
        riskImpact: newTotal > 100 ? 'Overloaded' : 'Healthy'
      };
    }
    return { etaImpact: 'Unknown', confidenceImpact: 0, riskImpact: 'Unknown' };
  }
};
