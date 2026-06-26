export interface CalibrationMetrics {
  mae: number;
  rmse: number;
  bias: number;
  drift: number;
}

export class CalibrationEngine {
  public calculateMetrics(predicted: number[], actual: number[]): CalibrationMetrics {
    if (predicted.length === 0 || predicted.length !== actual.length) {
      return { mae: 0, rmse: 0, bias: 0, drift: 0 };
    }

    let sumAbsError = 0;
    let sumSqError = 0;
    let sumError = 0;

    for (let i = 0; i < predicted.length; i++) {
      const error = predicted[i] - actual[i];
      sumError += error;
      sumAbsError += Math.abs(error);
      sumSqError += error * error;
    }

    const n = predicted.length;
    return {
      mae: sumAbsError / n,
      rmse: Math.sqrt(sumSqError / n),
      bias: sumError / n,
      drift: 0 // Tracked over time
    };
  }
}
