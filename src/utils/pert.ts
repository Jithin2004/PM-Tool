export interface PertInput {
  best: number;
  likely: number;
  worst: number;
}

export function calculateExpectedEffort({ best, likely, worst }: PertInput): number {
  return (best + 4 * likely + worst) / 6;
}

export function calculatePertVariance({ best, worst }: Pick<PertInput, 'best' | 'worst'>): number {
  return Math.pow((worst - best) / 6, 2);
}

export function calculatePertStandardDeviation(input: Pick<PertInput, 'best' | 'worst'>): number {
  return Math.sqrt(calculatePertVariance(input));
}

export function normalizePertInput(best?: number, likely?: number, worst?: number): PertInput {
  const fallback = Math.max(0, likely || best || worst || 0);
  return {
    best: Math.max(0, best ?? fallback),
    likely: Math.max(0, likely ?? fallback),
    worst: Math.max(0, worst ?? fallback)
  };
}
