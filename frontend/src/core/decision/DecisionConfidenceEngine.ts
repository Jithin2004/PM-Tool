export interface ConfidenceInputs {
  tasks: any[];
  profiles: any[];
  project?: any;
  targetUserId?: string;
  historicalAccuracy?: number; // 0 to 1
}

export interface ConfidenceResult {
  score: number; // 0 to 100
  explanation: string;
}

export function calculateDecisionConfidence(category: string, inputs: ConfidenceInputs): ConfidenceResult {
  const { tasks, profiles, project, targetUserId, historicalAccuracy = 0.8 } = inputs;
  
  let score = 50; // base score
  let reasons: string[] = [];
  
  // Data Completeness Checks
  const tasksWithoutEstimates = tasks.filter(t => !t.estimated_hours).length;
  if (tasksWithoutEstimates > 0) {
    score -= Math.min(20, (tasksWithoutEstimates / tasks.length) * 50);
    reasons.push(`Missing estimates on ${tasksWithoutEstimates} tasks.`);
  }

  // Operational Certainty (Sample Size)
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  if (completedTasks > 20) {
    score += 25;
    reasons.push(`Based on strong sample size (${completedTasks} completed tasks).`);
  } else if (completedTasks > 5) {
    score += 10;
    reasons.push(`Based on limited execution history (${completedTasks} completed tasks).`);
  } else {
    score -= 15;
    reasons.push(`Low certainty: Almost no execution history available in this scope.`);
  }

  // Historical Accuracy
  if (historicalAccuracy > 0.8) {
    score += 10;
  } else if (historicalAccuracy < 0.5) {
    score -= 15;
    reasons.push(`Recent platform predictions have had high variance.`);
  }

  // Category specific modifiers
  if (category === 'team_overload') {
    const target = profiles.find(p => p.id === targetUserId);
    if (!target) {
       // Just general overload detection
       score += 10;
    } else {
       if (!target.availability_factor) {
         score -= 20;
         reasons.push(`Target operator missing availability factor.`);
       } else {
         score += 15;
         reasons.push(`Target operator capacity clearly defined.`);
       }
    }
  }

  if (category === 'revenue_risk') {
    score = 95; // Deterministic
    reasons = ['Financial triggers are deterministic based on invoice dates.'];
  }

  if (category === 'hr_risk') {
    score = 95; // Deterministic
    reasons = ['Contract dates are deterministic.'];
  }

  // Bound score between 0 and 100
  score = Math.max(10, Math.min(100, Math.round(score)));

  let prefix = score > 80 ? 'High confidence: ' : score > 50 ? 'Medium confidence: ' : 'Low confidence: ';
  
  return {
    score,
    explanation: prefix + reasons.join(' ')
  };
}
