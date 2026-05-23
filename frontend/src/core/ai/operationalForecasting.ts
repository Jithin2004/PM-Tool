import type { CollaborationSignal, ActivityEntry } from '../presence/types';
import type { OperationalForecast } from './types';

interface TrendWindow {
  editing: number;
  reviewing: number;
  planning: number;
  blocked: number;
  total: number;
}

function computeWindow(signals: CollaborationSignal[], feed: ActivityEntry[], windowMs: number): TrendWindow {
  const now = Date.now();
  const cutoff = now - windowMs;

  const recentSignals = signals.filter(s => new Date(s.timestamp).getTime() > cutoff);
  const recentFeed = feed.filter(f => new Date(f.timestamp).getTime() > cutoff);

  return {
    editing: recentSignals.filter(s => s.type === 'editing').length,
    reviewing: recentSignals.filter(s => s.type === 'reviewing').length,
    planning: recentSignals.filter(s => s.type === 'planning').length,
    blocked: recentSignals.filter(s => s.type === 'blocker').length,
    total: recentFeed.length,
  };
}

export function forecastCoordinationTrend(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): OperationalForecast[] {
  const forecasts: OperationalForecast[] = [];

  const recent = computeWindow(signals, feed, 300_000);
  const mid = computeWindow(signals, feed, 600_000);
  const older = computeWindow(signals, feed, 1_800_000);

  const recentRate = recent.total / 5;
  const midRate = mid.total / 10;
  const olderRate = older.total / 30;

  if (recentRate > midRate && midRate > olderRate) {
    forecasts.push({
      metric: 'coordination activity',
      direction: 'increasing',
      confidence: Math.min(0.8, recentRate / (olderRate || 1) * 0.5),
      timeframe: 'next 60 minutes',
      narrative: 'Coordination activity is accelerating — expect continued operational engagement',
    });
  } else if (recentRate < midRate && midRate < olderRate) {
    forecasts.push({
      metric: 'coordination activity',
      direction: 'declining',
      confidence: Math.min(0.7, olderRate / (midRate || 1) * 0.4),
      timeframe: 'next 60 minutes',
      narrative: 'Coordination activity is tapering — likely end of operational window',
    });
  }

  const recentBlockerRatio = recent.blocked / (recent.total || 1);
  const midBlockerRatio = mid.blocked / (mid.total || 1);

  if (recentBlockerRatio > midBlockerRatio && recentBlockerRatio > 0.2) {
    forecasts.push({
      metric: 'blocker accumulation',
      direction: 'increasing',
      confidence: Math.min(0.7, recentBlockerRatio * 1.5),
      timeframe: 'next 30 minutes',
      narrative: 'Blocker ratio increasing — review and unblock coordination may be needed',
    });
  }

  return forecasts;
}
