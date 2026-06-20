import { supabase } from '../lib/supabase';
import type { ActivityEvent } from './activityEventService';

export const activityAggregationService = {
  /**
   * Summarizes a list of raw activity events into a human-readable digest
   */
  aggregateEvents(events: ActivityEvent[], startDate: Date, endDate: Date) {
    const periodEvents = events.filter(e => {
      const d = new Date(e.created_at).getTime();
      return d >= startDate.getTime() && d <= endDate.getTime();
    });

    // Bucket by entity_type and action
    const taskUpdates = periodEvents.filter(e => e.entity_type === 'task' && e.action_type === 'updated');
    const tasksCompleted = periodEvents.filter(e => e.entity_type === 'task' && e.action_type === 'status_changed' && e.metadata?.new_status === 'done');
    const tasksBlocked = periodEvents.filter(e => e.entity_type === 'task' && e.action_type === 'blocked');
    const timelineShifts = periodEvents.filter(e => e.action_type === 'rescheduled');

    // Comments & Mentions
    // "Aggregate: multiple normal comments"
    // "Do NOT aggregate: direct @mentions"
    const comments = periodEvents.filter(e => e.action_type === 'comment_created' || (e as any).action_type === 'comment_created');
    const mentions = periodEvents.filter(e => e.action_type === 'mention' || (e as any).action_type === 'mention');

    // De-duplicate timeline cascades
    // Example: 50 tasks rescheduled within 5 seconds of each other = 1 mass shift event
    const deduplicatedTimelineShifts = this._compressCascadeEvents(timelineShifts, 5000);
    const aggregatedComments = this._compressCommentEvents(comments, 60000); // 1 minute window for aggregation

    return {
      totalEvents: periodEvents.length,
      tasksProgressed: taskUpdates.length,
      tasksCompleted: tasksCompleted.length,
      tasksBlocked: tasksBlocked.length,
      timelineShifts: deduplicatedTimelineShifts.length,
      comments: aggregatedComments.length,
      mentions: mentions.length,
      rawCompressedTimelineEvents: deduplicatedTimelineShifts,
      rawAggregatedComments: aggregatedComments,
      rawMentions: mentions
    };
  },

  /**
   * Compresses events that happen near-simultaneously (like Gantt drag cascades)
   * into a single summary event.
   */
  _compressCascadeEvents(events: ActivityEvent[], thresholdMs: number) {
    if (events.length === 0) return [];

    // Sort by time
    const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const compressed = [];
    let currentBatch = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prevTime = new Date(currentBatch[currentBatch.length - 1].created_at).getTime();
      const currTime = new Date(sorted[i].created_at).getTime();

      if (currTime - prevTime <= thresholdMs) {
        currentBatch.push(sorted[i]);
      } else {
        compressed.push(this._mergeBatch(currentBatch));
        currentBatch = [sorted[i]];
      }
    }

    if (currentBatch.length > 0) {
      compressed.push(this._mergeBatch(currentBatch));
    }

    return compressed;
  },

  _mergeBatch(batch: ActivityEvent[]) {
    if (batch.length === 1) return batch[0];

    // Create a synthesized summary event
    return {
      id: `agg_${batch[0].id}`,
      workspace_id: batch[0].workspace_id,
      entity_type: 'cascade',
      entity_id: batch[0].entity_id,
      action_type: 'mass_update',
      metadata: {
        affectedCount: batch.length,
        originalTrigger: batch[0]
      },
      created_by: batch[0].actor_id,
      created_at: batch[0].created_at
    };
  },

  /**
   * Compress multiple comments on the same entity by the same user within a threshold.
   */
  _compressCommentEvents(events: any[], thresholdMs: number) {
    if (events.length === 0) return [];

    // Sort by time
    const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const compressed = [];
    let currentBatch = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentBatch[currentBatch.length - 1];
      const curr = sorted[i];

      const prevTime = new Date(prev.created_at).getTime();
      const currTime = new Date(curr.created_at).getTime();

      const actorId = prev.created_by || prev.actor_id;
      const currActorId = curr.created_by || curr.actor_id;

      if (currTime - prevTime <= thresholdMs && prev.entity_id === curr.entity_id && actorId === currActorId) {
        currentBatch.push(curr);
      } else {
        compressed.push(this._mergeCommentBatch(currentBatch));
        currentBatch = [curr];
      }
    }

    if (currentBatch.length > 0) {
      compressed.push(this._mergeCommentBatch(currentBatch));
    }

    return compressed;
  },

  _mergeCommentBatch(batch: any[]) {
    if (batch.length === 1) return batch[0];

    const first = batch[0];
    return {
      id: `agg_comment_${first.id}`,
      workspace_id: first.workspace_id,
      entity_type: first.entity_type,
      entity_id: first.entity_id,
      action_type: 'mass_comment',
      metadata: {
        affectedCount: batch.length,
        author_name: first.metadata?.author_name || 'Someone',
        message: `${first.metadata?.author_name || 'Someone'} added ${batch.length} comments`
      },
      created_by: first.created_by || first.actor_id,
      created_at: first.created_at
    };
  }
};
