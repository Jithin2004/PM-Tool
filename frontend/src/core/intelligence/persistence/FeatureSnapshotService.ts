export class FeatureSnapshotService {
  public saveSnapshot(workspaceId: string, featureData: any): string {
    return 'snapshot-uuid';
  }

  public loadSnapshot(snapshotId: string): any {
    return { loaded: true };
  }
}
