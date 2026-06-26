import type { OperationalSnapshot } from '../types/snapshot';

export interface SnapshotRegistry {
  storeSnapshot(snapshot: OperationalSnapshot): Promise<void>;
  getSnapshot(snapshotId: string): Promise<OperationalSnapshot | null>;
}
