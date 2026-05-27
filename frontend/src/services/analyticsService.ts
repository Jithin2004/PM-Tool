/**
 * Workspace-level analytics — pure derivations from operational raw state.
 * All metric calculations are centralised inside derivedMetrics.ts.
 */
export {
  computeTeamBandwidth,
  computeOperationalDerived,
} from '../core/operational/derivedMetrics';

export type { ComputeDerivedInput } from '../core/operational/derivedMetrics';
