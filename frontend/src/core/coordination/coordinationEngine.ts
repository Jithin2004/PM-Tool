import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  OperationalPresence,
  CollaborationSignal,
  ActivityEntry,
} from '../presence/types';
import type {
  CoordinationState,
  CoordinationDensity,
  OperationalPattern,
  Bottleneck,
  ExecutionHotspot,
  VitalityScore,
} from './types';
import { calculateCoordinationDensity, analyzeParticipation } from './collaborationAnalytics';
import { detectCoordinationBursts, detectReviewGaps, detectWorkloadConcentration } from './operationalPatterns';
import { detectBottlenecks, detectHotspots } from './bottleneckDetection';
import { calculateVitality } from './vitalityScoring';

interface UseCoordinationEngineOptions {
  presences: OperationalPresence[];
  signals: CollaborationSignal[];
  feed: ActivityEntry[];
  projectId?: string;
}

export function useCoordinationEngine(options: UseCoordinationEngineOptions) {
  const { presences, signals, feed, projectId } = options;
  const [patterns, setPatterns] = useState<OperationalPattern[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [hotspots, setHotspots] = useState<ExecutionHotspot[]>([]);
  const prevFeedLengthRef = useRef(feed.length);
  const prevSignalsLengthRef = useRef(signals.length);

  const density = useMemo(
    () => calculateCoordinationDensity(presences, signals, feed),
    [presences, signals, feed],
  );

  const vitality = useMemo(
    () => calculateVitality(presences, signals, feed),
    [presences, signals, feed],
  );

  const participation = useMemo(
    () => analyzeParticipation(signals, feed),
    [signals, feed],
  );

  // Detect patterns and bottlenecks reactively when feed/signals change
  useEffect(() => {
    if (feed.length === prevFeedLengthRef.current && signals.length === prevSignalsLengthRef.current) return;
    prevFeedLengthRef.current = feed.length;
    prevSignalsLengthRef.current = signals.length;

    const newPatterns: OperationalPattern[] = [
      ...detectCoordinationBursts(signals),
      ...detectReviewGaps(signals, feed),
      ...detectWorkloadConcentration(signals, feed),
    ];
    setPatterns(prev => [...newPatterns, ...prev].slice(0, 20));

    const newBottlenecks = detectBottlenecks(presences, signals, feed);
    if (newBottlenecks.length > 0) {
      setBottlenecks(prev => [...newBottlenecks, ...prev].slice(0, 10));
    }

    const newHotspots = detectHotspots(presences, signals);
    if (newHotspots.length > 0) {
      setHotspots(newHotspots);
    }
  }, [feed, signals, presences]);

  const clearPatterns = useCallback(() => setPatterns([]), []);
  const clearBottlenecks = useCallback(() => setBottlenecks([]), []);

  return {
    density,
    vitality,
    patterns,
    bottlenecks,
    hotspots,
    participation,
    clearPatterns,
    clearBottlenecks,
  };
}
