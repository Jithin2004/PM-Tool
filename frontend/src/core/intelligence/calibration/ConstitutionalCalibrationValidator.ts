export class ConstitutionalCalibrationValidator {
  public static validateReplay(snapshotUsed: boolean, liveDataUsed: boolean, historicalMutation: boolean): void {
    if (!snapshotUsed) throw new Error("Unconstitutional: Replay MUST use snapshots.");
    if (liveDataUsed) throw new Error("Unconstitutional: Replay CANNOT use live data.");
    if (historicalMutation) throw new Error("Unconstitutional: Historical mutation detected.");
  }

  public static validateCalibration(algorithmTuned: boolean, stateHidden: boolean): void {
    if (algorithmTuned) throw new Error("Unconstitutional: Calibration Engine CANNOT tune algorithms. Pure measurement only.");
    if (stateHidden) throw new Error("Unconstitutional: Hidden state detected in calibration.");
  }
}
