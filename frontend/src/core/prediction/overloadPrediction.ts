import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';
import type { Prediction } from './types';
import { intelligenceQueryEngine } from '../engines/intelligenceQueryEngine';

export async function predictOverload(
  workspaceId: string,
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const now = Date.now();

  const activeUsers = presences.filter(p => !p.idle && p.state !== 'away');

  // Instead of math.random or fake counts, query the real workload
  for (const user of activeUsers) {
    const workload = await intelligenceQueryEngine.getWorkloadIntelligence(workspaceId, user.userId, user.role);
    
    if (workload.insights.length > 0) {
      predictions.push({
        id: `workload-${user.userId}-${now}`,
        type: 'overload',
        probability: 1.0, // Deprecated field, keeping for type compliance
        timeframe: 'current workload',
        title: `${user.username} Workload Context`,
        description: workload.insights.join(' '),
        context: { userId: user.userId },
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  return predictions;
}
