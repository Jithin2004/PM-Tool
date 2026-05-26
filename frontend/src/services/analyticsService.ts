/**
 * Workspace-level analytics — pure derivations from operational raw state.
 */
export {
  computeOperationalStats,
  computeDeliveryConfidence,
  computeExecutionPressure,
  computeRiskForecast,
  computeTeamBandwidth,
  aggregateProjectPert,
  computeOperationalDerived,
} from '../core/operational/derivedMetrics';

export type { ComputeDerivedInput } from '../core/operational/derivedMetrics';
