import type { Project, Task } from '../../types';

export interface OperationalIntelligenceMetrics {
  deliveryConfidence: number;
  executionPressure: number;
  dailyFatigue: number;
  riskForecast: number;
}

export function computeOperationalIntelligence(
  projects: Project[],
  tasks: Task[]
): OperationalIntelligenceMetrics {
  let totalDecayHours = 0;
  let pressureScore = 0;

  // Filter active, non-deleted projects
  const activeProjects = projects.filter(
    (p) =>
      p.status !== 'deployed' &&
      p.status !== 'done' &&
      p.status !== 'archived'
  );

  activeProjects.forEach((p) => {
    // Filter tasks for this project that have valid PERT values
    const projTasks = tasks.filter(
      (t) =>
        t.project_id === p.id &&
        !t.deleted_at &&
        (t.pert_best ?? 0) > 0 &&
        (t.pert_likely ?? 0) > 0 &&
        (t.pert_worst ?? 0) > 0
    );

    let expectedSum = 0;
    let varianceSum = 0;

    projTasks.forEach((t) => {
      const best = t.pert_best!;
      const likely = t.pert_likely!;
      const worst = t.pert_worst!;

      const expected = (best + 4 * likely + worst) / 6.0;
      const variance = Math.pow((worst - best) / 6.0, 2);

      expectedSum += expected;
      varianceSum += variance;
    });

    const standardDeviation = Math.sqrt(varianceSum);
    const newWorst = expectedSum + 2.0 * standardDeviation;

    if (newWorst > expectedSum) {
      totalDecayHours += newWorst - expectedSum;
    }

    const newBest = Math.max(0, expectedSum - 2.0 * standardDeviation);
    const spread = Math.max(0, newWorst - newBest);

    if (spread > 0 && expectedSum > 0) {
      pressureScore += (spread / Math.max(expectedSum, 1.0)) * 10.0;
    }
  });

  const deliveryConfidence = Math.max(0, 100.0 - totalDecayHours * 0.5);
  const dailyFatigue = totalDecayHours;

  // Global task counts (not paginated, not filtered by projects)
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const blockedTasks = tasks.filter(
    (t) => t.status === 'blocked' || t.status === 'changes_requested'
  );

  if (activeTasks.length > 0) {
    pressureScore += (blockedTasks.length / activeTasks.length) * 40.0;
  }

  const executionPressure = Math.min(100.0, pressureScore);

  const confidenceRisk = 100.0 - deliveryConfidence;
  const fatigueRisk = Math.min(100.0, dailyFatigue * 2.0);
  const riskForecast = Math.min(
    100.0,
    confidenceRisk * 0.45 + executionPressure * 0.35 + fatigueRisk * 0.2
  );

  return {
    deliveryConfidence: Math.round(deliveryConfidence * 10) / 10,
    executionPressure: Math.round(executionPressure * 10) / 10,
    dailyFatigue: Math.round(dailyFatigue * 10) / 10,
    riskForecast: Math.round(riskForecast * 10) / 10,
  };
}
