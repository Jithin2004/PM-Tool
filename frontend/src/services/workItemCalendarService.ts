/**
 * workItemCalendarService.ts
 *
 * Reads Supabase work items (tasks, milestones, sprints, projects)
 * and returns them as virtual, READ-ONLY calendar display objects.
 *
 * ARCHITECTURE RULE:
 *  - Nothing from Supabase is ever written into MongoDB.
 *  - These events are ephemeral — computed at render time, merged in the UI.
 *  - RLS is respected automatically via the Supabase client session.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type VirtualEventSource = 'task' | 'milestone' | 'sprint' | 'project' | 'meeting';

export interface VirtualCalendarItem {
  /** Unique key for React — not a real DB id */
  id: string;
  /** Display title */
  title: string;
  /** ISO date string — start of the slot */
  start_date: string;
  /** ISO date string — end of the slot */
  end_date: string;
  /** Which Supabase entity produced this item */
  source: VirtualEventSource;
  /** The real Supabase row id — for routing on click */
  source_id: string;
  /** Contextual metadata for tooltip / detail view */
  meta: Record<string, string | undefined | null>;
  /** Virtual items are never editable through the calendar */
  readonly: true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDay(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

/** End-of-day ISO for single-day deadline slots */
function endOfDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchTaskDeadlines(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<VirtualCalendarItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    // Use .or() to support both legacy due_date and canonical deadline column
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, status, priority, assignee_id, project_id, deadline, due_date, deleted_at')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('status', 'in', '("done","completed","cancelled")')
      .or(`deadline.gte.${startDate},due_date.gte.${startDate}`)
      .limit(200);

    if (error || !data) return [];

    const items: VirtualCalendarItem[] = [];
    for (const task of data) {
      const rawDate = task.deadline || task.due_date;
      const start = isoDay(rawDate);
      if (!start) continue;
      // Filter: exclude tasks beyond window
      if (start > endDate) continue;
      items.push({
        id: `task-deadline-${task.id}`,
        title: `Task: ${task.name}`,
        start_date: start,
        end_date: endOfDay(rawDate!),
        source: 'task',
        source_id: task.id,
        meta: {
          status: task.status,
          priority: task.priority,
          project_id: task.project_id,
          assignee_id: task.assignee_id,
        },
        readonly: true,
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchMilestones(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<VirtualCalendarItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('id, title, status, project_id, target_date, owner_id')
      .eq('workspace_id', workspaceId)
      .not('status', 'eq', 'achieved')
      .gte('target_date', startDate)
      .lte('target_date', endDate)
      .limit(100);

    if (error || !data) return [];

    return data.map((m) => ({
      id: `milestone-${m.id}`,
      title: `Milestone: ${m.title}`,
      start_date: isoDay(m.target_date) || m.target_date,
      end_date: endOfDay(m.target_date),
      source: 'milestone' as VirtualEventSource,
      source_id: m.id,
      meta: {
        status: m.status,
        project_id: m.project_id,
        owner_id: m.owner_id,
      },
      readonly: true as const,
    }));
  } catch {
    return [];
  }
}

async function fetchSprints(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<VirtualCalendarItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('sprints')
      .select('id, name, status, project_id, start_date, end_date')
      .eq('workspace_id', workspaceId)
      .not('status', 'eq', 'cancelled')
      .or(
        `and(start_date.lte.${endDate},end_date.gte.${startDate})`
      )
      .limit(100);

    if (error || !data) return [];

    return data.map((s) => ({
      id: `sprint-${s.id}`,
      title: `Sprint: ${s.name}`,
      start_date: isoDay(s.start_date) || s.start_date,
      end_date: isoDay(s.end_date) || s.end_date,
      source: 'sprint' as VirtualEventSource,
      source_id: s.id,
      meta: {
        status: s.status,
        project_id: s.project_id,
      },
      readonly: true as const,
    }));
  } catch {
    return [];
  }
}

async function fetchProjectDates(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<VirtualCalendarItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, deadline, client_deadline, proposed_start_date')
      .eq('workspace_id', workspaceId)
      .not('status', 'in', '("archived","done")')
      .limit(100);

    if (error || !data) return [];

    const items: VirtualCalendarItem[] = [];

    for (const p of data) {
      // Project deadline / client deadline
      const deadlineRaw = p.client_deadline || p.deadline;
      if (deadlineRaw) {
        const dl = isoDay(deadlineRaw);
        if (dl && dl >= startDate && dl <= endDate) {
          items.push({
            id: `project-deadline-${p.id}`,
            title: `Project Deadline: ${p.name}`,
            start_date: dl,
            end_date: endOfDay(deadlineRaw),
            source: 'project',
            source_id: p.id,
            meta: { status: p.status },
            readonly: true,
          });
        }
      }
      // Project proposed start date
      if (p.proposed_start_date) {
        const start = isoDay(p.proposed_start_date);
        if (start && start >= startDate && start <= endDate) {
          items.push({
            id: `project-start-${p.id}`,
            title: `Project Start: ${p.name}`,
            start_date: start,
            end_date: endOfDay(p.proposed_start_date),
            source: 'project',
            source_id: p.id,
            meta: { status: p.status },
            readonly: true,
          });
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all Supabase work item dates for display on the calendar.
 * Returns virtual items — never written to MongoDB.
 */
export async function fetchWorkItemsForCalendar(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<VirtualCalendarItem[]> {
  if (!workspaceId) return [];

  const [tasks, milestones, sprints, projects] = await Promise.allSettled([
    fetchTaskDeadlines(workspaceId, startDate, endDate),
    fetchMilestones(workspaceId, startDate, endDate),
    fetchSprints(workspaceId, startDate, endDate),
    fetchProjectDates(workspaceId, startDate, endDate),
  ]);

  return [
    ...(tasks.status === 'fulfilled' ? tasks.value : []),
    ...(milestones.status === 'fulfilled' ? milestones.value : []),
    ...(sprints.status === 'fulfilled' ? sprints.value : []),
    ...(projects.status === 'fulfilled' ? projects.value : []),
  ];
}
